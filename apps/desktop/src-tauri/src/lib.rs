mod core;
mod desktop;
mod note_lifecycle;
mod platform;

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, RunEvent, State,
    WebviewWindow,
};

use core::coordinator::{Coordinator, MatchResult};
use core::models::{
    HitTestRect, OverlayInitializationStatus, OverlayMetrics, OverlayStatePayload, SkribNote,
    TargetWindowInfo,
};
use core::storage;
use core::{account, license};
use note_lifecycle::{
    detached_open_request, reopened_open_request, shortcut_open_request, OpenNoteRequest,
};

#[cfg(target_os = "windows")]
use platform::windows::{
    get_overlay_metrics as query_overlay_metrics, inspect_target_window, install_overlay_subclass,
    install_winevent_hooks, list_candidate_target_windows, reconstruct_hwnd, set_dpi_awareness,
    start_global_hotkey_listener, uninstall_overlay_subclass, uninstall_winevent_hooks,
    EVENT_OBJECT_DESTROY, EVENT_OBJECT_HIDE, EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_NAMECHANGE,
    EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND, EVENT_SYSTEM_MINIMIZESTART,
};
#[cfg(target_os = "windows")]
use platform::windows_events::{WinEventPipeline, WIN_EVENT_QUEUE_CAPACITY};
#[cfg(target_os = "windows")]
use platform::windows_focus::focus_external_window;
#[cfg(target_os = "windows")]
use platform::windows_placement::{
    initialize_compact_window, position_compact_window_for_target, position_detached_note_window,
    position_note_window_for_target, position_note_workspace_for_target,
    prepare_standard_compact_surface, refresh_note_window_surface, restore_standard_window_surface,
    transition_detached_note_window, transition_note_window_for_target,
    COMPACT_WINDOW_LOGICAL_HEIGHT, COMPACT_WINDOW_LOGICAL_WIDTH,
};
#[cfg(target_os = "windows")]
use platform::windows_target_capture::{
    capture_foreground_target, revalidate_captured_target, TargetCaptureError,
};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageHealthPayload {
    notice: Option<storage::StorageNotice>,
    error: Option<String>,
    writable: bool,
    revision: u64,
    backup_directory: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProgrammaticNotePlacement {
    note_id: String,
    physical_x: i32,
    physical_y: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DismissedCollapsedWindow {
    note_id: String,
    target_hwnd: isize,
    target_process_name: String,
    target_title: String,
    armed: bool,
}

#[derive(Debug, Default)]
pub(crate) struct NoteWindowRuntime {
    active_note_id: Option<String>,
    detached: bool,
    borrowed_dimensions: Option<(f64, f64)>,
    workspace_expanded: bool,
    pending_programmatic_placement: Option<ProgrammaticNotePlacement>,
    dismissed_collapsed_window: Option<DismissedCollapsedWindow>,
    pending_open_request: Option<OpenNoteRequest>,
}

#[derive(Debug, Default)]
struct NativeWindowOperationGate(Mutex<()>);

impl NativeWindowOperationGate {
    fn lock(&self) -> Result<MutexGuard<'_, ()>, String> {
        self.0
            .lock()
            .map_err(|_| "The native window operation lock is unavailable.".to_string())
    }
}

const GLOBAL_RAIL_COLLAPSED_WIDTH: f64 = 28.0;
const GLOBAL_RAIL_COLLAPSED_HEIGHT: f64 = 80.0;
const CONTEXT_RAIL_COLLAPSED_WIDTH: f64 = 28.0;
const CONTEXT_RAIL_COLLAPSED_HEIGHT: f64 = 28.0;
const CONTEXT_RAIL_PEEK_WIDTH: f64 = 164.0;
const CONTEXT_RAIL_PEEK_HEIGHT: f64 = 36.0;
const RAIL_EXPANDED_WIDTH: f64 = 364.0;
const RAIL_EXPANDED_HEIGHT: f64 = 430.0;
const GLOBAL_RAIL_EDGE_MARGIN_LOGICAL: f64 = 0.0;
const CONTEXT_RAIL_EDGE_MARGIN_LOGICAL: f64 = 8.0;
const RAIL_DOCK_DEBOUNCE: Duration = Duration::from_millis(180);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ContextRailPlacement {
    target_hwnd: isize,
    bounds: RailDockBounds,
    relative_x: i32,
    relative_y: i32,
}

#[derive(Debug, Default)]
struct RailWindowRuntime {
    movement_generation: AtomicU64,
    pending_programmatic_positions: Mutex<VecDeque<(i32, i32)>>,
    has_docked_position: AtomicBool,
    expanded: AtomicBool,
    revealed: AtomicBool,
    arrival_revision: AtomicU64,
    state_revision: AtomicU64,
    docked_left: AtomicBool,
    foreground_target: Mutex<Option<TargetWindowInfo>>,
    suppressed_context: Mutex<Option<String>>,
    context_placement: Mutex<Option<ContextRailPlacement>>,
}

#[derive(Debug, Default, Clone, Copy, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RailWindowState {
    contextual: bool,
    expanded: bool,
    revealed: bool,
    arrival_revision: u64,
    #[serde(rename = "revision")]
    state_revision: u64,
    dock_side: RailDockSide,
}

fn context_arrival_matches(expected: Option<u64>, current: RailWindowState) -> bool {
    expected.is_none_or(|revision| revision == current.arrival_revision)
}

fn detached_note_rail_label(
    caller: &str,
    context_available: bool,
    expected_arrival: Option<u64>,
    current: RailWindowState,
) -> Result<&'static str, String> {
    if caller != "context-rail" {
        return Ok("rail");
    }
    if !context_available || !context_arrival_matches(expected_arrival, current) {
        return Err("The active app changed. Open its Skrib list and try again.".into());
    }
    Ok("context-rail")
}

#[tauri::command]
fn get_rail_window_state(contextual: bool) -> RailWindowState {
    let runtime = if contextual {
        context_rail_window_runtime()
    } else {
        rail_window_runtime()
    };
    RailWindowState {
        contextual,
        expanded: runtime.expanded.load(Ordering::Acquire),
        revealed: runtime.revealed.load(Ordering::Acquire),
        arrival_revision: runtime.arrival_revision.load(Ordering::Acquire),
        state_revision: runtime.state_revision.load(Ordering::Acquire),
        dock_side: if runtime.docked_left.load(Ordering::Acquire) {
            RailDockSide::Left
        } else {
            RailDockSide::Right
        },
    }
}

fn emit_rail_window_state(app_handle: &AppHandle, contextual: bool) {
    let runtime = if contextual {
        context_rail_window_runtime()
    } else {
        rail_window_runtime()
    };
    runtime.state_revision.fetch_add(1, Ordering::AcqRel);
    let label = if contextual { "context-rail" } else { "rail" };
    let _ = app_handle.emit_to(
        label,
        "skribly://rail-state-changed",
        get_rail_window_state(contextual),
    );
}

impl RailWindowRuntime {
    fn foreground_target(&self) -> Option<TargetWindowInfo> {
        self.foreground_target
            .lock()
            .ok()
            .and_then(|value| value.clone())
    }

    fn arrive(&self, target: &TargetWindowInfo) {
        if let Ok(mut current) = self.foreground_target.lock() {
            let changed = current.as_ref().is_none_or(|previous| {
                previous.hwnd_val != target.hwnd_val
                    || previous.context_fingerprint() != target.context_fingerprint()
            });
            if changed {
                self.expanded.store(false, Ordering::Release);
                self.revealed.store(true, Ordering::Release);
                self.arrival_revision.fetch_add(1, Ordering::AcqRel);
            }
            *current = Some(target.clone());
        }
    }

    fn is_suppressed(&self, target: &TargetWindowInfo) -> bool {
        self.suppressed_context
            .lock()
            .ok()
            .is_some_and(|value| value.as_deref() == Some(target.context_fingerprint().as_str()))
    }

    fn cancel_pending_user_dock(&self) {
        self.movement_generation.fetch_add(1, Ordering::AcqRel);
    }

    fn record_programmatic_position(&self, position: PhysicalPosition<i32>) {
        // App-controlled placement supersedes any delayed edge snap that was
        // scheduled while the user was dragging the rail.
        self.cancel_pending_user_dock();
        if let Ok(mut pending) = self.pending_programmatic_positions.lock() {
            pending.push_back((position.x, position.y));
            while pending.len() > 8 {
                pending.pop_front();
            }
        }
        self.has_docked_position.store(true, Ordering::Release);
    }

    fn consume_programmatic_movement(&self, position: PhysicalPosition<i32>) -> bool {
        let Ok(mut pending) = self.pending_programmatic_positions.lock() else {
            return false;
        };
        let matching_index = pending
            .iter()
            .position(|(x, y)| x.abs_diff(position.x) <= 2 && y.abs_diff(position.y) <= 2);
        if let Some(index) = matching_index {
            pending.remove(index);
            true
        } else {
            // A non-matching move is user-originated. Drop stale expected
            // positions so a later drag cannot be mistaken for an old command.
            pending.clear();
            false
        }
    }

    fn begin_user_movement(&self) -> u64 {
        self.movement_generation
            .fetch_add(1, Ordering::AcqRel)
            .wrapping_add(1)
    }

    fn movement_is_current(&self, generation: u64) -> bool {
        self.movement_generation.load(Ordering::Acquire) == generation
    }

    fn has_docked_position(&self) -> bool {
        self.has_docked_position.load(Ordering::Acquire)
    }

    fn context_placement(&self) -> Option<ContextRailPlacement> {
        self.context_placement.lock().ok().and_then(|value| *value)
    }

    fn record_context_placement(
        &self,
        target_hwnd: isize,
        bounds: RailDockBounds,
        position: PhysicalPosition<i32>,
    ) {
        if let Ok(mut placement) = self.context_placement.lock() {
            *placement = Some(ContextRailPlacement {
                target_hwnd,
                bounds,
                relative_x: position.x.saturating_sub(bounds.x),
                relative_y: position.y.saturating_sub(bounds.y),
            });
        }
    }

    fn clear_context_placement(&self) {
        if let Ok(mut placement) = self.context_placement.lock() {
            *placement = None;
        }
    }
}

static RAIL_WINDOW_RUNTIME: OnceLock<RailWindowRuntime> = OnceLock::new();
static CONTEXT_RAIL_WINDOW_RUNTIME: OnceLock<RailWindowRuntime> = OnceLock::new();

fn rail_window_runtime() -> &'static RailWindowRuntime {
    RAIL_WINDOW_RUNTIME.get_or_init(RailWindowRuntime::default)
}

fn context_rail_window_runtime() -> &'static RailWindowRuntime {
    CONTEXT_RAIL_WINDOW_RUNTIME.get_or_init(RailWindowRuntime::default)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RailDockBounds {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[derive(Debug, Default, Clone, Copy, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum RailDockSide {
    Left,
    #[default]
    Right,
}

fn rail_dock_limits(
    window_size: PhysicalSize<u32>,
    work_area: RailDockBounds,
    margin: i32,
) -> (i64, i64, i64, i64) {
    let work_left = i64::from(work_area.x);
    let work_top = i64::from(work_area.y);
    let work_width = i64::from(work_area.width.max(0));
    let work_height = i64::from(work_area.height.max(0));
    let window_width = i64::from(window_size.width);
    let window_height = i64::from(window_size.height);
    let margin = i64::from(margin.max(0));

    let horizontal_margin = margin.min((work_width - window_width).max(0) / 2);
    let vertical_margin = margin.min((work_height - window_height).max(0) / 2);
    let left = work_left.saturating_add(horizontal_margin);
    let right = work_left
        .saturating_add(work_width)
        .saturating_sub(window_width)
        .saturating_sub(horizontal_margin)
        .max(left);
    let top = work_top.saturating_add(vertical_margin);
    let bottom = work_top
        .saturating_add(work_height)
        .saturating_sub(window_height)
        .saturating_sub(vertical_margin)
        .max(top);
    (left, right, top, bottom)
}

fn rail_dock_side(
    position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
    work_area: RailDockBounds,
    margin: i32,
) -> RailDockSide {
    let (left, right, _, _) = rail_dock_limits(window_size, work_area, margin);
    let current_x = i64::from(position.x);
    if current_x.abs_diff(left) <= current_x.abs_diff(right) {
        RailDockSide::Left
    } else {
        RailDockSide::Right
    }
}

fn rail_position_for_side_and_y(
    side: RailDockSide,
    y: i32,
    window_size: PhysicalSize<u32>,
    work_area: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    let (left, right, top, bottom) = rail_dock_limits(window_size, work_area, margin);
    let x = match side {
        RailDockSide::Left => left,
        RailDockSide::Right => right,
    };
    PhysicalPosition::new(
        x.clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32,
        i64::from(y)
            .clamp(top, bottom)
            .clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32,
    )
}

fn rail_position_after_size_change(
    previous_position: PhysicalPosition<i32>,
    previous_size: PhysicalSize<u32>,
    next_size: PhysicalSize<u32>,
    work_area: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    let side = rail_dock_side(previous_position, previous_size, work_area, margin);
    rail_position_for_side_and_y(side, previous_position.y, next_size, work_area, margin)
}

fn nearest_rail_edge_position(
    position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
    work_area: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    let side = rail_dock_side(position, window_size, work_area, margin);
    rail_position_for_side_and_y(side, position.y, window_size, work_area, margin)
}

fn clamp_rail_position_to_bounds(
    position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
    bounds: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    let (left, right, top, bottom) = rail_dock_limits(window_size, bounds, margin);
    PhysicalPosition::new(
        i64::from(position.x).clamp(left, right) as i32,
        i64::from(position.y).clamp(top, bottom) as i32,
    )
}

impl NoteWindowRuntime {
    fn active_note_id(&self) -> Option<&str> {
        self.active_note_id.as_deref()
    }

    fn detached_note_id(&self) -> Option<&str> {
        self.active_note_id.as_deref().filter(|_| self.detached)
    }

    fn workspace_expanded_for(&self, note_id: &str) -> bool {
        self.active_note_id.as_deref() == Some(note_id) && self.workspace_expanded
    }

    fn workspace_is_expanded(&self) -> bool {
        self.active_note_id.is_some() && self.workspace_expanded
    }

    fn clear(&mut self) {
        self.active_note_id = None;
        self.detached = false;
        self.borrowed_dimensions = None;
        self.workspace_expanded = false;
        self.pending_programmatic_placement = None;
        self.dismissed_collapsed_window = None;
        self.pending_open_request = None;
    }

    fn dismiss_collapsed_window(&mut self, note: &SkribNote, target: &TargetWindowInfo) {
        self.hide_collapsed_window(note, target, false);
    }

    fn hide_active_note_until_context_returns(
        &mut self,
        note: &SkribNote,
        target: &TargetWindowInfo,
    ) {
        self.active_note_id = Some(note.id.clone());
        self.workspace_expanded =
            !note.collapsed && note.width > COMPACT_WINDOW_LOGICAL_WIDTH as f64;
        self.pending_programmatic_placement = None;
        self.dismissed_collapsed_window = Some(DismissedCollapsedWindow {
            note_id: note.id.clone(),
            target_hwnd: target.hwnd_val,
            target_process_name: target.process_name.clone(),
            target_title: target.title.clone(),
            armed: true,
        });
    }

    fn hide_collapsed_window(&mut self, note: &SkribNote, target: &TargetWindowInfo, armed: bool) {
        self.active_note_id = Some(note.id.clone());
        self.workspace_expanded = false;
        self.pending_programmatic_placement = None;
        self.dismissed_collapsed_window = Some(DismissedCollapsedWindow {
            note_id: note.id.clone(),
            target_hwnd: target.hwnd_val,
            target_process_name: target.process_name.clone(),
            target_title: target.title.clone(),
            armed,
        });
    }

    fn dismissed_collapsed_window(&self) -> Option<&DismissedCollapsedWindow> {
        self.dismissed_collapsed_window.as_ref()
    }

    fn arm_dismissed_collapsed_window(&mut self, expected: &DismissedCollapsedWindow) -> bool {
        let Some(current) = self.dismissed_collapsed_window.as_mut() else {
            return false;
        };
        if current != expected || current.armed {
            return false;
        }
        current.armed = true;
        true
    }

    fn record_programmatic_placement(
        &mut self,
        note_id: &str,
        workspace_expanded: bool,
        metrics: &OverlayMetrics,
    ) {
        if self.active_note_id() != Some(note_id) {
            self.borrowed_dimensions = None;
        }
        self.active_note_id = Some(note_id.to_string());
        self.detached = false;
        self.workspace_expanded = workspace_expanded;
        self.dismissed_collapsed_window = None;
        self.pending_programmatic_placement = Some(ProgrammaticNotePlacement {
            note_id: note_id.to_string(),
            physical_x: metrics.overlay_physical_x,
            physical_y: metrics.overlay_physical_y,
        });
    }

    fn record_detached_placement(&mut self, note_id: &str, metrics: &OverlayMetrics) {
        self.record_programmatic_placement(note_id, true, metrics);
        self.detached = true;
    }

    fn borrowed_dimensions_for(&self, note_id: &str) -> Option<(f64, f64)> {
        (self.active_note_id() == Some(note_id))
            .then_some(self.borrowed_dimensions)
            .flatten()
    }

    fn dimensions_to_save(&self, note: &SkribNote, observed: (f64, f64)) -> (f64, f64) {
        if self.borrowed_dimensions_for(&note.id).is_some() {
            (note.width, note.height)
        } else {
            observed
        }
    }

    fn record_size_mode(&mut self, note: &SkribNote, width: f64, height: f64, temporary: bool) {
        self.borrowed_dimensions = if temporary && (width != note.width || height != note.height) {
            Some((width, height))
        } else {
            None
        };
    }

    fn record_open_request(&mut self, request: OpenNoteRequest) {
        self.pending_open_request = Some(request);
    }

    fn pending_open_request(&self) -> Option<OpenNoteRequest> {
        self.pending_open_request.clone()
    }

    fn acknowledge_open_request(&mut self, note_id: &str) -> bool {
        if self
            .pending_open_request
            .as_ref()
            .is_some_and(|request| request.note_id == note_id)
        {
            self.pending_open_request = None;
            true
        } else {
            false
        }
    }

    fn should_ignore_position_save(
        &mut self,
        note_id: &str,
        physical_x: i32,
        physical_y: i32,
    ) -> bool {
        if self.detached_note_id() == Some(note_id) {
            return true;
        }
        if self.active_note_id.is_some() && self.active_note_id.as_deref() != Some(note_id) {
            return true;
        }
        let Some(pending) = self.pending_programmatic_placement.as_ref() else {
            return false;
        };
        if pending.note_id != note_id {
            return false;
        }
        let should_ignore = pending.physical_x == physical_x && pending.physical_y == physical_y;
        self.pending_programmatic_placement = None;
        should_ignore
    }
}

pub struct AppState {
    pub coordinator: Coordinator,
    pub running: Arc<AtomicBool>,
    pub init_status: Mutex<OverlayInitializationStatus>,
    pub mutation_lock: Mutex<()>,
    pub storage: Mutex<storage::StorageService>,
    pub storage_notice: Mutex<Option<storage::StorageNotice>>,
    pub storage_error: Mutex<Option<String>>,
    pub(crate) note_window_runtime: Mutex<NoteWindowRuntime>,
    native_lifecycle_generation: AtomicU64,
    native_lifecycle_commit_lock: Mutex<()>,
    native_window_operation_gate: NativeWindowOperationGate,
    #[cfg(target_os = "windows")]
    pub win_event_pipeline: WinEventPipeline,
}

fn set_rail_position(
    _app_handle: &AppHandle,
    rail: &WebviewWindow,
    position: PhysicalPosition<i32>,
    runtime: &RailWindowRuntime,
) -> tauri::Result<()> {
    runtime.record_programmatic_position(position);
    rail.set_position(position)
}

fn size_and_dock_rail(
    app_handle: &AppHandle,
    rail: &WebviewWindow,
    logical_width: f64,
    logical_height: f64,
) -> Result<(), String> {
    rail_window_runtime()
        .movement_generation
        .fetch_add(1, Ordering::AcqRel);
    let _ = rail.set_shadow(false);
    // The rail is moved with the native window-drag API, which Windows otherwise treats like a
    // draggable title bar. Keep it outside Snap Layouts and recover immediately if an older build
    // left the transparent host maximized. Programmatic collapsed/expanded sizing still works.
    if rail.is_maximized().unwrap_or(false) {
        rail.unmaximize()
            .map_err(|error| format!("Skribli could not restore the note rail: {error}"))?;
    }
    rail.set_resizable(false)
        .map_err(|error| format!("Skribli could not lock the note rail size: {error}"))?;
    rail.set_maximizable(false)
        .map_err(|error| format!("Skribli could not disable note rail maximization: {error}"))?;

    let previous_position = rail.outer_position().ok();
    let previous_size = rail.outer_size().ok();
    let had_docked_position = rail_window_runtime().has_docked_position();
    let monitor = rail
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| rail.primary_monitor().ok().flatten());

    rail.set_size(LogicalSize::new(logical_width, logical_height))
        .map_err(|error| format!("Skribli could not resize the note rail: {error}"))?;

    let Some(monitor) = monitor else {
        return Ok(());
    };
    let work_area = monitor.work_area();
    let scale = monitor.scale_factor();
    let margin = (GLOBAL_RAIL_EDGE_MARGIN_LOGICAL * scale).round() as i32;
    let bounds = RailDockBounds {
        x: work_area.position.x,
        y: work_area.position.y,
        width: i32::try_from(work_area.size.width).unwrap_or(i32::MAX),
        height: i32::try_from(work_area.size.height).unwrap_or(i32::MAX),
    };
    let next_size = PhysicalSize::new(
        (logical_width * scale).round().max(0.0) as u32,
        (logical_height * scale).round().max(0.0) as u32,
    );
    let position = match (had_docked_position, previous_position, previous_size) {
        (true, Some(position), Some(size)) => {
            rail_position_after_size_change(position, size, next_size, bounds, margin)
        }
        _ => rail_position_for_side_and_y(
            RailDockSide::Right,
            work_area.position.y.saturating_add(
                (work_area.size.height as i32 - next_size.height as i32).max(0) / 2,
            ),
            next_size,
            bounds,
            margin,
        ),
    };
    rail_window_runtime().docked_left.store(
        rail_dock_side(position, next_size, bounds, margin) == RailDockSide::Left,
        Ordering::Release,
    );
    set_rail_position(app_handle, rail, position, rail_window_runtime())
        .map_err(|error| format!("Skribli could not dock the note rail: {error}"))
}

fn size_and_place_context_rail(
    app_handle: &AppHandle,
    rail: &WebviewWindow,
    target: &TargetWindowInfo,
    logical_width: f64,
    logical_height: f64,
) -> Result<(), String> {
    context_rail_window_runtime()
        .movement_generation
        .fetch_add(1, Ordering::AcqRel);
    let _ = rail.set_shadow(false);
    if rail.is_maximized().unwrap_or(false) {
        rail.unmaximize()
            .map_err(|error| format!("Skribli could not restore the in-app note bar: {error}"))?;
    }
    rail.set_resizable(false)
        .map_err(|error| format!("Skribli could not lock the in-app note bar size: {error}"))?;
    rail.set_maximizable(false).map_err(|error| {
        format!("Skribli could not disable in-app note bar maximization: {error}")
    })?;

    let previous_size = rail.outer_size().ok();
    let scale = if target.scale_factor.is_finite() && target.scale_factor > 0.0 {
        target.scale_factor
    } else {
        1.0
    };
    let bounds = RailDockBounds {
        x: target.bounds.x,
        y: target.bounds.y,
        width: target.bounds.width.max(0),
        height: target.bounds.height.max(0),
    };
    let next_size = PhysicalSize::new(
        (logical_width * scale).round().max(0.0) as u32,
        (logical_height * scale).round().max(0.0) as u32,
    );
    rail.set_size(next_size)
        .map_err(|error| format!("Skribli could not resize the in-app note bar: {error}"))?;
    let margin = (CONTEXT_RAIL_EDGE_MARGIN_LOGICAL * scale).round() as i32;
    let runtime = context_rail_window_runtime();
    let saved = runtime
        .context_placement()
        .filter(|placement| placement.target_hwnd == target.hwnd_val);
    let preferred = if let Some(placement) = saved {
        PhysicalPosition::new(
            bounds.x.saturating_add(placement.relative_x),
            bounds.y.saturating_add(placement.relative_y),
        )
    } else {
        let title_inset = (44.0 * scale).round() as i32;
        PhysicalPosition::new(
            bounds
                .x
                .saturating_add(bounds.width)
                .saturating_sub(next_size.width as i32)
                .saturating_sub(margin),
            bounds.y.saturating_add(title_inset.max(margin)),
        )
    };
    let position = match (saved, previous_size) {
        (Some(_), Some(previous_size)) if previous_size != next_size => {
            context_rail_position_after_size_change(
                preferred,
                previous_size,
                next_size,
                bounds,
                margin,
            )
        }
        _ => clamp_rail_position_to_bounds(preferred, next_size, bounds, margin),
    };
    set_rail_position(app_handle, rail, position, runtime).map_err(|error| {
        format!("Skribli could not place the note bar inside this app: {error}")
    })?;
    runtime.record_context_placement(target.hwnd_val, bounds, position);
    runtime.docked_left.store(
        rail_dock_side(position, next_size, bounds, margin) == RailDockSide::Left,
        Ordering::Release,
    );
    Ok(())
}

fn schedule_rail_edge_dock(
    app_handle: &AppHandle,
    label: &'static str,
    contextual: bool,
    position: PhysicalPosition<i32>,
) {
    let runtime = if contextual {
        context_rail_window_runtime()
    } else {
        rail_window_runtime()
    };
    if runtime.consume_programmatic_movement(position) {
        return;
    }
    let generation = runtime.begin_user_movement();
    let app_handle = app_handle.clone();
    std::thread::spawn(move || {
        std::thread::sleep(RAIL_DOCK_DEBOUNCE);
        // A pause during a drag is not a drop. Snap only after the user releases the mouse.
        #[cfg(target_os = "windows")]
        while unsafe {
            windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(
                windows::Win32::UI::Input::KeyboardAndMouse::VK_LBUTTON.0 as i32,
            )
        } < 0
        {
            if !runtime.movement_is_current(generation) {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        let state = app_handle.state::<AppState>();
        let Ok(_operation_guard) = state.native_window_operation_gate.lock() else {
            return;
        };
        if !runtime.movement_is_current(generation) {
            return;
        }
        let Some(rail) = app_handle.get_webview_window(label) else {
            return;
        };
        if !rail.is_visible().unwrap_or(false) {
            return;
        }
        let Ok(current_position) = rail.outer_position() else {
            return;
        };
        let Ok(window_size) = rail.outer_size() else {
            return;
        };
        let runtime = if contextual {
            context_rail_window_runtime()
        } else {
            rail_window_runtime()
        };
        if let Some(context) = runtime.context_placement() {
            let scale = rail.scale_factor().unwrap_or(1.0);
            let margin = (CONTEXT_RAIL_EDGE_MARGIN_LOGICAL * scale).round() as i32;
            let contained = clamp_rail_position_to_bounds(
                current_position,
                window_size,
                context.bounds,
                margin,
            );
            let _ = rail.set_always_on_top(true);
            if contained != current_position {
                let _ = set_rail_position(&app_handle, &rail, contained, runtime);
            }
            runtime.record_context_placement(context.target_hwnd, context.bounds, contained);
            runtime.docked_left.store(
                rail_dock_side(contained, window_size, context.bounds, margin)
                    == RailDockSide::Left,
                Ordering::Release,
            );
            emit_rail_window_state(&app_handle, true);
            return;
        }
        if contextual {
            return;
        }
        let monitor = rail
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| rail.primary_monitor().ok().flatten());
        let Some(monitor) = monitor else {
            return;
        };
        let work_area = monitor.work_area();
        let scale = monitor.scale_factor();
        let margin = (GLOBAL_RAIL_EDGE_MARGIN_LOGICAL * scale).round() as i32;
        let bounds = RailDockBounds {
            x: work_area.position.x,
            y: work_area.position.y,
            width: i32::try_from(work_area.size.width).unwrap_or(i32::MAX),
            height: i32::try_from(work_area.size.height).unwrap_or(i32::MAX),
        };
        let docked = nearest_rail_edge_position(current_position, window_size, bounds, margin);
        let _ = rail.set_always_on_top(true);
        if docked != current_position {
            let _ = set_rail_position(&app_handle, &rail, docked, runtime);
        }
        runtime.docked_left.store(
            rail_dock_side(docked, window_size, bounds, margin) == RailDockSide::Left,
            Ordering::Release,
        );
        emit_rail_window_state(&app_handle, false);
    });
}

fn set_runtime_active_target_unchecked(state: &AppState, target: Option<TargetWindowInfo>) {
    #[cfg(target_os = "windows")]
    state
        .win_event_pipeline
        .set_active_target(target.as_ref().map(|target| target.hwnd_val));
    state.coordinator.set_active_target(target);
}

fn set_runtime_active_target(state: &AppState, target: Option<TargetWindowInfo>) {
    let Ok(_operation_guard) = state.native_window_operation_gate.lock() else {
        return;
    };
    set_runtime_active_target_locked(state, target);
}

fn set_runtime_active_target_locked(state: &AppState, target: Option<TargetWindowInfo>) {
    let Ok(_commit_guard) = state.native_lifecycle_commit_lock.lock() else {
        return;
    };
    state
        .native_lifecycle_generation
        .fetch_add(1, Ordering::AcqRel);
    set_runtime_active_target_unchecked(state, target);
}

fn begin_native_lifecycle_action(state: &AppState) -> Result<u64, String> {
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    Ok(state
        .native_lifecycle_generation
        .fetch_add(1, Ordering::AcqRel)
        .saturating_add(1))
}

fn native_lifecycle_action_is_current(state: &AppState, generation: u64) -> bool {
    state.native_lifecycle_generation.load(Ordering::Acquire) == generation
}

fn lifecycle_snapshot_can_clear_target(
    expected_generation: u64,
    current_generation: u64,
    expected_hwnd: isize,
    current_target: Option<&TargetWindowInfo>,
) -> bool {
    expected_generation == current_generation
        && current_target.map(|target| target.hwnd_val) == Some(expected_hwnd)
}

fn dismissal_snapshot_can_commit(
    expected_generation: u64,
    current_generation: u64,
    note_id: &str,
    expected_hwnd: isize,
    active_note_id: Option<&str>,
    current_target: Option<&TargetWindowInfo>,
) -> bool {
    expected_generation == current_generation
        && active_note_id == Some(note_id)
        && current_target.map(|target| target.hwnd_val) == Some(expected_hwnd)
}

fn dismissed_restore_can_commit(
    show_succeeded: bool,
    expected_generation: u64,
    current_generation: u64,
    expected: &DismissedCollapsedWindow,
    current: Option<&DismissedCollapsedWindow>,
) -> bool {
    show_succeeded && expected_generation == current_generation && current == Some(expected)
}

fn active_note_removal_requires_full_clear(active_note_id: Option<&str>, note_id: &str) -> bool {
    active_note_id == Some(note_id)
}

fn commit_refreshed_target_if_current(
    state: &AppState,
    generation: u64,
    expected_hwnd: isize,
    target: TargetWindowInfo,
) -> Result<bool, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    commit_refreshed_target_if_current_locked(state, generation, expected_hwnd, target)
}

fn commit_refreshed_target_if_current_locked(
    state: &AppState,
    generation: u64,
    expected_hwnd: isize,
    target: TargetWindowInfo,
) -> Result<bool, String> {
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let current_target = state.coordinator.get_active_target();
    if !lifecycle_snapshot_can_clear_target(
        generation,
        current_generation,
        expected_hwnd,
        current_target.as_ref(),
    ) {
        return Ok(false);
    }
    set_runtime_active_target_unchecked(state, Some(target));
    Ok(true)
}

fn record_note_placement_if_current(
    state: &AppState,
    generation: u64,
    target_hwnd: isize,
    note_id: &str,
    workspace_expanded: bool,
    metrics: &OverlayMetrics,
) -> Result<bool, String> {
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let current_target = state.coordinator.get_active_target();
    if !lifecycle_snapshot_can_clear_target(
        generation,
        current_generation,
        target_hwnd,
        current_target.as_ref(),
    ) {
        return Ok(false);
    }
    let mut runtime = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?;
    runtime.record_programmatic_placement(note_id, workspace_expanded, metrics);
    Ok(true)
}

fn hide_main_note_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        #[cfg(target_os = "windows")]
        let _ = restore_standard_window_surface(&window);
    }
    let _ = show_global_note_rail(app_handle.clone());
}

fn hide_context_note_rail(app_handle: &AppHandle) {
    let runtime = context_rail_window_runtime();
    runtime.movement_generation.fetch_add(1, Ordering::AcqRel);
    if let Ok(mut target) = runtime.foreground_target.lock() {
        *target = None;
    }
    runtime.revealed.store(false, Ordering::Release);
    #[cfg(target_os = "windows")]
    app_handle
        .state::<AppState>()
        .win_event_pipeline
        .set_context_target(None);
    context_rail_window_runtime().clear_context_placement();
    context_rail_window_runtime()
        .expanded
        .store(false, Ordering::Release);
    if let Some(window) = app_handle.get_webview_window("context-rail") {
        let _ = window.hide();
    }
    emit_rail_window_state(app_handle, true);
}

#[tauri::command]
fn show_global_note_rail(app_handle: AppHandle) -> Result<(), String> {
    let rail = app_handle
        .get_webview_window("rail")
        .ok_or_else(|| "My Skribs rail is unavailable.".to_string())?;
    let (width, height) = rail_surface_dimensions(
        rail_window_runtime().expanded.load(Ordering::Acquire),
        false,
    );
    rail.set_always_on_top(true)
        .map_err(|error| format!("Skribli could not dock the desktop note pill: {error}"))?;
    rail_window_runtime().clear_context_placement();
    size_and_dock_rail(&app_handle, &rail, width, height)?;

    let _ = app_handle.emit("skribly://global-rail-refresh", ());
    rail.show()
        .map_err(|error| format!("Skribli could not show the desktop note pill: {error}"))?;
    emit_rail_window_state(&app_handle, false);
    Ok(())
}

fn context_rail_notes_for_active_target(state: &AppState) -> Vec<SkribNote> {
    context_rail_window_runtime()
        .foreground_target()
        .map(|target| {
            state
                .coordinator
                .get_skribs_for_target(&target)
                .into_iter()
                .filter(SkribNote::is_active)
                .collect()
        })
        .unwrap_or_default()
}

fn show_context_rail_for_target(
    app_handle: &AppHandle,
    state: &AppState,
    target: &TargetWindowInfo,
) -> Result<bool, String> {
    if context_rail_window_runtime().is_suppressed(target) {
        hide_context_note_rail(app_handle);
        return Ok(false);
    }
    let note_count = state
        .coordinator
        .get_skribs_for_target(target)
        .into_iter()
        .filter(SkribNote::is_active)
        .count();
    if note_count == 0 {
        hide_context_note_rail(app_handle);
        return Ok(false);
    }
    let Some(rail) = app_handle.get_webview_window("context-rail") else {
        return Ok(false);
    };
    context_rail_window_runtime().arrive(target);
    #[cfg(target_os = "windows")]
    state
        .win_event_pipeline
        .set_context_target(Some(target.hwnd_val));
    let (width, height) = context_rail_surface_dimensions(get_rail_window_state(true));
    rail.set_always_on_top(true)
        .map_err(|error| format!("Skribli could not attach the note rail to this app: {error}"))?;
    size_and_place_context_rail(app_handle, &rail, target, width, height)?;

    let _ = app_handle.emit("skribly://context-rail-refresh", note_count);
    rail.show()
        .map_err(|error| format!("Skribli could not show the note rail: {error}"))?;
    emit_rail_window_state(app_handle, true);
    Ok(true)
}

fn sync_context_note_rail_for_target(
    app_handle: &AppHandle,
    state: &AppState,
    target: &TargetWindowInfo,
) {
    let has_notes = state
        .coordinator
        .get_skribs_for_target(target)
        .into_iter()
        .any(|note| note.is_active());
    if has_notes {
        let _ = show_context_rail_for_target(app_handle, state, target);
    } else {
        hide_context_note_rail(app_handle);
    }
}

#[cfg(target_os = "windows")]
fn sync_context_presence_event(app: &AppHandle, state: &AppState, event: u32, hwnd: isize) {
    let Ok(_operation) = state.native_window_operation_gate.lock() else {
        return;
    };
    let runtime = context_rail_window_runtime();
    let current = runtime.foreground_target();
    let owns_target = current
        .as_ref()
        .is_some_and(|target| target.hwnd_val == hwnd);
    if event == EVENT_SYSTEM_FOREGROUND {
        let target = reconstruct_hwnd(hwnd)
            .and_then(inspect_target_window)
            .filter(|target| target.is_focused && !target.is_minimized);
        if let Some(target) = target {
            if !runtime.is_suppressed(&target) {
                if let Ok(mut suppressed) = runtime.suppressed_context.lock() {
                    *suppressed = None;
                }
            }
            sync_context_note_rail_for_target(app, state, &target);
        } else {
            hide_context_note_rail(app);
        }
    } else if owns_target {
        if matches!(
            event,
            EVENT_OBJECT_DESTROY | EVENT_OBJECT_HIDE | EVENT_SYSTEM_MINIMIZESTART
        ) {
            hide_context_note_rail(app);
        } else if matches!(
            event,
            EVENT_OBJECT_LOCATIONCHANGE | EVENT_OBJECT_NAMECHANGE | EVENT_SYSTEM_MINIMIZEEND
        ) {
            let target = reconstruct_hwnd(hwnd)
                .and_then(inspect_target_window)
                .filter(|target| {
                    !target.is_minimized
                        && current
                            .as_ref()
                            .is_some_and(|old| old.process_name == target.process_name)
                });
            if let Some(target) = target {
                sync_context_note_rail_for_target(app, state, &target);
            } else {
                hide_context_note_rail(app);
            }
        }
    }
}

fn hide_main_note_window_as_lifecycle_action(app_handle: &AppHandle, state: &AppState) {
    let Ok(_operation_guard) = state.native_window_operation_gate.lock() else {
        return;
    };
    let Ok(generation) = begin_native_lifecycle_action(state) else {
        return;
    };
    if native_lifecycle_action_is_current(state, generation) {
        hide_main_note_window(app_handle);
    }
}

fn clear_active_target_and_hide_note(app_handle: &AppHandle, state: &AppState) {
    let Ok(_operation_guard) = state.native_window_operation_gate.lock() else {
        return;
    };
    clear_active_target_and_hide_note_locked(app_handle, state);
}

fn clear_active_target_and_hide_note_locked(app_handle: &AppHandle, state: &AppState) {
    let generation = {
        let Ok(_commit_guard) = state.native_lifecycle_commit_lock.lock() else {
            return;
        };
        let generation = state
            .native_lifecycle_generation
            .fetch_add(1, Ordering::AcqRel)
            .saturating_add(1);
        set_runtime_active_target_unchecked(state, None);
        if let Ok(mut runtime) = state.note_window_runtime.lock() {
            runtime.clear();
        }
        generation
    };
    // A newer open/restore action owns the physical window if it started after this clear.
    if native_lifecycle_action_is_current(state, generation) {
        hide_main_note_window(app_handle);
        hide_context_note_rail(app_handle);
    }
}

fn clear_active_target_and_hide_note_if_current(
    app_handle: &AppHandle,
    state: &AppState,
    expected_generation: u64,
    expected_hwnd: isize,
) -> bool {
    let Ok(_operation_guard) = state.native_window_operation_gate.lock() else {
        return false;
    };
    clear_active_target_and_hide_note_if_current_locked(
        app_handle,
        state,
        expected_generation,
        expected_hwnd,
    )
}

fn clear_active_target_and_hide_note_if_current_locked(
    app_handle: &AppHandle,
    state: &AppState,
    expected_generation: u64,
    expected_hwnd: isize,
) -> bool {
    let generation = {
        let Ok(_commit_guard) = state.native_lifecycle_commit_lock.lock() else {
            return false;
        };
        let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
        let current_target = state.coordinator.get_active_target();
        if !lifecycle_snapshot_can_clear_target(
            expected_generation,
            current_generation,
            expected_hwnd,
            current_target.as_ref(),
        ) {
            return false;
        }
        let generation = state
            .native_lifecycle_generation
            .fetch_add(1, Ordering::AcqRel)
            .saturating_add(1);
        set_runtime_active_target_unchecked(state, None);
        if let Ok(mut runtime) = state.note_window_runtime.lock() {
            runtime.clear();
        }
        generation
    };
    if native_lifecycle_action_is_current(state, generation) {
        hide_main_note_window(app_handle);
        hide_context_note_rail(app_handle);
    }
    true
}

fn hide_if_active_note_was_removed(app_handle: &AppHandle, state: &AppState, note_id: &str) {
    let removed_active_note = state
        .note_window_runtime
        .lock()
        .map(|runtime| active_note_removal_requires_full_clear(runtime.active_note_id(), note_id))
        .unwrap_or(false);
    if removed_active_note {
        // Removing the active note must clear all three native sources of truth: coordinator,
        // WinEvent filtering, and the note runtime. A window-only hide leaves a stale HWND in the
        // event pipeline that can later re-open or reposition the deleted note.
        clear_active_target_and_hide_note(app_handle, state);
    }
}

fn dismissed_collapsed_target_matches(
    dismissed: &DismissedCollapsedWindow,
    note: &SkribNote,
    target: &TargetWindowInfo,
) -> bool {
    note.id == dismissed.note_id
        && note.is_active()
        && target.is_focused
        && !dismissed.target_title.trim().is_empty()
        && note
            .target_process_name
            .eq_ignore_ascii_case(&dismissed.target_process_name)
        && core::preferences::note_belongs_to_context(note, target)
        && target
            .process_name
            .eq_ignore_ascii_case(&dismissed.target_process_name)
        && (!core::preferences::is_browser(&target.process_name)
            || target.match_score(&dismissed.target_process_name, &dismissed.target_title) >= 75)
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DismissedTargetEventTransition {
    Ignore,
    Arm,
    Restore,
}

#[cfg(target_os = "windows")]
fn classify_dismissed_target_event(
    event_type: u32,
    dismissed: &DismissedCollapsedWindow,
    note: &SkribNote,
    candidate: &TargetWindowInfo,
) -> DismissedTargetEventTransition {
    if !matches!(
        event_type,
        EVENT_SYSTEM_FOREGROUND | EVENT_OBJECT_NAMECHANGE
    ) {
        return DismissedTargetEventTransition::Ignore;
    }

    if dismissed_collapsed_target_matches(dismissed, note, candidate) {
        return if dismissed.armed {
            DismissedTargetEventTransition::Restore
        } else {
            // Clicking the dot's close button returns foreground to the linked target. That
            // immediate bounce is part of dismissal and must not resurrect the dot.
            DismissedTargetEventTransition::Ignore
        };
    }

    if dismissed.armed || !candidate.is_focused {
        return DismissedTargetEventTransition::Ignore;
    }

    let unrelated_foreground = event_type == EVENT_SYSTEM_FOREGROUND;
    let same_window_context_changed = event_type == EVENT_OBJECT_NAMECHANGE
        && candidate.hwnd_val == dismissed.target_hwnd
        && candidate
            .process_name
            .eq_ignore_ascii_case(&dismissed.target_process_name)
        && core::preferences::is_browser(&candidate.process_name)
        && candidate.match_score(&dismissed.target_process_name, &dismissed.target_title) < 75;
    if unrelated_foreground || same_window_context_changed {
        DismissedTargetEventTransition::Arm
    } else {
        DismissedTargetEventTransition::Ignore
    }
}

#[cfg(target_os = "windows")]
fn collapsed_dot_should_hide_for_context(
    event_type: u32,
    note: &SkribNote,
    linked_target: &TargetWindowInfo,
    candidate: &TargetWindowInfo,
) -> bool {
    if !note.collapsed || !note.is_active() || !candidate.is_focused {
        return false;
    }
    let relevant_event = event_type == EVENT_SYSTEM_FOREGROUND
        || (event_type == EVENT_OBJECT_NAMECHANGE && candidate.hwnd_val == linked_target.hwnd_val);
    if !relevant_event {
        return false;
    }
    let exact_linked_context = candidate.hwnd_val == linked_target.hwnd_val
        && refreshed_target_preserves_identity(linked_target, candidate)
        && core::preferences::note_belongs_to_context(note, candidate);
    !exact_linked_context
}

#[cfg(target_os = "windows")]
fn active_note_should_hide_for_context(
    event_type: u32,
    note: &SkribNote,
    linked_target: &TargetWindowInfo,
    candidate: &TargetWindowInfo,
) -> bool {
    if note.collapsed {
        return collapsed_dot_should_hide_for_context(event_type, note, linked_target, candidate);
    }
    if !note.is_active() || !candidate.is_focused {
        return false;
    }
    let relevant_event = event_type == EVENT_SYSTEM_FOREGROUND
        || (event_type == EVENT_OBJECT_NAMECHANGE && candidate.hwnd_val == linked_target.hwnd_val);
    if !relevant_event {
        return false;
    }
    let exact_linked_context = candidate.hwnd_val == linked_target.hwnd_val
        && refreshed_target_preserves_identity(linked_target, candidate)
        && core::preferences::note_belongs_to_context(note, candidate);
    !exact_linked_context
}

fn refreshed_target_preserves_identity(
    active: &TargetWindowInfo,
    refreshed: &TargetWindowInfo,
) -> bool {
    active.hwnd_val == refreshed.hwnd_val
        && active
            .process_name
            .eq_ignore_ascii_case(&refreshed.process_name)
        && active
            .class_name
            .eq_ignore_ascii_case(&refreshed.class_name)
}

#[cfg(target_os = "windows")]
fn restore_dismissed_collapsed_window_for_target(
    app_handle: &AppHandle,
    state: &AppState,
    target: &TargetWindowInfo,
) -> Result<bool, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let generation = begin_native_lifecycle_action(state)?;
    let dismissed = state
        .note_window_runtime
        .lock()
        .ok()
        .and_then(|runtime| runtime.dismissed_collapsed_window().cloned());
    let Some(dismissed) = dismissed else {
        return Ok(false);
    };
    if !dismissed.armed {
        return Ok(false);
    }
    let Some(note) = state.coordinator.get_skrib(&dismissed.note_id) else {
        clear_dismissed_lifecycle_if_current(state, generation, &dismissed);
        return Ok(false);
    };
    if !note.is_active() {
        clear_dismissed_lifecycle_if_current(state, generation, &dismissed);
        return Ok(false);
    }
    if !dismissed_collapsed_target_matches(&dismissed, &note, target) {
        return Ok(false);
    }

    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The collapsed Skrib window is unavailable.".to_string())?;
    let metrics = position_note_window_for_target(&window, target, &note, note.collapsed)?;
    window
        .show()
        .map_err(|error| format!("Skribli could not restore the collapsed note: {error}"))?;

    // Keep the dismissal available for retry until the fallible native show succeeds. Only the
    // action that still owns the same generation and dismissal identity may publish the restored
    // target/runtime; a newer hotkey, delete, dismiss, or watchdog action wins instead.
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let mut runtime = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?;
    if !dismissed_restore_can_commit(
        true,
        generation,
        current_generation,
        &dismissed,
        runtime.dismissed_collapsed_window(),
    ) {
        return Ok(false);
    }
    runtime.record_programmatic_placement(
        &note.id,
        !note.collapsed && note.width > COMPACT_WINDOW_LOGICAL_WIDTH as f64,
        &metrics,
    );
    drop(runtime);
    set_runtime_active_target_unchecked(state, Some(target.clone()));
    let _ = show_context_rail_for_target(app_handle, state, target);
    Ok(true)
}

fn clear_dismissed_lifecycle_if_current(
    state: &AppState,
    generation: u64,
    dismissed: &DismissedCollapsedWindow,
) {
    let Ok(_commit_guard) = state.native_lifecycle_commit_lock.lock() else {
        return;
    };
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let Ok(mut runtime) = state.note_window_runtime.lock() else {
        return;
    };
    if !dismissed_restore_can_commit(
        true,
        generation,
        current_generation,
        dismissed,
        runtime.dismissed_collapsed_window(),
    ) {
        return;
    }
    state
        .native_lifecycle_generation
        .fetch_add(1, Ordering::AcqRel);
    runtime.clear();
    drop(runtime);
    set_runtime_active_target_unchecked(state, None);
}

fn dismissed_lifecycle_snapshot(state: &AppState) -> Option<(u64, DismissedCollapsedWindow)> {
    let _operation_guard = state.native_window_operation_gate.lock().ok()?;
    let generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let dismissed = state
        .note_window_runtime
        .lock()
        .ok()?
        .dismissed_collapsed_window()
        .cloned()?;
    Some((generation, dismissed))
}

fn arm_dismissed_lifecycle_if_current(
    state: &AppState,
    expected_generation: u64,
    expected: &DismissedCollapsedWindow,
) -> Result<bool, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    if state.native_lifecycle_generation.load(Ordering::Acquire) != expected_generation {
        return Ok(false);
    }
    let mut runtime = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?;
    if !runtime.arm_dismissed_collapsed_window(expected) {
        return Ok(false);
    }
    state
        .native_lifecycle_generation
        .fetch_add(1, Ordering::AcqRel);
    Ok(true)
}

#[cfg(target_os = "windows")]
fn hide_active_note_for_unrelated_context(
    app_handle: &AppHandle,
    state: &AppState,
    event_type: u32,
    candidate: &TargetWindowInfo,
) -> Result<bool, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let linked_target = match state.coordinator.get_active_target() {
        Some(target) => target,
        None => return Ok(false),
    };
    let note_id = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?
        .active_note_id()
        .map(ToString::to_string);
    let Some(note) = note_id.and_then(|id| state.coordinator.get_skrib(&id)) else {
        return Ok(false);
    };
    if !active_note_should_hide_for_context(event_type, &note, &linked_target, candidate) {
        return Ok(false);
    }

    let generation = begin_native_lifecycle_action(state)?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The Skrib window is unavailable.".to_string())?;
    window
        .hide()
        .map_err(|error| format!("Skribli could not hide the inactive note: {error}"))?;
    let _ = show_global_note_rail(app_handle.clone());
    hide_context_note_rail(app_handle);
    let _ = restore_standard_window_surface(&window);

    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let current_target = state.coordinator.get_active_target();
    let mut runtime = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?;
    if !dismissal_snapshot_can_commit(
        generation,
        current_generation,
        &note.id,
        linked_target.hwnd_val,
        runtime.active_note_id(),
        current_target.as_ref(),
    ) {
        return Ok(false);
    }
    runtime.hide_active_note_until_context_returns(&note, &linked_target);
    Ok(true)
}

#[cfg(target_os = "windows")]
fn present_target_capture_error_locked(
    app_handle: &AppHandle,
    state: &AppState,
    error: TargetCaptureError,
) {
    clear_active_target_and_hide_note_locked(app_handle, state);
    let _ = app_handle.emit("skribly://target-capture-error", error);
    if let Some(window) = app_handle.get_webview_window("main") {
        if let Err(message) = prepare_standard_compact_surface(&window) {
            let _ = app_handle.emit(
                "skribly://hotkey-error",
                format!("Skribli could not prepare the recovery window safely: {message}"),
            );
            return;
        }
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(target_os = "windows")]
fn clear_target_capture_error(app_handle: &AppHandle) {
    let _ = app_handle.emit("skribly://target-capture-clear", ());
}

fn persist_skribs(state: &AppState) -> Result<(), String> {
    let skribs = state.coordinator.get_all_skribs();
    let result = {
        let mut storage = state
            .storage
            .lock()
            .map_err(|_| "Local storage service is unavailable".to_string())?;
        storage
            .save(&skribs)
            .map(|_| ())
            .map_err(|error| error.to_string())
    };

    match result {
        Ok(()) => {
            state.clear_storage_error();
            Ok(())
        }
        Err(message) => {
            state.record_storage_error(message.clone());
            Err(message)
        }
    }
}

fn run_persisted_mutation<T>(
    state: &AppState,
    mutation: impl FnOnce(&Coordinator) -> Result<T, String>,
) -> Result<T, String> {
    let _mutation_guard = state
        .mutation_lock
        .lock()
        .map_err(|_| "Local note mutation lock is unavailable".to_string())?;
    let previous = state.coordinator.get_all_skribs();
    let result = mutation(&state.coordinator)?;

    if let Err(message) = persist_skribs(state) {
        state.coordinator.replace_all_skribs(previous);
        return Err(message);
    }
    Ok(result)
}

impl AppState {
    pub fn set_init_status(&self, status: OverlayInitializationStatus) {
        if let Ok(mut lock) = self.init_status.lock() {
            *lock = status;
        }
    }

    pub fn get_init_status(&self) -> OverlayInitializationStatus {
        if let Ok(lock) = self.init_status.lock() {
            lock.clone()
        } else {
            OverlayInitializationStatus::Initializing
        }
    }

    fn set_storage_notice(&self, notice: Option<storage::StorageNotice>) {
        if let Ok(mut lock) = self.storage_notice.lock() {
            *lock = notice;
        }
    }

    fn record_storage_error(&self, message: String) {
        if let Ok(mut lock) = self.storage_error.lock() {
            *lock = Some(message);
        }
    }

    fn clear_storage_error(&self) {
        if let Ok(mut lock) = self.storage_error.lock() {
            *lock = None;
        }
    }

    fn storage_health(&self) -> StorageHealthPayload {
        let notice = self
            .storage_notice
            .lock()
            .ok()
            .and_then(|notice| notice.clone());
        let mut error = self
            .storage_error
            .lock()
            .ok()
            .and_then(|message| message.clone());

        let (writable, revision, backup_directory) = match self.storage.lock() {
            Ok(storage) => {
                if error.is_none() {
                    error = storage.blocked_reason().map(ToString::to_string);
                }
                (
                    storage.is_writable(),
                    storage.current_revision(),
                    storage
                        .primary_path()
                        .parent()
                        .map(|path| path.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                )
            }
            Err(_) => {
                if error.is_none() {
                    error = Some("Local storage service is unavailable".to_string());
                }
                (false, 0, String::new())
            }
        };

        StorageHealthPayload {
            notice,
            error,
            writable,
            revision,
            backup_directory,
        }
    }
}

#[tauri::command]
fn get_foreground_window() -> Option<TargetWindowInfo> {
    #[cfg(target_os = "windows")]
    {
        capture_foreground_target()
            .ok()
            .and_then(|capture| revalidate_captured_target(&capture).ok())
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[tauri::command]
fn list_target_windows() -> Vec<TargetWindowInfo> {
    #[cfg(target_os = "windows")]
    {
        list_candidate_target_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

#[tauri::command]
fn get_app_icon(process_name: String) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        platform::windows_icons::app_icon_data_url(&process_name)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = process_name;
        None
    }
}

#[tauri::command]
fn get_overlay_metrics(app_handle: AppHandle) -> OverlayMetrics {
    get_current_overlay_metrics(&app_handle)
}

fn get_current_overlay_metrics(app_handle: &AppHandle) -> OverlayMetrics {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app_handle.get_webview_window("main") {
            if let Ok(hwnd) = window.hwnd() {
                let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
                return query_overlay_metrics(win_hwnd);
            }
        }
    }
    OverlayMetrics::default()
}

fn build_overlay_payload(
    app_handle: &AppHandle,
    state: &AppState,
    is_ambiguous: bool,
) -> OverlayStatePayload {
    let active_target = state.coordinator.get_active_target();
    let skribs = runtime_visible_skribs(state, active_target.as_ref());
    let available_windows = list_target_windows();
    let overlay_metrics = get_current_overlay_metrics(app_handle);
    let init_status = state.get_init_status();

    OverlayStatePayload {
        active_target,
        skribs,
        available_windows,
        is_shortcut_active: false,
        is_ambiguous,
        overlay_metrics,
        init_status,
    }
}

fn build_mutation_payload(
    app_handle: &AppHandle,
    state: &AppState,
    is_ambiguous: bool,
) -> OverlayStatePayload {
    let active_target = state.coordinator.get_active_target();
    let skribs = runtime_visible_skribs(state, active_target.as_ref());
    let overlay_metrics = get_current_overlay_metrics(app_handle);
    let init_status = state.get_init_status();

    OverlayStatePayload {
        active_target,
        skribs,
        available_windows: Vec::new(),
        is_shortcut_active: false,
        is_ambiguous,
        overlay_metrics,
        init_status,
    }
}

fn runtime_visible_skribs(state: &AppState, target: Option<&TargetWindowInfo>) -> Vec<SkribNote> {
    let detached_id = state
        .note_window_runtime
        .lock()
        .ok()
        .and_then(|runtime| runtime.detached_note_id().map(str::to_owned));
    if let Some(id) = detached_id {
        return state
            .coordinator
            .get_skrib(&id)
            .filter(SkribNote::is_active)
            .map(|mut note| {
                note.collapsed = false;
                vec![note]
            })
            .unwrap_or_default();
    }
    visible_skribs(&state.coordinator, target)
}

fn rail_surface_dimensions(expanded: bool, contextual: bool) -> (f64, f64) {
    if expanded && contextual {
        (460.0, 250.0)
    } else if expanded {
        (RAIL_EXPANDED_WIDTH, RAIL_EXPANDED_HEIGHT)
    } else if contextual {
        (CONTEXT_RAIL_COLLAPSED_WIDTH, CONTEXT_RAIL_COLLAPSED_HEIGHT)
    } else {
        (GLOBAL_RAIL_COLLAPSED_WIDTH, GLOBAL_RAIL_COLLAPSED_HEIGHT)
    }
}

fn context_rail_surface_dimensions(state: RailWindowState) -> (f64, f64) {
    if !state.expanded && state.revealed {
        (CONTEXT_RAIL_PEEK_WIDTH, CONTEXT_RAIL_PEEK_HEIGHT)
    } else {
        rail_surface_dimensions(state.expanded, true)
    }
}

fn context_rail_position_after_size_change(
    position: PhysicalPosition<i32>,
    previous: PhysicalSize<u32>,
    next: PhysicalSize<u32>,
    bounds: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    // Unfold inward on either side instead of pushing a left-hand indicator off-screen.
    let preferred = PhysicalPosition::new(
        if rail_dock_side(position, previous, bounds, margin) == RailDockSide::Left {
            position.x
        } else {
            position
                .x
                .saturating_add(previous.width as i32)
                .saturating_sub(next.width as i32)
        },
        position
            .y
            .saturating_add((previous.height as i32 - next.height as i32) / 2),
    );
    clamp_rail_position_to_bounds(preferred, next, bounds, margin)
}

fn visible_skribs(
    coordinator: &Coordinator,
    active_target: Option<&TargetWindowInfo>,
) -> Vec<SkribNote> {
    active_target
        .map(|target| coordinator.get_skribs_for_target(target))
        .unwrap_or_default()
}

const NOTE_COLOR_ROTATION: [&str; 8] = [
    "yellow", "peach", "mint", "sky", "lavender", "rose", "aqua", "sand",
];

fn next_note_color(notes: &[SkribNote]) -> String {
    let Some(latest) = notes
        .iter()
        .filter(|note| note.is_active())
        .max_by(|left, right| {
            left.created_at
                .cmp(&right.created_at)
                .then_with(|| left.id.cmp(&right.id))
        })
    else {
        return NOTE_COLOR_ROTATION[0].into();
    };
    let next_index = NOTE_COLOR_ROTATION
        .iter()
        .position(|color| *color == latest.color)
        .map(|index| (index + 1) % NOTE_COLOR_ROTATION.len())
        .unwrap_or(0);
    NOTE_COLOR_ROTATION[next_index].into()
}

fn relative_note_position(
    target: &TargetWindowInfo,
    physical_x: i32,
    physical_y: i32,
) -> (f64, f64) {
    let scale_factor = if target.scale_factor.is_finite() && target.scale_factor > 0.0 {
        target.scale_factor
    } else {
        1.0
    };
    (
        (physical_x - target.bounds.x) as f64 / scale_factor,
        (physical_y - target.bounds.y) as f64 / scale_factor,
    )
}

fn position_to_persist(
    target: &TargetWindowInfo,
    note: &SkribNote,
    physical_x: i32,
    physical_y: i32,
    workspace_expanded: bool,
) -> (f64, f64) {
    if workspace_expanded {
        (note.rel_x, note.rel_y)
    } else {
        relative_note_position(target, physical_x, physical_y)
    }
}

#[cfg(target_os = "windows")]
fn position_active_note_window(
    window: &tauri::WebviewWindow,
    state: &AppState,
    target: &TargetWindowInfo,
) -> Result<OverlayMetrics, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    position_active_note_window_locked(window, state, target)
}

#[cfg(target_os = "windows")]
fn position_active_note_window_locked(
    window: &tauri::WebviewWindow,
    state: &AppState,
    target: &TargetWindowInfo,
) -> Result<OverlayMetrics, String> {
    let generation = begin_native_lifecycle_action(state)?;
    let current_target = state
        .coordinator
        .get_active_target()
        .ok_or_else(|| "The native note target was cleared before repositioning.".to_string())?;
    if !refreshed_target_preserves_identity(&current_target, target) {
        return Err("The native note target changed before repositioning.".into());
    }
    let runtime_note_id = state
        .note_window_runtime
        .lock()
        .ok()
        .and_then(|runtime| runtime.active_note_id().map(ToString::to_string));
    let mut note = runtime_note_id
        .and_then(|note_id| state.coordinator.get_skrib(&note_id))
        .filter(|note| {
            note.is_active()
                && note
                    .target_process_name
                    .eq_ignore_ascii_case(&target.process_name)
        })
        .or_else(|| {
            let request = reopened_open_request(state.coordinator.get_skribs_for_target(target))?;
            state.coordinator.get_skrib(&request.note_id)
        })
        .ok_or_else(|| "No active Skrib is available for this application.".to_string())?;
    if let Some((width, height)) = state
        .note_window_runtime
        .lock()
        .ok()
        .and_then(|runtime| runtime.borrowed_dimensions_for(&note.id))
    {
        note.width = width;
        note.height = height;
    }
    let workspace_expanded = state
        .note_window_runtime
        .lock()
        .map(|runtime| runtime.workspace_expanded_for(&note.id))
        .unwrap_or(false);
    let metrics = if workspace_expanded {
        position_note_workspace_for_target(window, target, &note)?
    } else {
        position_note_window_for_target(window, target, &note, note.collapsed)?
    };
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let current_target = state.coordinator.get_active_target();
    if lifecycle_snapshot_can_clear_target(
        generation,
        current_generation,
        target.hwnd_val,
        current_target.as_ref(),
    ) {
        let mut runtime = state
            .note_window_runtime
            .lock()
            .map_err(|_| "The native note window state is unavailable.".to_string())?;
        runtime.record_programmatic_placement(&note.id, workspace_expanded, &metrics);
        drop(runtime);
        set_runtime_active_target_unchecked(state, Some(target.clone()));
    }
    Ok(metrics)
}

#[cfg(target_os = "windows")]
fn initialize_native_overlay(
    app_handle: &AppHandle,
    state: &AppState,
    window: &tauri::WebviewWindow,
) -> OverlayInitializationStatus {
    let result = (|| {
        let hwnd = window
            .hwnd()
            .map_err(|error| format!("Failed to acquire compact editor HWND: {error}"))?;
        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
        let metrics = initialize_compact_window(window)?;

        install_overlay_subclass(win_hwnd, state.coordinator.clone())?;

        if !install_winevent_hooks(state.win_event_pipeline.clone()) {
            return Err("Failed to install required Windows event hooks".into());
        }

        Ok(metrics)
    })();

    let status = match result {
        Ok(metrics) => OverlayInitializationStatus::Ready(metrics),
        Err(message) => {
            if let Ok(hwnd) = window.hwnd() {
                let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
                uninstall_overlay_subclass(win_hwnd);
            }
            uninstall_winevent_hooks();
            OverlayInitializationStatus::Failed(message)
        }
    };
    state.set_init_status(status.clone());
    let _ = app_handle.emit("skribly://overlay-init-status", status.clone());
    status
}

#[tauri::command]
fn retry_overlay_initialization(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> OverlayStatePayload {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app_handle.get_webview_window("main") {
            match state.native_window_operation_gate.lock() {
                Ok(_operation_guard) => {
                    initialize_native_overlay(&app_handle, &state, &window);
                }
                Err(message) => {
                    let status = OverlayInitializationStatus::Failed(message);
                    state.set_init_status(status.clone());
                    let _ = app_handle.emit("skribly://overlay-init-status", status);
                }
            }
        }
    }
    build_overlay_payload(&app_handle, &state, false)
}

#[tauri::command]
fn reposition_compact_window(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<OverlayMetrics, String> {
    #[cfg(target_os = "windows")]
    {
        let target = state
            .coordinator
            .get_active_target()
            .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
        let hwnd = reconstruct_hwnd(target.hwnd_val)
            .ok_or_else(|| "The original target application is no longer available.".to_string())?;
        let refreshed_target = inspect_target_window(hwnd)
            .ok_or_else(|| "Windows could not refresh the target application.".to_string())?;
        let window = app_handle
            .get_webview_window("main")
            .ok_or_else(|| "The compact editor window is unavailable.".to_string())?;
        let _operation_guard = state.native_window_operation_gate.lock()?;
        let workspace_expanded = state
            .note_window_runtime
            .lock()
            .map(|runtime| runtime.workspace_is_expanded())
            .unwrap_or(false);
        let metrics = if workspace_expanded {
            // Repositioning an expanded Draw/Files/Reminder surface must preserve the workspace
            // dimensions. This path also records the programmatic move so it cannot overwrite
            // the user's saved compact/dot anchor through the frontend onMoved listener.
            position_active_note_window_locked(&window, &state, &refreshed_target)?
        } else {
            let generation = begin_native_lifecycle_action(&state)?;
            let metrics = position_compact_window_for_target(&window, &refreshed_target)?;
            let _ = commit_refreshed_target_if_current_locked(
                &state,
                generation,
                target.hwnd_val,
                refreshed_target.clone(),
            )?;
            metrics
        };
        Ok(metrics)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app_handle, state);
        Err("Compact editor repositioning is currently available on Windows only.".into())
    }
}

#[tauri::command]
fn set_active_target(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    target: Option<TargetWindowInfo>,
) -> OverlayStatePayload {
    if let Some(target) = target {
        if let Ok(mut runtime) = state.note_window_runtime.lock() {
            runtime.clear();
        }
        set_runtime_active_target(&state, Some(target));
    } else {
        clear_active_target_and_hide_note(&app_handle, &state);
    }
    build_overlay_payload(&app_handle, &state, false)
}

#[tauri::command]
fn get_storage_health(state: State<'_, AppState>) -> StorageHealthPayload {
    state.storage_health()
}

#[tauri::command]
fn export_storage_diagnostics(state: State<'_, AppState>) -> Result<String, String> {
    let storage = state
        .storage
        .lock()
        .map_err(|_| "Local storage service is unavailable".to_string())?;
    storage
        .export_diagnostics()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    note: SkribNote,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .upsert_skrib(note)
            .then_some(())
            .ok_or_else(|| "Skrib note input is invalid or storage is read-only".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn update_skrib_position(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    rel_x: f64,
    rel_y: f64,
    width: f64,
    height: f64,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_position(&id, rel_x, rel_y, width, height)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn update_skrib_text(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    text: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_text(&id, text)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn update_skrib_color(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    color: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_color(&id, color)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn get_pending_open_note_request(
    state: State<'_, AppState>,
) -> Result<Option<OpenNoteRequest>, String> {
    state
        .note_window_runtime
        .lock()
        .map(|runtime| runtime.pending_open_request())
        .map_err(|_| "The native note window state is unavailable.".to_string())
}

#[tauri::command]
fn acknowledge_open_note_request(
    state: State<'_, AppState>,
    note_id: String,
) -> Result<bool, String> {
    state
        .note_window_runtime
        .lock()
        .map(|mut runtime| runtime.acknowledge_open_request(&note_id))
        .map_err(|_| "The native note window state is unavailable.".to_string())
}

#[tauri::command]
fn get_context_rail_notes(state: State<'_, AppState>) -> Vec<SkribNote> {
    context_rail_notes_for_active_target(&state)
}

#[tauri::command]
fn get_note_preferences(
    app_handle: AppHandle,
) -> Result<core::preferences::NotePreferences, String> {
    let path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note-preferences.json");
    core::preferences::load(&path)
}

#[tauri::command]
fn set_note_preferences(
    app_handle: AppHandle,
    multiple_notes_per_context: bool,
) -> Result<core::preferences::NotePreferences, String> {
    let path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("note-preferences.json");
    core::preferences::save(&path, multiple_notes_per_context)
}

#[tauri::command]
fn launch_supported_target_application(process_name: String) -> Result<String, String> {
    desktop::target_launch::launch(&process_name)
}

#[tauri::command]
fn set_context_rail_expanded(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    expanded: bool,
    contextual: bool,
    note_count: usize,
    arrival_revision: Option<u64>,
) -> Result<RailWindowState, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let current = get_rail_window_state(contextual);
    if contextual && !context_arrival_matches(arrival_revision, current) {
        return Ok(current);
    }
    if contextual && context_rail_window_runtime().foreground_target().is_none() {
        return Err("Skribli does not have an active application context.".to_string());
    }
    let rail_label = if contextual { "context-rail" } else { "rail" };
    let rail = app_handle
        .get_webview_window(rail_label)
        .ok_or_else(|| "My Skribs rail is unavailable.".to_string())?;
    if expanded {
        collapse_other_rail_locked(&app_handle, contextual)?;
    }
    let _ = note_count;
    let (width, height) = rail_surface_dimensions(expanded, contextual);
    rail.set_always_on_top(true)
        .map_err(|error| format!("Skribli could not update the note rail layer: {error}"))?;
    if contextual {
        let target = context_rail_window_runtime()
            .foreground_target()
            .ok_or_else(|| "Skribli does not have an active application context.".to_string())?;
        size_and_place_context_rail(&app_handle, &rail, &target, width, height)?;
        context_rail_window_runtime()
            .expanded
            .store(expanded, Ordering::Release);
        context_rail_window_runtime()
            .revealed
            .store(false, Ordering::Release);
    } else {
        rail_window_runtime().clear_context_placement();
        size_and_dock_rail(&app_handle, &rail, width, height)?;
        rail_window_runtime()
            .expanded
            .store(expanded, Ordering::Release);
    }
    rail.show()
        .map_err(|error| format!("Skribli could not show the note rail: {error}"))?;
    emit_rail_window_state(&app_handle, contextual);
    Ok(get_rail_window_state(contextual))
}

// Called under the native operation gate: both launchers remain available, but only
// one note list occupies desktop space. Do not recursively acquire the gate here.
fn collapse_other_rail_locked(
    app_handle: &AppHandle,
    opening_contextual: bool,
) -> Result<(), String> {
    let contextual = !opening_contextual;
    let runtime = if contextual {
        context_rail_window_runtime()
    } else {
        rail_window_runtime()
    };
    if !runtime.expanded.load(Ordering::Acquire) {
        return Ok(());
    }
    let label = if contextual { "context-rail" } else { "rail" };
    let Some(rail) = app_handle.get_webview_window(label) else {
        return Ok(());
    };
    let (width, height) = rail_surface_dimensions(false, contextual);
    if contextual {
        let Some(target) = runtime.foreground_target() else {
            hide_context_note_rail(app_handle);
            return Ok(());
        };
        size_and_place_context_rail(app_handle, &rail, &target, width, height)?;
    } else {
        size_and_dock_rail(app_handle, &rail, width, height)?;
    }
    runtime.expanded.store(false, Ordering::Release);
    runtime.revealed.store(false, Ordering::Release);
    emit_rail_window_state(app_handle, contextual);
    Ok(())
}

#[tauri::command]
fn set_context_rail_peek(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    revealed: bool,
    arrival_revision: Option<u64>,
) -> Result<RailWindowState, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let runtime = context_rail_window_runtime();
    let Some(target) = runtime.foreground_target() else {
        return Ok(get_rail_window_state(true));
    };
    let rail = app_handle
        .get_webview_window("context-rail")
        .ok_or_else(|| "The in-app Skrib indicator is unavailable.".to_string())?;
    let previous = get_rail_window_state(true);
    if !context_arrival_matches(arrival_revision, previous) {
        return Ok(previous);
    }
    let next = RailWindowState {
        revealed,
        ..previous
    };
    let (width, height) = context_rail_surface_dimensions(next);
    size_and_place_context_rail(&app_handle, &rail, &target, width, height)?;
    runtime.revealed.store(revealed, Ordering::Release);
    emit_rail_window_state(&app_handle, true);
    Ok(get_rail_window_state(true))
}

#[tauri::command]
fn get_open_skrib_note_id(app_handle: AppHandle, state: State<'_, AppState>) -> Option<String> {
    let visible = app_handle
        .get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);
    if !visible {
        return None;
    }
    let runtime = state.note_window_runtime.lock().ok()?;
    let id = runtime.active_note_id()?;
    let note = state.coordinator.get_skrib(id)?;
    // Collapsed dots have no draft editor to flush.
    (runtime.detached || !note.collapsed).then(|| id.to_string())
}

#[tauri::command]
fn open_skrib_note_here(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    caller: tauri::WebviewWindow,
    id: String,
    arrival_revision: Option<u64>,
) -> Result<(), String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let note = state
        .coordinator
        .get_skrib(&id)
        .filter(SkribNote::is_active)
        .ok_or_else(|| "This note is no longer available.".to_string())?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The note window is unavailable.".to_string())?;
    let context_available = context_rail_window_runtime().foreground_target().is_some()
        && app_handle
            .get_webview_window("context-rail")
            .and_then(|rail| rail.is_visible().ok())
            .unwrap_or(false);
    let rail_label = detached_note_rail_label(
        caller.label(),
        context_available,
        arrival_revision,
        get_rail_window_state(true),
    )?;
    let rail = app_handle
        .get_webview_window(rail_label)
        .ok_or_else(|| "The note rail is unavailable.".to_string())?;
    begin_native_lifecycle_action(&state)?;
    #[cfg(target_os = "windows")]
    let metrics = position_detached_note_window(&window, &rail, &note)?;
    #[cfg(not(target_os = "windows"))]
    let metrics = {
        let _ = (&rail, &note);
        OverlayMetrics::default()
    };
    set_runtime_active_target_locked(&state, None);
    let request = detached_open_request(id.clone());
    {
        let mut runtime = state
            .note_window_runtime
            .lock()
            .map_err(|_| "The note window state is unavailable.".to_string())?;
        runtime.record_detached_placement(&id, &metrics);
        runtime.record_open_request(request.clone());
    }
    let payload = build_mutation_payload(&app_handle, &state, false);
    app_handle
        .emit("skribly://overlay-update", payload)
        .map_err(|error| error.to_string())?;
    app_handle
        .emit("skribly://open-note-request", request)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    rail.show().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_skrib_note_here(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let (detached, has_active_note) = state
        .note_window_runtime
        .lock()
        .map(|runtime| (runtime.detached, runtime.active_note_id().is_some()))
        .map_err(|_| "The note window state is unavailable.".to_string())?;
    // Trash/discard already hides the removed note and clears its runtime state.
    if !has_active_note {
        return Ok(());
    }
    if !detached {
        return Err("This is a contextual note, not an Open here window.".into());
    }
    begin_native_lifecycle_action(&state)?;
    if let Some(window) = app_handle.get_webview_window("main") {
        window.hide().map_err(|error| error.to_string())?;
    }
    state
        .note_window_runtime
        .lock()
        .map_err(|_| "The note window state is unavailable.".to_string())?
        .clear();
    let _ = app_handle.emit(
        "skribly://overlay-update",
        build_mutation_payload(&app_handle, &state, false),
    );
    Ok(())
}

#[tauri::command]
fn toggle_skrib_collapse(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .toggle_skrib_collapse(&id)
            .map(|_| ())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn set_skrib_window_collapsed(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    collapsed: bool,
) -> Result<OverlayStatePayload, String> {
    let note = state
        .coordinator
        .get_skrib(&id)
        .ok_or_else(|| "Skrib note was not found or is not writable".to_string())?;
    if !note.is_active() {
        return Err("Archived or trashed notes cannot be shown on screen.".into());
    }
    let target = state
        .coordinator
        .get_active_target()
        .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The Skrib window is unavailable.".to_string())?;
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let was_workspace_expanded = state
        .note_window_runtime
        .lock()
        .map(|runtime| runtime.workspace_expanded_for(&id))
        .unwrap_or(false);
    let was_active_note = state
        .note_window_runtime
        .lock()
        .map(|runtime| runtime.active_note_id() == Some(id.as_str()) && !runtime.detached)
        .unwrap_or(false);
    let current_position =
        if was_workspace_expanded || !was_active_note || !window.is_visible().unwrap_or(false) {
            None
        } else {
            let current_position = window
                .outer_position()
                .map_err(|error| format!("Skribli could not read the note position: {error}"))?;
            Some(current_position)
        };
    // Opening a larger tool workspace is a native layout operation, not a user move of the
    // compact note. Keep the last saved compact/dot anchor when Done collapses the note.
    let (rel_x, rel_y) = current_position
        .map(|position| {
            position_to_persist(
                &target,
                &note,
                position.x,
                position.y,
                was_workspace_expanded,
            )
        })
        .unwrap_or((note.rel_x, note.rel_y));
    let mut positioned_note = note.clone();
    positioned_note.rel_x = rel_x;
    positioned_note.rel_y = rel_y;

    if collapsed {
        // Hide before any native surface transition so Done never flashes the retired dot UI.
        let _ = window.hide();
    }

    #[cfg(target_os = "windows")]
    let (generation, placement) = {
        let generation = begin_native_lifecycle_action(&state)?;
        let placement = position_note_window_for_target(&window, &target, &positioned_note, false)?;
        (generation, placement)
    };
    #[cfg(not(target_os = "windows"))]
    let _ = (&window, &target, &positioned_note, collapsed);

    if let Err(message) = run_persisted_mutation(&state, |coordinator| {
        coordinator
            .set_skrib_window_state(&id, rel_x, rel_y, collapsed)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    }) {
        #[cfg(target_os = "windows")]
        {
            if native_lifecycle_action_is_current(&state, generation) {
                let _ = if was_workspace_expanded {
                    position_note_workspace_for_target(&window, &target, &note)
                } else {
                    position_note_window_for_target(&window, &target, &note, note.collapsed)
                };
            }
        }
        return Err(message);
    }

    #[cfg(target_os = "windows")]
    let native_action_current = {
        let _commit_guard = state
            .native_lifecycle_commit_lock
            .lock()
            .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
        let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
        let current_target = state.coordinator.get_active_target();
        let current = lifecycle_snapshot_can_clear_target(
            generation,
            current_generation,
            target.hwnd_val,
            current_target.as_ref(),
        );
        if current {
            let mut runtime = state
                .note_window_runtime
                .lock()
                .map_err(|_| "The native note window state is unavailable.".to_string())?;
            runtime.record_programmatic_placement(&id, false, &placement);
        }
        current
    };
    #[cfg(not(target_os = "windows"))]
    let native_action_current = true;

    let payload = build_mutation_payload(&app_handle, &state, false);
    if native_action_current {
        if !collapsed {
            if let Some(request) = state
                .coordinator
                .get_skrib(&id)
                .and_then(|note| reopened_open_request(vec![note]))
            {
                if let Ok(mut runtime) = state.note_window_runtime.lock() {
                    runtime.record_open_request(request.clone());
                }
                let _ = app_handle.emit("skribly://overlay-update", payload.clone());
                let _ = app_handle.emit("skribly://open-note-request", request);
            }
        }
        if collapsed {
            // Done returns the note to the rail. A saved note no longer creates its own
            // floating dot, which keeps context management predictable as notes accumulate.
            let _ = window.hide();
            if let Ok(mut runtime) = state.note_window_runtime.lock() {
                runtime.clear();
            }
            if let Ok(mut suppressed) = context_rail_window_runtime().suppressed_context.lock() {
                *suppressed = None;
            }
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
        let _ = show_context_rail_for_target(&app_handle, &state, &target);
    }
    Ok(payload)
}

#[tauri::command]
fn dismiss_collapsed_skrib_window(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let note = state
        .coordinator
        .get_skrib(&id)
        .ok_or_else(|| "The collapsed Skrib was not found.".to_string())?;
    if !note.collapsed || !note.is_active() {
        return Err("Only an active collapsed Skrib can be hidden temporarily.".into());
    }
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let generation = begin_native_lifecycle_action(&state)?;
    let target = state
        .coordinator
        .get_active_target()
        .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
    if !target
        .process_name
        .eq_ignore_ascii_case(&note.target_process_name)
        || !core::preferences::note_belongs_to_context(&note, &target)
    {
        return Err("The collapsed Skrib no longer matches the active application.".into());
    }
    if !dismissal_action_is_current(&state, generation, &id, target.hwnd_val)? {
        return Err("The collapsed Skrib is not the active native note window.".into());
    }
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The collapsed Skrib window is unavailable.".to_string())?;
    window
        .hide()
        .map_err(|error| format!("Skribli could not hide the collapsed note: {error}"))?;
    #[cfg(target_os = "windows")]
    let _ = restore_standard_window_surface(&window);
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let current_target = state.coordinator.get_active_target();
    let mut runtime = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?;
    if !dismissal_snapshot_can_commit(
        generation,
        current_generation,
        &id,
        target.hwnd_val,
        runtime.active_note_id(),
        current_target.as_ref(),
    ) {
        return Err("The active note changed while Skribli was hiding the collapsed dot.".into());
    }
    runtime.dismiss_collapsed_window(&note, &target);
    Ok(())
}

fn dismissal_action_is_current(
    state: &AppState,
    generation: u64,
    note_id: &str,
    target_hwnd: isize,
) -> Result<bool, String> {
    let _commit_guard = state
        .native_lifecycle_commit_lock
        .lock()
        .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
    let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
    let current_target = state.coordinator.get_active_target();
    let runtime = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?;
    Ok(dismissal_snapshot_can_commit(
        generation,
        current_generation,
        note_id,
        target_hwnd,
        runtime.active_note_id(),
        current_target.as_ref(),
    ))
}

#[tauri::command]
fn save_skrib_window_position(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    if state
        .note_window_runtime
        .lock()
        .map_err(|_| "The note window state is unavailable.")?
        .active_note_id()
        != Some(id.as_str())
    {
        return Err("This Skrib is no longer the open note.".into());
    }
    let detached = state
        .note_window_runtime
        .lock()
        .map(|runtime| runtime.detached_note_id() == Some(id.as_str()))
        .unwrap_or(false);
    let note = state
        .coordinator
        .get_skrib(&id)
        .ok_or_else(|| "Skrib note was not found or is not writable".to_string())?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The Skrib window is unavailable.".to_string())?;
    let position = window
        .outer_position()
        .map_err(|error| format!("Skribli could not read the note position: {error}"))?;
    let physical_size = window
        .outer_size()
        .map_err(|error| format!("Skribli could not read the note size: {error}"))?;
    let scale_factor = window
        .scale_factor()
        .map_err(|error| format!("Skribli could not read the display scale: {error}"))?;
    let (width, height) = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The note window state is unavailable.")?
        .dimensions_to_save(
            &note,
            (
                (physical_size.width as f64 / scale_factor).clamp(320.0, 820.0),
                (physical_size.height as f64 / scale_factor).clamp(260.0, 760.0),
            ),
        );
    let ignore_position = state
        .note_window_runtime
        .lock()
        .map(|mut runtime| runtime.should_ignore_position_save(&id, position.x, position.y))
        .unwrap_or(false);
    let (rel_x, rel_y) = if detached || ignore_position {
        (note.rel_x, note.rel_y)
    } else {
        let target = state
            .coordinator
            .get_active_target()
            .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
        relative_note_position(&target, position.x, position.y)
    };

    #[cfg(target_os = "windows")]
    if !note.collapsed {
        refresh_note_window_surface(&window)?;
    }

    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_position(&id, rel_x, rel_y, width, height)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn set_skrib_workspace_mode(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    expanded: bool,
) -> Result<OverlayMetrics, String> {
    let note = state
        .coordinator
        .get_skrib(&id)
        .ok_or_else(|| "Skrib note was not found or is not writable".to_string())?;
    if note.collapsed || !note.is_active() {
        return Err("Expand this Skrib before opening its writing workspace.".into());
    }
    let target = state
        .coordinator
        .get_active_target()
        .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The Skrib window is unavailable.".to_string())?;

    #[cfg(target_os = "windows")]
    {
        let _operation_guard = state.native_window_operation_gate.lock()?;
        let generation = begin_native_lifecycle_action(&state)?;
        let metrics = if expanded {
            position_note_workspace_for_target(&window, &target, &note)
        } else {
            position_note_window_for_target(&window, &target, &note, false)
        }?;
        let _commit_guard = state
            .native_lifecycle_commit_lock
            .lock()
            .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
        let current_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
        let current_target = state.coordinator.get_active_target();
        if lifecycle_snapshot_can_clear_target(
            generation,
            current_generation,
            target.hwnd_val,
            current_target.as_ref(),
        ) {
            let mut runtime = state
                .note_window_runtime
                .lock()
                .map_err(|_| "The native note window state is unavailable.".to_string())?;
            runtime.record_programmatic_placement(&id, expanded, &metrics);
        }
        Ok(metrics)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, target, note, expanded);
        Err("The expanded Skrib workspace is currently available on Windows only.".into())
    }
}

fn note_surface_dimensions(size: &str) -> Result<(f64, f64), String> {
    match size {
        "compact" => Ok((420.0, 360.0)),
        "medium" => Ok((640.0, 600.0)),
        "large" => Ok((820.0, 760.0)),
        _ => Err("Choose compact, medium, or large for the Skrib size.".into()),
    }
}

#[tauri::command]
fn set_skrib_window_size(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    size: String,
) -> Result<OverlayMetrics, String> {
    let (width, height) = note_surface_dimensions(&size)?;
    resize_skrib_window(app_handle, state, id, width, height, false)
}

fn validate_note_dimensions(width: f64, height: f64) -> Result<(), String> {
    if !width.is_finite()
        || !height.is_finite()
        || !(320.0..=820.0).contains(&width)
        || !(260.0..=760.0).contains(&height)
    {
        return Err("Choose a note size between 320 × 260 and 820 × 760.".into());
    }
    Ok(())
}

#[tauri::command]
fn set_skrib_window_dimensions(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    note_id: String,
    width: f64,
    height: f64,
    temporary: Option<bool>,
) -> Result<OverlayMetrics, String> {
    resize_skrib_window(
        app_handle,
        state,
        note_id,
        width,
        height,
        temporary.unwrap_or(false),
    )
}

#[tauri::command]
fn begin_skrib_manual_resize(state: State<'_, AppState>, note_id: String) -> Result<(), String> {
    let _operation_guard = state.native_window_operation_gate.lock()?;
    let mut runtime = state
        .note_window_runtime
        .lock()
        .map_err(|_| "The note window state is unavailable.")?;
    if runtime.active_note_id() != Some(note_id.as_str()) {
        return Err("This Skrib is no longer the open note.".into());
    }
    runtime.borrowed_dimensions = None;
    Ok(())
}

fn resize_skrib_window(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    width: f64,
    height: f64,
    temporary: bool,
) -> Result<OverlayMetrics, String> {
    validate_note_dimensions(width, height)?;
    let _operation_guard = state.native_window_operation_gate.lock()?;
    if state
        .note_window_runtime
        .lock()
        .map_err(|_| "The native note window state is unavailable.".to_string())?
        .active_note_id
        .as_deref()
        != Some(id.as_str())
    {
        return Err("This Skrib is no longer the open note.".into());
    }
    let note = state
        .coordinator
        .get_skrib(&id)
        .ok_or_else(|| "Skrib note was not found or is not writable".to_string())?;
    let detached = state
        .note_window_runtime
        .lock()
        .map(|runtime| runtime.detached_note_id() == Some(id.as_str()))
        .unwrap_or(false);
    if (note.collapsed && !detached) || !note.is_active() {
        return Err("Expand this Skrib before changing its size.".into());
    }
    #[cfg(target_os = "windows")]
    if detached {
        let window = app_handle
            .get_webview_window("main")
            .ok_or_else(|| "The note window is unavailable.".to_string())?;
        begin_native_lifecycle_action(&state)?;
        let mut resized = note.clone();
        resized.width = width;
        resized.height = height;
        let metrics = transition_detached_note_window(&window, &resized)?;
        if !temporary {
            run_persisted_mutation(&state, |coordinator| {
                coordinator
                    .update_skrib_position(&id, note.rel_x, note.rel_y, width, height)
                    .then_some(())
                    .ok_or_else(|| "Skribli could not save the requested note size.".to_string())
            })?;
        }
        let mut runtime = state
            .note_window_runtime
            .lock()
            .map_err(|_| "The note window state is unavailable.".to_string())?;
        runtime.record_detached_placement(&id, &metrics);
        runtime.record_size_mode(&note, width, height, temporary);
        drop(runtime);
        let _ = app_handle.emit(
            "skribly://overlay-update",
            build_mutation_payload(&app_handle, &state, false),
        );
        return Ok(metrics);
    }
    let target = state
        .coordinator
        .get_active_target()
        .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The Skrib window is unavailable.".to_string())?;
    let mut resized_note = note.clone();
    resized_note.width = width;
    resized_note.height = height;

    #[cfg(target_os = "windows")]
    {
        let generation = begin_native_lifecycle_action(&state)?;
        let metrics = transition_note_window_for_target(&window, &target, &resized_note)?;
        if !temporary {
            run_persisted_mutation(&state, |coordinator| {
                coordinator
                    .update_skrib_position(
                        &id,
                        resized_note.rel_x,
                        resized_note.rel_y,
                        width,
                        height,
                    )
                    .then_some(())
                    .ok_or_else(|| "Skribli could not save the requested note size.".to_string())
            })?;
        }
        let _commit_guard = state
            .native_lifecycle_commit_lock
            .lock()
            .map_err(|_| "The native window lifecycle lock is unavailable.".to_string())?;
        let current_target = state.coordinator.get_active_target();
        if lifecycle_snapshot_can_clear_target(
            generation,
            state.native_lifecycle_generation.load(Ordering::Acquire),
            target.hwnd_val,
            current_target.as_ref(),
        ) {
            let mut runtime = state
                .note_window_runtime
                .lock()
                .map_err(|_| "The native note window state is unavailable.".to_string())?;
            runtime.record_programmatic_placement(&id, false, &metrics);
            runtime.record_size_mode(&note, width, height, temporary);
        }
        Ok(metrics)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, target, resized_note, width, height);
        Err("Resizable Skribs are currently available on Windows only.".into())
    }
}

fn lifecycle_timestamp_seconds() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .max(1)
}

#[tauri::command]
fn trash_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    let deleted_at = lifecycle_timestamp_seconds();
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .trash_skrib(&id, deleted_at)
            .map(|_| ())
            .ok_or_else(|| "Only an active writable note can be moved to Trash".to_string())
    })?;
    hide_if_active_note_was_removed(&app_handle, &state, &id);
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn archive_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    let archived_at = lifecycle_timestamp_seconds();
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .archive_skrib(&id, archived_at)
            .map(|_| ())
            .ok_or_else(|| "Only an active writable note can be completed".to_string())
    })?;
    hide_if_active_note_was_removed(&app_handle, &state, &id);
    let _ = app_handle.emit("skribly://context-rail-refresh", ());
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn restore_archived_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    let restored_at = lifecycle_timestamp_seconds();
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .restore_archived_skrib(&id, restored_at)
            .map(|_| ())
            .ok_or_else(|| "Only an archived writable note can be restored".to_string())
    })?;
    let _ = app_handle.emit("skribly://context-rail-refresh", ());
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn discard_empty_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .discard_empty_skrib(&id)
            .map(|_| ())
            .ok_or_else(|| "Only an active empty note can be discarded".to_string())
    })?;
    hide_if_active_note_was_removed(&app_handle, &state, &id);
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn restore_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    let restored_at = lifecycle_timestamp_seconds();
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .restore_skrib(&id, restored_at)
            .map(|_| ())
            .ok_or_else(|| "Only a trashed writable note can be restored".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn permanently_delete_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .permanently_delete_skrib(&id)
            .map(|_| ())
            .ok_or_else(|| "Only a trashed writable note can be permanently deleted".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn get_all_skribs(state: State<'_, AppState>) -> Vec<SkribNote> {
    let mut skribs = state.coordinator.get_all_skribs();
    skribs.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.created_at.cmp(&left.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });
    skribs
}

#[tauri::command]
fn focus_target_window(hwnd_val: isize) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        focus_external_window(hwnd_val)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = hwnd_val;
        Err("Focusing an external application is currently available on Windows only.".into())
    }
}

#[tauri::command]
fn set_hit_test_rects(state: State<'_, AppState>, rects: Vec<HitTestRect>) {
    state.coordinator.set_hit_test_rects(rects);
}

fn account_data_directory(app_handle: &AppHandle) -> Result<std::path::PathBuf, String> {
    app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Skribli could not locate its account data directory: {error}"))
}

#[tauri::command]
fn account_session_get(app_handle: AppHandle, key: String) -> Result<Option<String>, String> {
    let directory = account_data_directory(&app_handle)?;
    account::get_session_value(&directory, key.trim())
}

#[tauri::command]
fn account_session_set(app_handle: AppHandle, key: String, value: String) -> Result<(), String> {
    let directory = account_data_directory(&app_handle)?;
    account::set_session_value(&directory, key.trim(), &value)
}

#[tauri::command]
fn account_session_remove(app_handle: AppHandle, key: String) -> Result<(), String> {
    let directory = account_data_directory(&app_handle)?;
    account::remove_session_value(&directory, key.trim())
}

#[tauri::command]
fn get_account_device_claim() -> Result<String, String> {
    account::device_claim()
}

#[tauri::command]
fn apply_account_entitlement(token: String) -> Result<license::LicenseStatus, String> {
    let trimmed = token.trim();
    if trimmed.is_empty() || trimmed.len() > 16 * 1024 {
        return Err("The account entitlement is empty or exceeds the safe size limit.".to_string());
    }
    license::activate_global(trimmed)
}

#[tauri::command]
fn clear_account_entitlement(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<license::LicenseStatus, String> {
    let status = license::deactivate_global()?;
    clear_active_target_and_hide_note(&app_handle, &state);
    Ok(status)
}

#[tauri::command]
fn refresh_target_state(app_handle: AppHandle, state: State<'_, AppState>) -> OverlayStatePayload {
    let mut is_ambiguous = false;
    #[cfg(target_os = "windows")]
    {
        let lifecycle_generation = state.native_lifecycle_generation.load(Ordering::Acquire);
        if let Some(target) = state.coordinator.get_active_target() {
            if let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) {
                if let Some(updated_target) = inspect_target_window(hwnd) {
                    let _ = commit_refreshed_target_if_current(
                        &state,
                        lifecycle_generation,
                        target.hwnd_val,
                        updated_target,
                    );
                } else {
                    let _ = clear_active_target_and_hide_note_if_current(
                        &app_handle,
                        &state,
                        lifecycle_generation,
                        target.hwnd_val,
                    );
                }
            } else {
                let _ = clear_active_target_and_hide_note_if_current(
                    &app_handle,
                    &state,
                    lifecycle_generation,
                    target.hwnd_val,
                );
            }
        } else {
            let candidates = list_candidate_target_windows();
            match state.coordinator.find_best_context_match(&candidates) {
                MatchResult::Unique(best) => {
                    set_runtime_active_target(&state, Some(best));
                }
                MatchResult::Ambiguous(_) => {
                    is_ambiguous = true;
                }
                MatchResult::None => {}
            }
        }
    }
    build_overlay_payload(&app_handle, &state, is_ambiguous)
}

const GLOBAL_HOTKEY_ID: i32 = 0x534B;

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VisibleNoteTargetEvent {
    Ignore,
    Reanchor,
    Disconnect,
}

#[cfg(target_os = "windows")]
fn classify_visible_note_target_event(
    event_type: u32,
    event_hwnd: isize,
    active_hwnd: Option<isize>,
) -> VisibleNoteTargetEvent {
    if active_hwnd != Some(event_hwnd) {
        return VisibleNoteTargetEvent::Ignore;
    }
    if matches!(event_type, EVENT_OBJECT_DESTROY | EVENT_OBJECT_HIDE) {
        VisibleNoteTargetEvent::Disconnect
    } else if matches!(
        event_type,
        EVENT_OBJECT_LOCATIONCHANGE | EVENT_SYSTEM_MINIMIZEEND
    ) {
        VisibleNoteTargetEvent::Reanchor
    } else {
        VisibleNoteTargetEvent::Ignore
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        set_dpi_awareness();
    }

    let background_launch = desktop::startup::is_background_launch(std::env::args_os());
    let (hotkey_sender, hotkey_receiver): (std::sync::mpsc::Sender<i32>, Receiver<i32>) = channel();

    let coordinator = Coordinator::new();
    #[cfg(target_os = "windows")]
    let (win_event_pipeline, event_receiver) = WinEventPipeline::new(WIN_EVENT_QUEUE_CAPACITY);
    let running = Arc::new(AtomicBool::new(true));
    let storage_path = std::env::temp_dir().join("skribly-uninitialized.json");
    let app_state = AppState {
        coordinator: coordinator.clone(),
        running: running.clone(),
        init_status: Mutex::new(OverlayInitializationStatus::Initializing),
        mutation_lock: Mutex::new(()),
        storage: Mutex::new(storage::StorageService::new(storage_path)),
        storage_notice: Mutex::new(None),
        storage_error: Mutex::new(None),
        note_window_runtime: Mutex::new(NoteWindowRuntime::default()),
        native_lifecycle_generation: AtomicU64::new(0),
        native_lifecycle_commit_lock: Mutex::new(()),
        native_window_operation_gate: NativeWindowOperationGate::default(),
        #[cfg(target_os = "windows")]
        win_event_pipeline: win_event_pipeline.clone(),
    };

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            list_target_windows,
            get_app_icon,
            get_overlay_metrics,
            retry_overlay_initialization,
            reposition_compact_window,
            set_active_target,
            get_storage_health,
            export_storage_diagnostics,
            upsert_skrib_note,
            update_skrib_position,
            update_skrib_text,
            update_skrib_color,
            get_pending_open_note_request,
            acknowledge_open_note_request,
            get_context_rail_notes,
            get_note_preferences,
            set_note_preferences,
            launch_supported_target_application,
            set_context_rail_expanded,
            get_rail_window_state,
            set_context_rail_peek,
            open_skrib_note_here,
            get_open_skrib_note_id,
            close_skrib_note_here,
            show_global_note_rail,
            toggle_skrib_collapse,
            set_skrib_window_collapsed,
            dismiss_collapsed_skrib_window,
            save_skrib_window_position,
            set_skrib_workspace_mode,
            set_skrib_window_size,
            set_skrib_window_dimensions,
            begin_skrib_manual_resize,
            trash_skrib_note,
            archive_skrib_note,
            discard_empty_skrib_note,
            restore_skrib_note,
            restore_archived_skrib_note,
            permanently_delete_skrib_note,
            get_all_skribs,
            focus_target_window,
            set_hit_test_rects,
            refresh_target_state,
            account_session_get,
            account_session_set,
            account_session_remove,
            get_account_device_claim,
            apply_account_entitlement,
            clear_account_entitlement,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            #[cfg(target_os = "windows")]
            if let Err(message) = desktop::startup::register_launch_at_login() {
                // Registration failure must not stop local notes or the current-session shortcut.
                // Keep the message available to diagnostics without showing an intrusive dialog at
                // login, when this process may intentionally have no visible window.
                eprintln!("{message}");
            }

            if let Some(home_window) = app.get_webview_window("home") {
                if background_launch {
                    let _ = home_window.hide();
                } else {
                    let _ = home_window.show();
                    let _ = home_window.set_focus();
                }
            }

            let data_dir = app.path().app_data_dir()?;
            let storage_path = data_dir.join("skribs.json");
            license::initialize_from_skrib_path(&storage_path)
                .map_err(std::io::Error::other)?;
            let mut storage_service = storage::StorageService::new(storage_path);
            let loaded = storage_service.load();
            {
                let state = app.state::<AppState>();
                let mut storage = state
                    .storage
                    .lock()
                    .map_err(|_| "Local storage service is unavailable")?;
                *storage = storage_service;
                drop(storage);

                match loaded {
                    Ok(outcome) => {
                        state.coordinator.replace_all_skribs(outcome.skribs);
                        state.set_storage_notice(outcome.notice);
                        state.clear_storage_error();
                    }
                    Err(error) => {
                        state.record_storage_error(error.to_string());
                    }
                }
            }

            desktop::tray::install_tray(app)?;
            let _ = show_global_note_rail(app_handle.clone());

            let coordinator = app.state::<AppState>().coordinator.clone();
            let running_flag = app.state::<AppState>().running.clone();
            let main_window = app.get_webview_window("main");

            #[cfg(target_os = "windows")]
            {
                let hotkey_result = start_global_hotkey_listener(
                    hotkey_sender,
                    running_flag.clone(),
                    GLOBAL_HOTKEY_ID,
                );
                if let Some(ref window) = main_window {
                    if window.hwnd().is_ok() {
                        let state = app.state::<AppState>();
                        initialize_native_overlay(&app_handle, &state, window);
                        if let Err(message) = hotkey_result {
                            let status = OverlayInitializationStatus::Failed(message);
                            state.set_init_status(status.clone());
                            let _ = app_handle.emit("skribly://overlay-init-status", status);
                        }
                    }
                }
            }

            let coordinator_hk = coordinator.clone();
            let app_handle_hk = app_handle.clone();
            let running_flag_hk = running_flag.clone();

            std::thread::spawn(move || {
                while running_flag_hk.load(Ordering::Relaxed) {
                    if let Ok(hotkey_id) = hotkey_receiver.recv_timeout(Duration::from_millis(100))
                    {
                        if hotkey_id != GLOBAL_HOTKEY_ID {
                            continue;
                        }

                        let state_hk = app_handle_hk.state::<AppState>();
                        let preferences = match get_note_preferences(app_handle_hk.clone()) {
                            Ok(value) => value,
                            Err(message) => {
                                let _ = app_handle_hk.emit("skribly://hotkey-error", message);
                                continue;
                            }
                        };
                        let _operation_guard = match state_hk.native_window_operation_gate.lock() {
                            Ok(guard) => guard,
                            Err(message) => {
                                let _ = app_handle_hk.emit("skribly://hotkey-error", message);
                                continue;
                            }
                        };
                        clear_active_target_and_hide_note_locked(&app_handle_hk, &state_hk);

                        #[cfg(target_os = "windows")]
                        let capture = match capture_foreground_target() {
                            Ok(capture) => capture,
                            Err(error) => {
                                present_target_capture_error_locked(
                                    &app_handle_hk,
                                    &state_hk,
                                    error,
                                );
                                continue;
                            }
                        };

                        #[cfg(target_os = "windows")]
                        let target = match revalidate_captured_target(&capture) {
                            Ok(target) => target,
                            Err(error) => {
                                present_target_capture_error_locked(
                                    &app_handle_hk,
                                    &state_hk,
                                    error,
                                );
                                continue;
                            }
                        };

                        #[cfg(not(target_os = "windows"))]
                        let target = match coordinator_hk.get_active_target() {
                            Some(target) => target,
                            None => continue,
                        };

                        let Some(window) = app_handle_hk.get_webview_window("main") else {
                            let _ = app_handle_hk.emit(
                                "skribly://hotkey-error",
                                "The compact editor window is unavailable. Restart Skribli and try again.",
                            );
                            continue;
                        };

                        #[cfg(target_os = "windows")]
                        clear_target_capture_error(&app_handle_hk);
                        let primary = core::preferences::primary_shortcut_note(
                            &coordinator_hk.get_all_skribs(), &target, &preferences,
                        );
                        let reopening = primary.is_some();
                        set_runtime_active_target_locked(&state_hk, Some(target.clone()));
                        #[cfg(target_os = "windows")]
                        let lifecycle_generation = match begin_native_lifecycle_action(&state_hk) {
                            Ok(generation) => generation,
                            Err(message) => {
                                let _ = app_handle_hk.emit("skribly://hotkey-error", message);
                                continue;
                            }
                        };
                        #[cfg(target_os = "windows")]
                        let initial_metrics =
                            match primary.as_ref().map_or_else(
                                || position_compact_window_for_target(&window, &target),
                                |note| position_note_window_for_target(&window, &target, note, false),
                            ) {
                                Ok(metrics) => metrics,
                                Err(message) => {
                                    let _ = app_handle_hk.emit(
                                        "skribly://hotkey-error",
                                        format!("Skribli could not place the compact editor safely: {message}"),
                                    );
                                    continue;
                                }
                            };
                        #[cfg(not(target_os = "windows"))]
                        let initial_metrics = OverlayMetrics::default();
                        let timestamp = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis();
                        let note_id = primary.as_ref().map(|note| note.id.clone())
                            .unwrap_or_else(|| format!("skrib-hotkey-{timestamp}"));
                        let (rel_x, rel_y) = relative_note_position(
                            &target,
                            initial_metrics.overlay_physical_x,
                            initial_metrics.overlay_physical_y,
                        );
                        let new_note = if let Some(mut saved) = primary {
                            saved.collapsed = false;
                            saved
                        } else { SkribNote {
                            id: note_id.clone(),
                            target_process_name: target.process_name.clone(),
                            target_title: target.title.clone(),
                            rel_x,
                            rel_y,
                            width: COMPACT_WINDOW_LOGICAL_WIDTH as f64,
                            height: COMPACT_WINDOW_LOGICAL_HEIGHT as f64,
                            text: String::new(),
                            color: next_note_color(&coordinator_hk.get_all_skribs()),
                            collapsed: false,
                            created_at: (timestamp / 1000) as u64,
                            updated_at: (timestamp / 1000) as u64,
                            archived_at: None,
                            deleted_at: None,
                        } };
                        if let Err(message) = run_persisted_mutation(&state_hk, |coordinator| {
                            coordinator
                                .upsert_skrib(new_note)
                                .then_some(())
                                .ok_or_else(|| {
                                    "The new note did not pass native validation.".to_string()
                                })
                        }) {
                            let _ = app_handle_hk.emit("skribly://storage-error", message);
                            continue;
                        }
                        #[cfg(target_os = "windows")]
                        let native_open_current = record_note_placement_if_current(
                            &state_hk,
                            lifecycle_generation,
                            target.hwnd_val,
                            &note_id,
                            false,
                            &initial_metrics,
                        )
                        .unwrap_or(false);
                        let matching_note_count = coordinator_hk
                            .get_skribs_for_target(&target)
                            .into_iter()
                            .filter(SkribNote::is_active)
                            .count();
                        let open_request = if reopening {
                            OpenNoteRequest { action: note_lifecycle::OpenNoteAction::Reopened,
                                note_id, matching_note_count }
                        } else { shortcut_open_request(note_id, matching_note_count) };

                        #[cfg(target_os = "windows")]
                        if !native_open_current
                            || !native_lifecycle_action_is_current(
                                &state_hk,
                                lifecycle_generation,
                            )
                        {
                            continue;
                        }
                        if let Ok(mut runtime) = state_hk.note_window_runtime.lock() {
                            runtime.record_open_request(open_request.clone());
                        }
                        let payload = build_overlay_payload(&app_handle_hk, &state_hk, false);
                        let _ = app_handle_hk.emit("skribly://global-shortcut", payload);
                        let _ = app_handle_hk.emit("skribly://open-note-request", open_request);
                        let _ = window.show();
                        let _ = window.set_focus();
                        // The editor already represents this new thought. Introduce the
                        // quiet app bar when the user puts it away, not while writing.
                        if let Ok(mut suppressed) = context_rail_window_runtime().suppressed_context.lock() {
                            *suppressed = Some(target.context_fingerprint());
                        }
                        hide_context_note_rail(&app_handle_hk);
                    }
                }
            });

            #[cfg(target_os = "windows")]
            {
                let app_handle_watchdog = app_handle.clone();
                let running_flag_watchdog = running_flag.clone();
                std::thread::spawn(move || {
                    while running_flag_watchdog.load(Ordering::Relaxed) {
                        std::thread::sleep(Duration::from_millis(500));
                        let state_watchdog = app_handle_watchdog.state::<AppState>();
                        let dismissed = state_watchdog
                            .note_window_runtime
                            .lock()
                            .map(|runtime| runtime.dismissed_collapsed_window().is_some())
                            .unwrap_or(false);
                        if dismissed {
                            continue;
                        }
                        let note_window_visible = app_handle_watchdog
                            .get_webview_window("main")
                            .and_then(|window| window.is_visible().ok())
                            .unwrap_or(false);
                        if !note_window_visible {
                            continue;
                        }
                        let lifecycle_generation = state_watchdog
                            .native_lifecycle_generation
                            .load(Ordering::Acquire);
                        let Some(active) = state_watchdog.coordinator.get_active_target() else {
                            // A missing target is handled by the normal clear paths. Do not hide
                            // here after an unlocked sample: a hotkey may already be publishing a
                            // newly captured target.
                            continue;
                        };
                        let refreshed = reconstruct_hwnd(active.hwnd_val)
                            .and_then(inspect_target_window)
                            .filter(|target| refreshed_target_preserves_identity(&active, target));
                        if refreshed.is_none()
                            && clear_active_target_and_hide_note_if_current(
                                &app_handle_watchdog,
                                &state_watchdog,
                                lifecycle_generation,
                                active.hwnd_val,
                            )
                        {
                            let payload = build_mutation_payload(
                                &app_handle_watchdog,
                                &state_watchdog,
                                false,
                            );
                            let _ = app_handle_watchdog.emit("skribly://overlay-update", payload);
                        }
                    }
                });
            }

            let app_handle_ev = app_handle.clone();
            std::thread::spawn(move || {
                let mut tick_counter: u32 = 0;
                while running_flag.load(Ordering::Relaxed) {
                    tick_counter = tick_counter.wrapping_add(1);
                    if let Ok(mut notice) = event_receiver.recv_timeout(Duration::from_millis(500)) {
                        notice.mark_processing_started();
                        let state_ev = app_handle_ev.state::<AppState>();
                        // Presence follows foreground work independently of the editor's
                        // saved context, including while reading an Open Here note.
                        sync_context_presence_event(&app_handle_ev, &state_ev, notice.event_type, notice.hwnd_val);
                        // Open here is a free note window. External focus changes must neither
                        // rebind it nor move its original context/anchor.
                        if state_ev.note_window_runtime.lock().map(|runtime| runtime.detached).unwrap_or(false) {
                            continue;
                        }
                        let note_window_visible = app_handle_ev
                            .get_webview_window("main")
                            .and_then(|window| window.is_visible().ok())
                            .unwrap_or(false);

                        #[cfg(target_os = "windows")]
                        let dismissed_lifecycle = dismissed_lifecycle_snapshot(&state_ev);

                        #[cfg(target_os = "windows")]
                        if let Some((dismissed_generation, dismissed)) = dismissed_lifecycle {
                            if matches!(
                                notice.event_type,
                                EVENT_SYSTEM_FOREGROUND | EVENT_OBJECT_NAMECHANGE
                            ) {
                                let candidate = reconstruct_hwnd(notice.hwnd_val)
                                    .and_then(inspect_target_window);
                                if let Some(candidate) = candidate {
                                    if let Some(note) =
                                        state_ev.coordinator.get_skrib(&dismissed.note_id)
                                    {
                                        match classify_dismissed_target_event(
                                            notice.event_type,
                                            &dismissed,
                                            &note,
                                            &candidate,
                                        ) {
                                            DismissedTargetEventTransition::Ignore => {}
                                            DismissedTargetEventTransition::Arm => {
                                                let _ = arm_dismissed_lifecycle_if_current(
                                                    &state_ev,
                                                    dismissed_generation,
                                                    &dismissed,
                                                );
                                            }
                                            DismissedTargetEventTransition::Restore => {
                                                match restore_dismissed_collapsed_window_for_target(
                                                    &app_handle_ev,
                                                    &state_ev,
                                                    &candidate,
                                                ) {
                                                    Ok(true) => {
                                                        let payload = build_mutation_payload(
                                                            &app_handle_ev,
                                                            &state_ev,
                                                            false,
                                                        );
                                                        let _ = app_handle_ev.emit(
                                                            "skribly://overlay-update",
                                                            payload,
                                                        );
                                                    }
                                                    Ok(false) => {}
                                                    Err(message) => {
                                                        let _ = app_handle_ev.emit(
                                                            "skribly://hotkey-error",
                                                            format!("Skribli could not restore the hidden collapsed note: {message}"),
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            // A temporary dismissal is bound to its note identity. Unrelated
                            // foreground windows must not replace that context in the coordinator.
                            continue;
                        }

                        #[cfg(target_os = "windows")]
                        if note_window_visible {
                            if matches!(
                                notice.event_type,
                                EVENT_SYSTEM_FOREGROUND | EVENT_OBJECT_NAMECHANGE
                            ) {
                                if let Some(candidate) = reconstruct_hwnd(notice.hwnd_val)
                                    .and_then(inspect_target_window)
                                {
                                    match hide_active_note_for_unrelated_context(
                                        &app_handle_ev,
                                        &state_ev,
                                        notice.event_type,
                                        &candidate,
                                    ) {
                                        Ok(true) => {
                                            sync_context_presence_event(&app_handle_ev, &state_ev, notice.event_type, notice.hwnd_val);
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev
                                                .emit("skribly://overlay-update", payload);
                                            continue;
                                        }
                                        Ok(false) => {}
                                        Err(message) => {
                                            let _ = app_handle_ev.emit(
                                                "skribly://hotkey-error",
                                                format!("Skribli could not hide the inactive note: {message}"),
                                            );
                                        }
                                    }
                                }
                            }
                            let lifecycle_generation = state_ev
                                .native_lifecycle_generation
                                .load(Ordering::Acquire);
                            let active_target = coordinator.get_active_target();
                            let active_hwnd = active_target.as_ref().map(|target| target.hwnd_val);
                            match classify_visible_note_target_event(
                                notice.event_type,
                                notice.hwnd_val,
                                active_hwnd,
                            ) {
                                VisibleNoteTargetEvent::Disconnect => {
                                    if clear_active_target_and_hide_note_if_current(
                                        &app_handle_ev,
                                        &state_ev,
                                        lifecycle_generation,
                                        notice.hwnd_val,
                                    ) {
                                        let payload = build_mutation_payload(
                                            &app_handle_ev,
                                            &state_ev,
                                            false,
                                        );
                                        let _ = app_handle_ev
                                            .emit("skribly://overlay-update", payload);
                                    }
                                }
                                VisibleNoteTargetEvent::Reanchor => {
                                    let updated = reconstruct_hwnd(notice.hwnd_val)
                                        .and_then(inspect_target_window);
                                    if let Some(updated) = updated {
                                        let refreshed_committed = commit_refreshed_target_if_current(
                                            &state_ev,
                                            lifecycle_generation,
                                            notice.hwnd_val,
                                            updated.clone(),
                                        )
                                        .unwrap_or(false);
                                        if refreshed_committed {
                                            if let Some(window) =
                                                app_handle_ev.get_webview_window("main")
                                            {
                                                if let Err(message) = position_active_note_window(
                                                    &window,
                                                    &state_ev,
                                                    &updated,
                                                ) {
                                                    let _ = app_handle_ev.emit(
                                                        "skribly://hotkey-error",
                                                        format!("Skribli could not keep the editor on the target display: {message}"),
                                                    );
                                                }
                                            }
                                        }
                                    } else {
                                        if clear_active_target_and_hide_note_if_current(
                                            &app_handle_ev,
                                            &state_ev,
                                            lifecycle_generation,
                                            notice.hwnd_val,
                                        ) {
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev
                                                .emit("skribly://overlay-update", payload);
                                        }
                                    }
                                }
                                VisibleNoteTargetEvent::Ignore => {}
                            }
                            continue;
                        }

                        #[cfg(target_os = "windows")]
                        if matches!(
                            notice.event_type,
                            EVENT_SYSTEM_FOREGROUND
                                | EVENT_SYSTEM_MINIMIZESTART
                                | EVENT_SYSTEM_MINIMIZEEND
                                | EVENT_OBJECT_DESTROY
                                | EVENT_OBJECT_HIDE
                                | EVENT_OBJECT_LOCATIONCHANGE
                        ) {
                            let lifecycle_generation = state_ev
                                .native_lifecycle_generation
                                .load(Ordering::Acquire);
                            if let Some(target) = coordinator.get_active_target() {
                                if target.hwnd_val == notice.hwnd_val {
                                    if matches!(
                                        notice.event_type,
                                        EVENT_OBJECT_DESTROY | EVENT_OBJECT_HIDE
                                    ) {
                                        if clear_active_target_and_hide_note_if_current(
                                            &app_handle_ev,
                                            &state_ev,
                                            lifecycle_generation,
                                            target.hwnd_val,
                                        ) {
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev
                                                .emit("skribly://overlay-update", payload);
                                        }
                                    } else if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                        if let Some(updated) = inspect_target_window(hwnd) {
                                            if commit_refreshed_target_if_current(
                                                &state_ev,
                                                lifecycle_generation,
                                                target.hwnd_val,
                                                updated,
                                            )
                                            .unwrap_or(false)
                                            {
                                                let payload = build_mutation_payload(
                                                    &app_handle_ev,
                                                    &state_ev,
                                                    false,
                                                );
                                                let _ = app_handle_ev
                                                    .emit("skribly://overlay-update", payload);
                                            }
                                        } else {
                                            if clear_active_target_and_hide_note_if_current(
                                                &app_handle_ev,
                                                &state_ev,
                                                lifecycle_generation,
                                                target.hwnd_val,
                                            ) {
                                                let payload = build_mutation_payload(
                                                    &app_handle_ev,
                                                    &state_ev,
                                                    false,
                                                );
                                                let _ = app_handle_ev
                                                    .emit("skribly://overlay-update", payload);
                                            }
                                        }
                                    }
                                } else if notice.event_type == EVENT_SYSTEM_FOREGROUND {
                                    if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                        if let Some(new_target) = inspect_target_window(hwnd) {
                                            if !new_target.is_focused {
                                                continue;
                                            }
                                            let candidates = vec![new_target.clone()];
                                            match coordinator.find_best_context_match(&candidates) {
                                                MatchResult::Unique(best) => {
                                                    set_runtime_active_target(&state_ev, Some(best));
                                                }
                                                _ => {
                                                    set_runtime_active_target(
                                                        &state_ev,
                                                        Some(new_target),
                                                    );
                                                }
                                            }
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                        }
                                    }
                                }
                            } else if notice.event_type == EVENT_SYSTEM_FOREGROUND {
                                if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                    if let Some(new_target) = inspect_target_window(hwnd) {
                                        if !new_target.is_focused {
                                            continue;
                                        }
                                        let candidates = vec![new_target.clone()];
                                        match coordinator.find_best_context_match(&candidates) {
                                            MatchResult::Unique(best) => {
                                                set_runtime_active_target(&state_ev, Some(best));
                                            }
                                            MatchResult::Ambiguous(matched) => {
                                                let mut payload = build_mutation_payload(
                                                    &app_handle_ev,
                                                    &state_ev,
                                                    true,
                                                );
                                                payload.available_windows = matched;
                                                let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                            }
                                            MatchResult::None => {
                                                set_runtime_active_target(
                                                    &state_ev,
                                                    Some(new_target),
                                                );
                                            }
                                        }
                                        let payload = build_mutation_payload(
                                            &app_handle_ev,
                                            &state_ev,
                                            false,
                                        );
                                        let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                    }
                                }
                            }

                        }
                    } else if tick_counter % 4 == 0 {
                        #[cfg(target_os = "windows")]
                        {
                            let state_ev = app_handle_ev.state::<AppState>();
                            let lifecycle_generation = state_ev
                                .native_lifecycle_generation
                                .load(Ordering::Acquire);
                            if let Some(target) = coordinator.get_active_target() {
                                let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) else {
                                    if clear_active_target_and_hide_note_if_current(
                                        &app_handle_ev,
                                        &state_ev,
                                        lifecycle_generation,
                                        target.hwnd_val,
                                    ) {
                                        let payload = build_mutation_payload(
                                            &app_handle_ev,
                                            &state_ev,
                                            false,
                                        );
                                        let _ = app_handle_ev
                                            .emit("skribly://overlay-update", payload);
                                    }
                                    continue;
                                };

                                if let Some(updated) = inspect_target_window(hwnd) {
                                    let placement_changed = updated.bounds != target.bounds
                                        || updated.dpi != target.dpi;
                                    let refreshed_committed = commit_refreshed_target_if_current(
                                        &state_ev,
                                        lifecycle_generation,
                                        target.hwnd_val,
                                        updated.clone(),
                                    )
                                    .unwrap_or(false);
                                    let note_window_visible = app_handle_ev
                                        .get_webview_window("main")
                                        .and_then(|window| window.is_visible().ok())
                                        .unwrap_or(false);
                                    let context_rail_tracks_target = context_rail_window_runtime()
                                        .context_placement()
                                        .is_some_and(|placement| {
                                            placement.target_hwnd == updated.hwnd_val
                                        });
                                    if refreshed_committed
                                        && placement_changed
                                        && context_rail_tracks_target
                                    {
                                        if let Err(message) = show_context_rail_for_target(
                                            &app_handle_ev,
                                            &state_ev,
                                            &updated,
                                        ) {
                                            let _ = app_handle_ev.emit(
                                                "skribly://hotkey-error",
                                                format!("Skribli could not keep the note bar with this app: {message}"),
                                            );
                                        }
                                    }
                                    if refreshed_committed
                                        && placement_changed
                                        && note_window_visible
                                    {
                                        if let Some(window) =
                                            app_handle_ev.get_webview_window("main")
                                        {
                                            if let Err(message) = position_active_note_window(
                                                &window,
                                                &state_ev,
                                                &updated,
                                            )
                                            {
                                                let _ = app_handle_ev.emit(
                                                    "skribly://hotkey-error",
                                                    format!("Skribli could not update the editor position after a display change: {message}"),
                                                );
                                            }
                                        }
                                    }
                                } else {
                                    if clear_active_target_and_hide_note_if_current(
                                        &app_handle_ev,
                                        &state_ev,
                                        lifecycle_generation,
                                        target.hwnd_val,
                                    ) {
                                        let payload = build_mutation_payload(
                                            &app_handle_ev,
                                            &state_ev,
                                            false,
                                        );
                                        let _ = app_handle_ev
                                            .emit("skribly://overlay-update", payload);
                                    }
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Skribli");

    app.run(move |app_handle, event| match event {
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Focused(true),
            ..
        } if label == "home" || label == "library" => {
            // External hooks skip our process; Home must not inherit another app's indicator.
            hide_context_note_rail(app_handle);
        }
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Resized(size),
            ..
        } if label == "main" && size.width >= 200 && size.height >= 200 => {
            // Windows grows a transparent HWND before WebView content catches up. Refresh the
            // rounded region on each native resize frame so newly exposed pixels never become a
            // white rectangle. Geometry persistence remains debounced in the frontend.
            #[cfg(target_os = "windows")]
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = refresh_note_window_surface(&window);
            }
        }
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Moved(position),
            ..
        } if label == "rail" => {
            schedule_rail_edge_dock(app_handle, "rail", false, position);
        }
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Moved(position),
            ..
        } if label == "context-rail" => {
            schedule_rail_edge_dock(app_handle, "context-rail", true, position);
        }
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Moved(_) | tauri::WindowEvent::ScaleFactorChanged { .. },
            ..
        } if label == "main" => {
            // Rebuild the rounded native region after a per-monitor DPI transition. Collapsed
            // dots use a different region and are deliberately excluded by their 44px surface.
            #[cfg(target_os = "windows")]
            if let Some(window) = app_handle.get_webview_window("main") {
                if window
                    .inner_size()
                    .map(|size| size.width >= 200 && size.height >= 200)
                    .unwrap_or(false)
                {
                    let _ = refresh_note_window_surface(&window);
                }
            }
        }
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" || label == "home" || label == "library" => {
            api.prevent_close();
            if label == "main" {
                let state = app_handle.state::<AppState>();
                hide_main_note_window_as_lifecycle_action(app_handle, &state);
            } else if let Some(window) = app_handle.get_webview_window(label.as_str()) {
                let _ = window.hide();
            }
        }
        RunEvent::Exit => {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.hide();
            }
            running.store(false, Ordering::Relaxed);
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Ok(hwnd) = window.hwnd() {
                        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
                        uninstall_overlay_subclass(win_hwnd);
                        uninstall_winevent_hooks();
                    }
                }
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detached_note_moves_never_rewrite_the_saved_context_anchor() {
        let mut runtime = NoteWindowRuntime::default();
        runtime.record_detached_placement("note-a", &OverlayMetrics::default());
        assert_eq!(runtime.detached_note_id(), Some("note-a"));
        assert!(runtime.should_ignore_position_save("note-a", 100, 200));
        assert!(runtime.should_ignore_position_save("note-a", 700, 800));
        runtime.record_programmatic_placement("note-a", false, &OverlayMetrics::default());
        assert_eq!(runtime.detached_note_id(), None);
        assert!(!runtime.should_ignore_position_save("note-a", 700, 800));
    }

    #[test]
    fn clearing_a_detached_note_removes_its_transient_state() {
        let mut runtime = NoteWindowRuntime::default();
        runtime.record_detached_placement("note-a", &OverlayMetrics::default());
        runtime.record_open_request(detached_open_request("note-a".into()));
        runtime.clear();
        assert_eq!(runtime.detached_note_id(), None);
        assert_eq!(runtime.pending_open_request(), None);
    }

    #[test]
    fn temporary_tool_geometry_never_becomes_the_saved_size() {
        let note = color_note("note-a", "mint", 1);
        let mut runtime = NoteWindowRuntime::default();
        runtime.record_programmatic_placement(&note.id, false, &OverlayMetrics::default());
        runtime.record_size_mode(&note, 640.0, 660.0, true);
        assert_eq!(
            runtime.dimensions_to_save(&note, (640.0, 660.0)),
            (note.width, note.height)
        );
        runtime.record_programmatic_placement(&note.id, false, &OverlayMetrics::default());
        assert_eq!(
            runtime.borrowed_dimensions_for(&note.id),
            Some((640.0, 660.0))
        );
        runtime.record_size_mode(&note, note.width, note.height, true);
        assert_eq!(runtime.borrowed_dimensions_for(&note.id), None);
        runtime.record_size_mode(&note, 640.0, 660.0, true);
        runtime.clear();
        assert_eq!(runtime.borrowed_dimensions_for(&note.id), None);
        assert_eq!((note.width, note.height), (420.0, 360.0));
    }

    #[test]
    fn manual_sizes_and_new_notes_do_not_inherit_borrowed_dimensions() {
        let note = color_note("note-a", "mint", 1);
        let mut runtime = NoteWindowRuntime::default();
        runtime.record_detached_placement(&note.id, &OverlayMetrics::default());
        runtime.record_size_mode(&note, 640.0, 660.0, true);
        runtime.record_size_mode(&note, 500.0, 500.0, false);
        assert_eq!(
            runtime.dimensions_to_save(&note, (500.0, 500.0)),
            (500.0, 500.0)
        );
        runtime.record_size_mode(&note, 640.0, 660.0, true);
        runtime.record_programmatic_placement("note-b", false, &OverlayMetrics::default());
        assert_eq!(runtime.borrowed_dimensions_for("note-b"), None);
    }

    #[test]
    fn global_and_context_rail_have_distinct_collapsed_sizes() {
        assert_eq!(rail_surface_dimensions(true, false), (364.0, 430.0));
        assert_eq!(rail_surface_dimensions(true, true), (460.0, 250.0));
        assert_eq!(rail_surface_dimensions(false, false), (28.0, 80.0));
        assert_eq!(rail_surface_dimensions(false, true), (28.0, 28.0));
    }

    #[test]
    fn detached_reads_use_the_invoking_rail_not_the_global_default() {
        let current = RailWindowState {
            expanded: true,
            revealed: false,
            arrival_revision: 8,
            ..Default::default()
        };
        assert_eq!(
            detached_note_rail_label("context-rail", true, Some(8), current).unwrap(),
            "context-rail"
        );
        for caller in ["rail", "home", "library"] {
            assert_eq!(
                detached_note_rail_label(caller, false, None, current).unwrap(),
                "rail"
            );
        }
    }

    #[test]
    fn detached_reads_reject_hidden_or_changed_contexts_after_saving() {
        let current = RailWindowState {
            expanded: true,
            revealed: false,
            arrival_revision: 8,
            ..Default::default()
        };
        assert!(detached_note_rail_label("context-rail", false, Some(8), current).is_err());
        assert!(detached_note_rail_label("context-rail", true, Some(7), current).is_err());
    }

    #[test]
    fn context_actions_reject_old_arrivals_but_preserve_legacy_callers() {
        let current = RailWindowState {
            expanded: false,
            revealed: false,
            arrival_revision: 8,
            ..Default::default()
        };
        assert!(!context_arrival_matches(Some(7), current));
        assert!(context_arrival_matches(Some(8), current));
        assert!(context_arrival_matches(None, current));
    }

    #[test]
    fn context_presence_arrives_once_until_context_changes() {
        let runtime = RailWindowRuntime::default();
        let target = test_target(10, "First page");
        runtime.arrive(&target);
        assert_eq!(runtime.arrival_revision.load(Ordering::Acquire), 1);
        runtime.revealed.store(false, Ordering::Release);
        runtime.arrive(&target);
        assert_eq!(runtime.arrival_revision.load(Ordering::Acquire), 1);
        assert!(!runtime.revealed.load(Ordering::Acquire));
        runtime.arrive(&test_target(10, "Second page"));
        assert_eq!(runtime.arrival_revision.load(Ordering::Acquire), 2);
        assert!(runtime.revealed.load(Ordering::Acquire));
    }

    #[test]
    fn context_peek_geometry_keeps_its_dot_anchor_stable() {
        let bounds = RailDockBounds {
            x: 0,
            y: 0,
            width: 1200,
            height: 900,
        };
        let dot = PhysicalSize::new(28, 28);
        let peek = PhysicalSize::new(164, 36);
        let origin = PhysicalPosition::new(1100, 300);
        let revealed = context_rail_position_after_size_change(origin, dot, peek, bounds, 8);
        assert_eq!(revealed, PhysicalPosition::new(964, 296));
        assert_eq!(
            context_rail_position_after_size_change(revealed, peek, dot, bounds, 8),
            origin
        );
        assert_eq!(
            context_rail_surface_dimensions(RailWindowState {
                expanded: false,
                revealed: true,
                arrival_revision: 1,
                ..Default::default()
            }),
            (164.0, 36.0)
        );
        assert_eq!(
            context_rail_surface_dimensions(RailWindowState {
                expanded: false,
                revealed: false,
                arrival_revision: 1,
                ..Default::default()
            }),
            (28.0, 28.0)
        );
    }

    #[test]
    fn exact_note_dimensions_preserve_manual_sizes_within_native_limits() {
        for (width, height) in [(320.0, 260.0), (537.5, 418.25), (820.0, 760.0)] {
            assert!(validate_note_dimensions(width, height).is_ok());
        }
        for (width, height) in [
            (319.0, 360.0),
            (420.0, 259.0),
            (821.0, 360.0),
            (420.0, 761.0),
            (f64::NAN, 360.0),
            (420.0, f64::INFINITY),
            (f64::NEG_INFINITY, 360.0),
        ] {
            assert!(validate_note_dimensions(width, height).is_err());
        }
    }

    #[test]
    fn rail_payload_identifies_its_window_revision_and_dock_edge() {
        let payload = serde_json::to_value(RailWindowState {
            contextual: true,
            state_revision: 42,
            dock_side: RailDockSide::Left,
            ..Default::default()
        })
        .unwrap();
        assert_eq!(payload["contextual"], true);
        assert_eq!(payload["revision"], 42);
        assert_eq!(payload["dockSide"], "left");
    }

    #[test]
    fn rail_expansion_keeps_both_edges_on_a_negative_coordinate_monitor() {
        let bounds = RailDockBounds {
            x: -1920,
            y: -200,
            width: 1920,
            height: 1080,
        };
        let small = PhysicalSize::new(28, 80);
        let large = PhysicalSize::new(364, 430);
        for (origin, expanded) in [
            (
                PhysicalPosition::new(-1920, 100),
                PhysicalPosition::new(-1920, 100),
            ),
            (
                PhysicalPosition::new(-28, 100),
                PhysicalPosition::new(-364, 100),
            ),
        ] {
            assert_eq!(
                rail_position_after_size_change(origin, small, large, bounds, 0),
                expanded
            );
            assert_eq!(
                rail_position_after_size_change(expanded, large, small, bounds, 0),
                origin
            );
        }
    }

    #[test]
    fn left_context_presence_unfolds_inward_without_losing_its_anchor() {
        let bounds = RailDockBounds {
            x: 0,
            y: 0,
            width: 1200,
            height: 900,
        };
        let dot = PhysicalSize::new(28, 28);
        let peek = PhysicalSize::new(164, 36);
        let origin = PhysicalPosition::new(8, 300);
        let revealed = context_rail_position_after_size_change(origin, dot, peek, bounds, 8);
        assert_eq!(revealed, PhysicalPosition::new(8, 296));
        assert_eq!(
            context_rail_position_after_size_change(revealed, peek, dot, bounds, 8),
            origin
        );
    }

    #[test]
    fn dragged_context_bar_stays_inside_its_target_application() {
        let target = RailDockBounds {
            x: -1200,
            y: 80,
            width: 900,
            height: 700,
        };
        let size = PhysicalSize::new(164, 50);

        assert_eq!(
            clamp_rail_position_to_bounds(PhysicalPosition::new(-1500, -200), size, target, 8,),
            PhysicalPosition::new(-1192, 88)
        );
        assert_eq!(
            clamp_rail_position_to_bounds(PhysicalPosition::new(0, 900), size, target, 8),
            PhysicalPosition::new(-472, 722)
        );
    }

    fn color_note(id: &str, color: &str, created_at: u64) -> SkribNote {
        SkribNote {
            id: id.into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document.txt - Notepad".into(),
            rel_x: 0.0,
            rel_y: 0.0,
            width: 420.0,
            height: 360.0,
            text: String::new(),
            color: color.into(),
            collapsed: false,
            created_at,
            updated_at: created_at,
            archived_at: None,
            deleted_at: None,
        }
    }

    fn test_target(hwnd_val: isize, title: &str) -> TargetWindowInfo {
        TargetWindowInfo {
            hwnd_val,
            title: title.into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: core::models::WindowRect {
                x: 100,
                y: 80,
                width: 1200,
                height: 800,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 96,
            scale_factor: 1.0,
        }
    }

    #[test]
    fn rail_dock_uses_the_nearest_work_area_edge_and_preserves_y() {
        let work_area = RailDockBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        };
        let window_size = PhysicalSize::new(164, 50);

        assert_eq!(
            nearest_rail_edge_position(PhysicalPosition::new(120, 480), window_size, work_area, 8,),
            PhysicalPosition::new(8, 480)
        );
        assert_eq!(
            nearest_rail_edge_position(PhysicalPosition::new(1700, 480), window_size, work_area, 8,),
            PhysicalPosition::new(1748, 480)
        );
    }

    #[test]
    fn rail_dock_clamps_y_inside_negative_origin_monitor_work_area() {
        let work_area = RailDockBounds {
            x: -1920,
            y: -120,
            width: 1920,
            height: 1080,
        };
        let window_size = PhysicalSize::new(164, 50);

        assert_eq!(
            nearest_rail_edge_position(
                PhysicalPosition::new(-100, 1200),
                window_size,
                work_area,
                8,
            ),
            PhysicalPosition::new(-172, 902)
        );
    }

    #[test]
    fn rail_resize_preserves_docked_side_and_y_while_growing_inward() {
        let work_area = RailDockBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        };
        let collapsed = PhysicalSize::new(164, 50);
        let expanded = PhysicalSize::new(364, 430);

        assert_eq!(
            rail_position_after_size_change(
                PhysicalPosition::new(1748, 480),
                collapsed,
                expanded,
                work_area,
                8,
            ),
            PhysicalPosition::new(1548, 480)
        );
        assert_eq!(
            rail_position_after_size_change(
                PhysicalPosition::new(8, 900),
                collapsed,
                expanded,
                work_area,
                8,
            ),
            PhysicalPosition::new(8, 602)
        );
    }

    #[test]
    fn programmatic_rail_placement_cancels_a_pending_user_snap() {
        let runtime = RailWindowRuntime::default();
        let generation = runtime.begin_user_movement();
        assert!(runtime.movement_is_current(generation));

        let position = PhysicalPosition::new(400, 240);
        runtime.record_programmatic_position(position);

        assert!(!runtime.movement_is_current(generation));
        assert!(runtime.consume_programmatic_movement(position));
    }

    #[test]
    fn rapid_programmatic_rail_placements_ignore_both_move_events() {
        let runtime = RailWindowRuntime::default();
        let first = PhysicalPosition::new(400, 240);
        let second = PhysicalPosition::new(420, 260);

        runtime.record_programmatic_position(first);
        runtime.record_programmatic_position(second);

        assert!(runtime.consume_programmatic_movement(first));
        assert!(runtime.consume_programmatic_movement(second));
    }

    #[test]
    fn new_notes_rotate_through_the_website_pastels_after_restart() {
        assert_eq!(next_note_color(&[]), "yellow");
        assert_eq!(next_note_color(&[color_note("one", "yellow", 1)]), "peach");
        assert_eq!(
            next_note_color(&[
                color_note("older", "peach", 1),
                color_note("latest", "lavender", 2),
            ]),
            "rose"
        );
        assert_eq!(next_note_color(&[color_note("last", "sand", 3)]), "yellow");
    }

    #[test]
    fn native_window_positions_round_trip_as_target_relative_logical_units() {
        let target = TargetWindowInfo {
            hwnd_val: 1,
            title: "Document".into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: core::models::WindowRect {
                x: 2000,
                y: 120,
                width: 1200,
                height: 800,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 144,
            scale_factor: 1.5,
        };
        let (rel_x, rel_y) = relative_note_position(&target, 2300, 270);
        assert_eq!((rel_x, rel_y), (200.0, 100.0));
    }

    #[test]
    fn expanded_workspace_mode_survives_programmatic_reanchoring() {
        let mut runtime = NoteWindowRuntime::default();
        let initial = OverlayMetrics {
            overlay_physical_x: 300,
            overlay_physical_y: 180,
            ..OverlayMetrics::default()
        };
        runtime.record_programmatic_placement("note-a", true, &initial);
        assert!(runtime.workspace_expanded_for("note-a"));

        let reanchored = OverlayMetrics {
            overlay_physical_x: 640,
            overlay_physical_y: 240,
            ..OverlayMetrics::default()
        };
        runtime.record_programmatic_placement("note-a", true, &reanchored);

        assert!(runtime.workspace_expanded_for("note-a"));
        assert!(!runtime.workspace_expanded_for("note-b"));
    }

    #[test]
    fn reposition_layout_follows_the_active_workspace_mode() {
        let mut runtime = NoteWindowRuntime::default();
        let metrics = OverlayMetrics {
            overlay_physical_x: 320,
            overlay_physical_y: 200,
            ..OverlayMetrics::default()
        };

        assert!(!runtime.workspace_is_expanded());
        runtime.record_programmatic_placement("note-a", false, &metrics);
        assert!(!runtime.workspace_is_expanded());

        runtime.record_programmatic_placement("note-a", true, &metrics);
        assert!(runtime.workspace_is_expanded());

        runtime.record_programmatic_placement("note-a", false, &metrics);
        assert!(!runtime.workspace_is_expanded());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn visible_note_destroy_event_disconnects_instead_of_being_skipped() {
        assert_eq!(
            classify_visible_note_target_event(EVENT_OBJECT_DESTROY, 42, Some(42)),
            VisibleNoteTargetEvent::Disconnect
        );
        assert_eq!(
            classify_visible_note_target_event(EVENT_OBJECT_LOCATIONCHANGE, 42, Some(42)),
            VisibleNoteTargetEvent::Reanchor
        );
        assert_eq!(
            classify_visible_note_target_event(EVENT_OBJECT_DESTROY, 99, Some(42)),
            VisibleNoteTargetEvent::Ignore
        );
        assert_eq!(
            classify_visible_note_target_event(EVENT_OBJECT_HIDE, 42, Some(42)),
            VisibleNoteTargetEvent::Disconnect
        );
    }

    #[test]
    fn clearing_native_note_runtime_removes_stale_window_state() {
        let metrics = OverlayMetrics {
            overlay_physical_x: 200,
            overlay_physical_y: 160,
            ..OverlayMetrics::default()
        };
        let mut runtime = NoteWindowRuntime::default();
        runtime.record_programmatic_placement("note-a", true, &metrics);
        runtime.record_open_request(shortcut_open_request("note-a".into(), 2));

        runtime.clear();

        assert_eq!(runtime.active_note_id(), None);
        assert_eq!(runtime.pending_open_request(), None);
        assert!(!runtime.workspace_is_expanded());
        assert!(!runtime.should_ignore_position_save("note-a", 200, 160));
    }

    #[test]
    fn pending_open_request_survives_until_the_matching_note_acknowledges_it() {
        let mut runtime = NoteWindowRuntime::default();
        let request = shortcut_open_request("note-a".into(), 3);
        runtime.record_open_request(request.clone());

        assert_eq!(runtime.pending_open_request(), Some(request));
        assert!(!runtime.acknowledge_open_request("note-b"));
        assert!(runtime.pending_open_request().is_some());
        assert!(runtime.acknowledge_open_request("note-a"));
        assert_eq!(runtime.pending_open_request(), None);
    }

    #[test]
    fn dismissed_collapsed_note_restores_only_for_its_matching_context() {
        let mut note = color_note("note-a", "sky", 1);
        note.collapsed = true;
        let original_target = test_target(42, "Document.txt - Notepad");
        let mut unrelated_target = test_target(77, "Other app");
        unrelated_target.process_name = "other.exe".into();
        let reopened_target = test_target(99, "Document.txt - Notepad");
        let mut runtime = NoteWindowRuntime::default();
        runtime.dismiss_collapsed_window(&note, &original_target);
        let dismissed = runtime
            .dismissed_collapsed_window()
            .expect("dismissed runtime");

        assert!(!dismissed_collapsed_target_matches(
            dismissed,
            &note,
            &unrelated_target
        ));
        assert!(runtime.dismissed_collapsed_window().is_some());
        assert!(dismissed_collapsed_target_matches(
            dismissed,
            &note,
            &reopened_target
        ));

        runtime.record_programmatic_placement("note-a", false, &OverlayMetrics::default());
        assert!(runtime.dismissed_collapsed_window().is_none());
        assert!(note.collapsed);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn dismissal_ignores_immediate_foreground_then_restores_after_leave_and_return() {
        let mut note = color_note("note-a", "sky", 1);
        note.collapsed = true;
        let matching = test_target(42, "Document.txt - Notepad");
        let mut unrelated = test_target(77, "Other app");
        unrelated.process_name = "other.exe".into();
        let mut runtime = NoteWindowRuntime::default();
        runtime.dismiss_collapsed_window(&note, &matching);
        let unarmed = runtime
            .dismissed_collapsed_window()
            .expect("unarmed dismissal")
            .clone();

        assert!(!unarmed.armed);
        assert_eq!(
            classify_dismissed_target_event(EVENT_SYSTEM_FOREGROUND, &unarmed, &note, &matching,),
            DismissedTargetEventTransition::Ignore
        );
        assert_eq!(
            classify_dismissed_target_event(EVENT_SYSTEM_FOREGROUND, &unarmed, &note, &unrelated,),
            DismissedTargetEventTransition::Arm
        );
        assert!(runtime.arm_dismissed_collapsed_window(&unarmed));
        let armed = runtime
            .dismissed_collapsed_window()
            .expect("armed dismissal");
        assert!(armed.armed);
        assert_eq!(
            classify_dismissed_target_event(EVENT_SYSTEM_FOREGROUND, armed, &note, &matching),
            DismissedTargetEventTransition::Restore
        );
        assert_eq!(
            classify_dismissed_target_event(EVENT_OBJECT_DESTROY, armed, &note, &matching),
            DismissedTargetEventTransition::Ignore
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn same_browser_window_tab_away_arms_then_tab_return_restores() {
        let mut note = color_note("note-a", "lavender", 1);
        note.collapsed = true;
        note.target_process_name = "chrome.exe".into();
        note.target_title = "Saved page - Google Chrome".into();
        let mut matching = test_target(42, &note.target_title);
        matching.process_name = "chrome.exe".into();
        let mut tab_away = matching.clone();
        tab_away.title = "Completely unrelated context".into();
        let mut runtime = NoteWindowRuntime::default();
        runtime.dismiss_collapsed_window(&note, &matching);
        let unarmed = runtime
            .dismissed_collapsed_window()
            .expect("unarmed dismissal")
            .clone();

        assert_eq!(
            classify_dismissed_target_event(EVENT_OBJECT_NAMECHANGE, &unarmed, &note, &tab_away,),
            DismissedTargetEventTransition::Arm
        );
        assert!(runtime.arm_dismissed_collapsed_window(&unarmed));
        assert_eq!(
            classify_dismissed_target_event(
                EVENT_OBJECT_NAMECHANGE,
                runtime
                    .dismissed_collapsed_window()
                    .expect("armed dismissal"),
                &note,
                &matching,
            ),
            DismissedTargetEventTransition::Restore
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn visible_collapsed_dot_hides_off_context_and_restores_when_linked_context_returns() {
        let mut note = color_note("note-a", "mint", 1);
        note.collapsed = true;
        let linked = test_target(42, "Document.txt - Notepad");
        let unrelated = test_target(77, "Other.txt - Notepad");

        assert!(!collapsed_dot_should_hide_for_context(
            EVENT_SYSTEM_FOREGROUND,
            &note,
            &linked,
            &linked,
        ));
        assert!(collapsed_dot_should_hide_for_context(
            EVENT_SYSTEM_FOREGROUND,
            &note,
            &linked,
            &unrelated,
        ));

        let mut runtime = NoteWindowRuntime::default();
        runtime.hide_active_note_until_context_returns(&note, &linked);
        let hidden = runtime
            .dismissed_collapsed_window()
            .expect("context-hidden dot");
        assert!(hidden.armed);
        assert_eq!(
            classify_dismissed_target_event(EVENT_SYSTEM_FOREGROUND, hidden, &note, &linked),
            DismissedTargetEventTransition::Restore
        );

        note.collapsed = false;
        assert!(!collapsed_dot_should_hide_for_context(
            EVENT_SYSTEM_FOREGROUND,
            &note,
            &linked,
            &unrelated,
        ));
        assert!(active_note_should_hide_for_context(
            EVENT_SYSTEM_FOREGROUND,
            &note,
            &linked,
            &unrelated,
        ));
        assert!(!active_note_should_hide_for_context(
            EVENT_SYSTEM_FOREGROUND,
            &note,
            &linked,
            &linked,
        ));
    }

    #[test]
    fn stale_dismiss_action_cannot_overwrite_a_newer_native_note() {
        let target = test_target(42, "Document.txt - Notepad");

        assert!(dismissal_snapshot_can_commit(
            7,
            7,
            "note-a",
            42,
            Some("note-a"),
            Some(&target),
        ));
        assert!(!dismissal_snapshot_can_commit(
            7,
            8,
            "note-a",
            42,
            Some("note-a"),
            Some(&target),
        ));
        assert!(!dismissal_snapshot_can_commit(
            7,
            7,
            "note-a",
            42,
            Some("note-b"),
            Some(&target),
        ));
    }

    #[test]
    fn failed_or_stale_restore_keeps_the_dismissal_available_for_retry() {
        let mut note = color_note("note-a", "sky", 1);
        note.collapsed = true;
        let target = test_target(42, "Document.txt - Notepad");
        let mut runtime = NoteWindowRuntime::default();
        runtime.dismiss_collapsed_window(&note, &target);
        let expected = runtime
            .dismissed_collapsed_window()
            .expect("dismissed runtime")
            .clone();

        assert!(!dismissed_restore_can_commit(
            false,
            11,
            11,
            &expected,
            runtime.dismissed_collapsed_window(),
        ));
        assert!(runtime.dismissed_collapsed_window().is_some());
        assert!(!dismissed_restore_can_commit(
            true,
            11,
            12,
            &expected,
            runtime.dismissed_collapsed_window(),
        ));
        assert!(runtime.dismissed_collapsed_window().is_some());
        assert!(dismissed_restore_can_commit(
            true,
            11,
            11,
            &expected,
            runtime.dismissed_collapsed_window(),
        ));

        runtime.record_programmatic_placement("note-a", false, &OverlayMetrics::default());
        assert!(runtime.dismissed_collapsed_window().is_none());
    }

    #[test]
    fn stale_watchdog_sample_cannot_clear_a_newer_target() {
        let old_target = test_target(42, "Document.txt - Notepad");
        let new_target = test_target(99, "Other.txt - Notepad");

        assert!(lifecycle_snapshot_can_clear_target(
            3,
            3,
            42,
            Some(&old_target),
        ));
        assert!(!lifecycle_snapshot_can_clear_target(
            3,
            4,
            42,
            Some(&old_target),
        ));
        assert!(!lifecycle_snapshot_can_clear_target(
            3,
            3,
            42,
            Some(&new_target),
        ));
    }

    #[test]
    fn native_window_transactions_are_serialized_through_physical_commit() {
        let gate = Arc::new(NativeWindowOperationGate::default());
        let order = Arc::new(Mutex::new(Vec::new()));
        let first_guard = gate.lock().expect("first native transaction");
        order.lock().expect("order").push("first-start");

        let (attempted_tx, attempted_rx) = std::sync::mpsc::channel();
        let second_gate = gate.clone();
        let second_order = order.clone();
        let second = std::thread::spawn(move || {
            attempted_tx.send(()).expect("signal second attempt");
            let _second_guard = second_gate.lock().expect("second native transaction");
            second_order.lock().expect("order").push("second-enter");
        });

        attempted_rx.recv().expect("second attempted the gate");
        order.lock().expect("order").push("first-commit");
        drop(first_guard);
        second.join().expect("second transaction");

        assert_eq!(
            *order.lock().expect("order"),
            vec!["first-start", "first-commit", "second-enter"]
        );
    }

    #[test]
    fn removing_the_active_note_requires_the_full_native_clear_path() {
        assert!(active_note_removal_requires_full_clear(
            Some("note-a"),
            "note-a"
        ));
        assert!(!active_note_removal_requires_full_clear(
            Some("note-b"),
            "note-a"
        ));
        assert!(!active_note_removal_requires_full_clear(None, "note-a"));
    }

    #[test]
    fn target_watchdog_rejects_hidden_window_handle_reuse() {
        let active = test_target(42, "Document.txt - Notepad");
        let same = test_target(42, "Document renamed.txt - Notepad");
        let reused_process = TargetWindowInfo {
            process_name: "explorer.exe".into(),
            class_name: "CabinetWClass".into(),
            ..test_target(42, "Folder")
        };
        let different_handle = test_target(99, "Document.txt - Notepad");

        assert!(refreshed_target_preserves_identity(&active, &same));
        assert!(!refreshed_target_preserves_identity(
            &active,
            &reused_process
        ));
        assert!(!refreshed_target_preserves_identity(
            &active,
            &different_handle
        ));
    }

    #[test]
    fn programmatic_workspace_move_does_not_replace_the_saved_compact_anchor() {
        let target = TargetWindowInfo {
            hwnd_val: 1,
            title: "Document".into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: core::models::WindowRect {
                x: 100,
                y: 80,
                width: 1200,
                height: 800,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 96,
            scale_factor: 1.0,
        };
        let note = SkribNote {
            rel_x: 44.0,
            rel_y: 52.0,
            ..color_note("note-a", "mint", 1)
        };
        let workspace = OverlayMetrics {
            overlay_physical_x: 420,
            overlay_physical_y: 260,
            ..OverlayMetrics::default()
        };
        let mut runtime = NoteWindowRuntime::default();
        runtime.record_programmatic_placement("note-a", true, &workspace);

        assert!(runtime.should_ignore_position_save("note-a", 420, 260));
        assert_eq!(
            position_to_persist(&target, &note, 420, 260, true),
            (44.0, 52.0)
        );
        assert!(!runtime.should_ignore_position_save("note-a", 500, 320));
        assert_eq!(
            position_to_persist(&target, &note, 500, 320, false),
            (400.0, 240.0)
        );
    }

    #[test]
    fn test_mutation_payload_does_not_enumerate_windows() {
        let coordinator = Coordinator::new();
        #[cfg(target_os = "windows")]
        platform::windows::reset_window_enumeration_count();

        let active_target = coordinator.get_active_target();
        let skribs = coordinator.get_all_skribs();
        let payload = OverlayStatePayload {
            active_target,
            skribs,
            available_windows: Vec::new(),
            is_shortcut_active: false,
            is_ambiguous: false,
            overlay_metrics: OverlayMetrics::default(),
            init_status: OverlayInitializationStatus::Initializing,
        };

        assert!(payload.available_windows.is_empty());

        #[cfg(target_os = "windows")]
        assert_eq!(platform::windows::get_window_enumeration_count(), 0);
    }

    #[test]
    fn test_overlay_initialization_status_transitions() {
        let coordinator = Coordinator::new();
        #[cfg(target_os = "windows")]
        let (win_event_pipeline, _event_receiver) = WinEventPipeline::new(WIN_EVENT_QUEUE_CAPACITY);
        let app_state = AppState {
            coordinator,
            running: Arc::new(AtomicBool::new(true)),
            init_status: Mutex::new(OverlayInitializationStatus::Initializing),
            mutation_lock: Mutex::new(()),
            storage: Mutex::new(storage::StorageService::new(
                std::env::temp_dir().join("skribly-test.json"),
            )),
            storage_notice: Mutex::new(None),
            storage_error: Mutex::new(None),
            note_window_runtime: Mutex::new(NoteWindowRuntime::default()),
            native_lifecycle_generation: AtomicU64::new(0),
            native_lifecycle_commit_lock: Mutex::new(()),
            native_window_operation_gate: NativeWindowOperationGate::default(),
            #[cfg(target_os = "windows")]
            win_event_pipeline,
        };

        assert_eq!(
            app_state.get_init_status(),
            OverlayInitializationStatus::Initializing
        );

        let metrics = OverlayMetrics {
            overlay_physical_x: 0,
            overlay_physical_y: 0,
            overlay_physical_width: 1920,
            overlay_physical_height: 1080,
            dpi: 96,
            scale_factor: 1.0,
        };

        app_state.set_init_status(OverlayInitializationStatus::Ready(metrics.clone()));
        assert_eq!(
            app_state.get_init_status(),
            OverlayInitializationStatus::Ready(metrics)
        );

        app_state.set_init_status(OverlayInitializationStatus::Failed(
            "Bounds mismatch".into(),
        ));
        assert_eq!(
            app_state.get_init_status(),
            OverlayInitializationStatus::Failed("Bounds mismatch".into())
        );
    }

    #[test]
    fn disconnected_context_hides_stored_skribs() {
        let coordinator = Coordinator::new();
        coordinator.upsert_skrib(SkribNote {
            id: "note-a".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document-A.txt - Notepad".into(),
            rel_x: 20.0,
            rel_y: 20.0,
            width: 300.0,
            height: 220.0,
            text: "Stored, but not globally visible".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 1,
            archived_at: None,
            deleted_at: None,
        });

        assert!(visible_skribs(&coordinator, None).is_empty());
        assert_eq!(coordinator.get_all_skribs().len(), 1);
    }

    #[test]
    fn failed_persistence_restores_the_previous_coordinator_snapshot() {
        let directory = std::env::temp_dir().join(format!(
            "skribly-lib-storage-rollback-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&directory);
        std::fs::create_dir_all(&directory).expect("create test directory");
        let storage_path = directory.join("skribs.json");
        std::fs::write(
            &storage_path,
            r#"{"schema_version":99,"revision":1,"written_at_ms":1,"integrity":"future","skribs":[]}"#,
        )
        .expect("write unsupported schema fixture");

        let mut storage_service = storage::StorageService::new(storage_path);
        assert!(storage_service.load().is_err());
        let coordinator = Coordinator::new();
        let original = SkribNote {
            id: "note-a".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document-A.txt - Notepad".into(),
            rel_x: 20.0,
            rel_y: 20.0,
            width: 300.0,
            height: 220.0,
            text: "Original".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 1,
            archived_at: None,
            deleted_at: None,
        };
        coordinator.upsert_skrib(original.clone());
        #[cfg(target_os = "windows")]
        let (win_event_pipeline, _event_receiver) = WinEventPipeline::new(WIN_EVENT_QUEUE_CAPACITY);
        let app_state = AppState {
            coordinator: coordinator.clone(),
            running: Arc::new(AtomicBool::new(true)),
            init_status: Mutex::new(OverlayInitializationStatus::Initializing),
            mutation_lock: Mutex::new(()),
            storage: Mutex::new(storage_service),
            storage_notice: Mutex::new(None),
            storage_error: Mutex::new(None),
            note_window_runtime: Mutex::new(NoteWindowRuntime::default()),
            native_lifecycle_generation: AtomicU64::new(0),
            native_lifecycle_commit_lock: Mutex::new(()),
            native_window_operation_gate: NativeWindowOperationGate::default(),
            #[cfg(target_os = "windows")]
            win_event_pipeline,
        };

        let initial_health = app_state.storage_health();
        assert!(!initial_health.writable);
        assert!(initial_health.error.is_some());

        let result = run_persisted_mutation(&app_state, |coordinator| {
            coordinator
                .update_skrib_text("note-a", "Unsaved".to_string())
                .then_some(())
                .ok_or_else(|| "note missing".to_string())
        });
        assert!(result.is_err());
        assert_eq!(coordinator.get_all_skribs(), vec![original]);
        assert!(app_state.storage_health().error.is_some());
        assert!(!app_state.storage_health().writable);
        let _ = std::fs::remove_dir_all(&directory);
    }

    #[test]
    fn note_surface_sizes_are_bounded_product_presets() {
        assert_eq!(note_surface_dimensions("compact"), Ok((420.0, 360.0)));
        assert_eq!(note_surface_dimensions("medium"), Ok((640.0, 600.0)));
        assert_eq!(note_surface_dimensions("large"), Ok((820.0, 760.0)));
        assert!(note_surface_dimensions("fullscreen").is_err());
    }
}
