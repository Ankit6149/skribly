mod core;
mod desktop;
mod note_lifecycle;
mod platform;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

use core::coordinator::{Coordinator, MatchResult};
use core::models::{
    HitTestRect, OverlayInitializationStatus, OverlayMetrics, OverlayStatePayload, SkribNote,
    TargetWindowInfo,
};
use core::storage;
use core::{account, license};
use note_lifecycle::{created_open_request, reopened_open_request};

#[cfg(target_os = "windows")]
use platform::windows::{
    get_overlay_metrics as query_overlay_metrics, inspect_target_window, install_overlay_subclass,
    install_winevent_hooks, list_candidate_target_windows, reconstruct_hwnd, set_dpi_awareness,
    start_global_hotkey_listener, uninstall_overlay_subclass, uninstall_winevent_hooks,
    EVENT_OBJECT_DESTROY, EVENT_OBJECT_LOCATIONCHANGE, EVENT_SYSTEM_FOREGROUND,
    EVENT_SYSTEM_MINIMIZEEND, EVENT_SYSTEM_MINIMIZESTART,
};
#[cfg(target_os = "windows")]
use platform::windows_events::{WinEventPipeline, WIN_EVENT_QUEUE_CAPACITY};
#[cfg(target_os = "windows")]
use platform::windows_focus::focus_external_window;
#[cfg(target_os = "windows")]
use platform::windows_placement::{
    initialize_compact_window, position_compact_window_for_target, position_note_window_for_target,
    position_note_workspace_for_target, COMPACT_WINDOW_LOGICAL_HEIGHT,
    COMPACT_WINDOW_LOGICAL_WIDTH,
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

#[derive(Debug, Default)]
pub(crate) struct NoteWindowRuntime {
    active_note_id: Option<String>,
    workspace_expanded: bool,
    pending_programmatic_placement: Option<ProgrammaticNotePlacement>,
}

impl NoteWindowRuntime {
    fn active_note_id(&self) -> Option<&str> {
        self.active_note_id.as_deref()
    }

    fn workspace_expanded_for(&self, note_id: &str) -> bool {
        self.active_note_id.as_deref() == Some(note_id) && self.workspace_expanded
    }

    fn record_programmatic_placement(
        &mut self,
        note_id: &str,
        workspace_expanded: bool,
        metrics: &OverlayMetrics,
    ) {
        self.active_note_id = Some(note_id.to_string());
        self.workspace_expanded = workspace_expanded;
        self.pending_programmatic_placement = Some(ProgrammaticNotePlacement {
            note_id: note_id.to_string(),
            physical_x: metrics.overlay_physical_x,
            physical_y: metrics.overlay_physical_y,
        });
    }

    fn should_ignore_position_save(
        &mut self,
        note_id: &str,
        physical_x: i32,
        physical_y: i32,
    ) -> bool {
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
    #[cfg(target_os = "windows")]
    pub win_event_pipeline: WinEventPipeline,
}

fn set_runtime_active_target(state: &AppState, target: Option<TargetWindowInfo>) {
    #[cfg(target_os = "windows")]
    state
        .win_event_pipeline
        .set_active_target(target.as_ref().map(|target| target.hwnd_val));
    state.coordinator.set_active_target(target);
}

#[cfg(target_os = "windows")]
fn present_target_capture_error(
    app_handle: &AppHandle,
    state: &AppState,
    error: TargetCaptureError,
) {
    set_runtime_active_target(state, None);
    let _ = app_handle.emit("skribly://target-capture-error", error);
    if let Some(window) = app_handle.get_webview_window("main") {
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
    let skribs = visible_skribs(&state.coordinator, active_target.as_ref());
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
    let skribs = visible_skribs(&state.coordinator, active_target.as_ref());
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

fn visible_skribs(
    coordinator: &Coordinator,
    active_target: Option<&TargetWindowInfo>,
) -> Vec<SkribNote> {
    active_target
        .map(|target| coordinator.get_skribs_for_target(target))
        .unwrap_or_default()
}

const NOTE_COLOR_ROTATION: [&str; 5] = ["yellow", "peach", "mint", "sky", "lavender"];

fn next_note_color(notes: &[SkribNote]) -> String {
    let Some(latest) = notes
        .iter()
        .filter(|note| note.deleted_at.is_none())
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
    let runtime_note_id = state
        .note_window_runtime
        .lock()
        .ok()
        .and_then(|runtime| runtime.active_note_id().map(ToString::to_string));
    let note = runtime_note_id
        .and_then(|note_id| state.coordinator.get_skrib(&note_id))
        .filter(|note| {
            note.deleted_at.is_none()
                && note
                    .target_process_name
                    .eq_ignore_ascii_case(&target.process_name)
        })
        .or_else(|| {
            let request = reopened_open_request(state.coordinator.get_skribs_for_target(target))?;
            state.coordinator.get_skrib(&request.note_id)
        })
        .ok_or_else(|| "No active Skrib is available for this application.".to_string())?;
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
    if let Ok(mut runtime) = state.note_window_runtime.lock() {
        runtime.record_programmatic_placement(&note.id, workspace_expanded, &metrics);
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
            initialize_native_overlay(&app_handle, &state, &window);
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
        let metrics = position_compact_window_for_target(&window, &refreshed_target)?;
        set_runtime_active_target(&state, Some(refreshed_target));
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
    set_runtime_active_target(&state, target);
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
    if note.deleted_at.is_some() {
        return Err("A note in Trash cannot be shown on screen.".into());
    }
    let target = state
        .coordinator
        .get_active_target()
        .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The Skrib window is unavailable.".to_string())?;
    let was_workspace_expanded = state
        .note_window_runtime
        .lock()
        .map(|runtime| runtime.workspace_expanded_for(&id))
        .unwrap_or(false);
    let current_position = if was_workspace_expanded {
        None
    } else {
        let current_position = window
            .outer_position()
            .map_err(|error| format!("Skribli could not read the note position: {error}"))?;
        Some(current_position)
    };
    // Opening a larger tool workspace is a native layout operation, not a user move of the
    // compact note. Keep the last saved compact/dot anchor when Done collapses the note.
    let (physical_x, physical_y) = current_position
        .map(|position| (position.x, position.y))
        .unwrap_or((0, 0));
    let (rel_x, rel_y) = position_to_persist(
        &target,
        &note,
        physical_x,
        physical_y,
        was_workspace_expanded,
    );
    let mut positioned_note = note.clone();
    positioned_note.rel_x = rel_x;
    positioned_note.rel_y = rel_y;

    #[cfg(target_os = "windows")]
    let placement = position_note_window_for_target(&window, &target, &positioned_note, collapsed)?;
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
            let _ = if was_workspace_expanded {
                position_note_workspace_for_target(&window, &target, &note)
            } else {
                position_note_window_for_target(&window, &target, &note, note.collapsed)
            };
        }
        return Err(message);
    }

    #[cfg(target_os = "windows")]
    if let Ok(mut runtime) = state.note_window_runtime.lock() {
        runtime.record_programmatic_placement(&id, false, &placement);
    }

    if collapsed {
        let _ = window.show();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn save_skrib_window_position(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    let note = state
        .coordinator
        .get_skrib(&id)
        .ok_or_else(|| "Skrib note was not found or is not writable".to_string())?;
    let target = state
        .coordinator
        .get_active_target()
        .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "The Skrib window is unavailable.".to_string())?;
    let position = window
        .outer_position()
        .map_err(|error| format!("Skribli could not read the note position: {error}"))?;
    if state
        .note_window_runtime
        .lock()
        .map(|mut runtime| runtime.should_ignore_position_save(&id, position.x, position.y))
        .unwrap_or(false)
    {
        return Ok(build_mutation_payload(&app_handle, &state, false));
    }
    let (rel_x, rel_y) = relative_note_position(&target, position.x, position.y);

    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_position(&id, rel_x, rel_y, note.width, note.height)
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
    if note.collapsed || note.deleted_at.is_some() {
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
        let metrics = if expanded {
            position_note_workspace_for_target(&window, &target, &note)
        } else {
            position_note_window_for_target(&window, &target, &note, false)
        }?;
        if let Ok(mut runtime) = state.note_window_runtime.lock() {
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
fn clear_account_entitlement() -> Result<license::LicenseStatus, String> {
    license::deactivate_global()
}

#[tauri::command]
fn refresh_target_state(app_handle: AppHandle, state: State<'_, AppState>) -> OverlayStatePayload {
    let mut is_ambiguous = false;
    #[cfg(target_os = "windows")]
    {
        if let Some(target) = state.coordinator.get_active_target() {
            if let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) {
                if let Some(updated_target) = inspect_target_window(hwnd) {
                    set_runtime_active_target(&state, Some(updated_target));
                } else {
                    set_runtime_active_target(&state, None);
                }
            } else {
                set_runtime_active_target(&state, None);
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        set_dpi_awareness();
    }

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
        #[cfg(target_os = "windows")]
        win_event_pipeline: win_event_pipeline.clone(),
    };

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            list_target_windows,
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
            toggle_skrib_collapse,
            set_skrib_window_collapsed,
            save_skrib_window_position,
            set_skrib_workspace_mode,
            trash_skrib_note,
            discard_empty_skrib_note,
            restore_skrib_note,
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
                        set_runtime_active_target(&state_hk, None);

                        #[cfg(target_os = "windows")]
                        let capture = match capture_foreground_target() {
                            Ok(capture) => capture,
                            Err(error) => {
                                present_target_capture_error(&app_handle_hk, &state_hk, error);
                                continue;
                            }
                        };

                        #[cfg(target_os = "windows")]
                        let target = match revalidate_captured_target(&capture) {
                            Ok(target) => target,
                            Err(error) => {
                                present_target_capture_error(&app_handle_hk, &state_hk, error);
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
                        let initial_metrics =
                            match position_compact_window_for_target(&window, &target) {
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

                        #[cfg(target_os = "windows")]
                        clear_target_capture_error(&app_handle_hk);
                        set_runtime_active_target(&state_hk, Some(target.clone()));
                        let existing_notes = coordinator_hk.get_skribs_for_target(&target);
                        let open_request = if let Some(request) =
                            reopened_open_request(existing_notes)
                        {
                            let Some(note) = coordinator_hk.get_skrib(&request.note_id) else {
                                let _ = app_handle_hk.emit(
                                    "skribly://hotkey-error",
                                    "The saved Skrib could not be loaded. Open All Skribs to recover it.",
                                );
                                continue;
                            };
                            #[cfg(target_os = "windows")]
                            let restored_metrics =
                                match position_note_window_for_target(&window, &target, &note, false)
                                {
                                    Ok(metrics) => metrics,
                                    Err(message) => {
                                        let _ = app_handle_hk.emit(
                                            "skribly://hotkey-error",
                                            format!("Skribli could not restore the saved note position: {message}"),
                                        );
                                        continue;
                                    }
                                };
                            if note.collapsed
                                && run_persisted_mutation(&state_hk, |coordinator| {
                                    coordinator
                                        .set_skrib_collapsed(&request.note_id, false)
                                        .then_some(())
                                        .ok_or_else(|| {
                                            "The saved Skrib could not be expanded.".to_string()
                                        })
                                })
                                .is_err()
                            {
                                let _ = app_handle_hk.emit(
                                    "skribly://storage-error",
                                    "The saved Skrib could not be expanded safely.",
                                );
                                continue;
                            }
                            #[cfg(target_os = "windows")]
                            if let Ok(mut runtime) = state_hk.note_window_runtime.lock() {
                                runtime.record_programmatic_placement(
                                    &request.note_id,
                                    false,
                                    &restored_metrics,
                                );
                            }
                            request
                        } else {
                            let timestamp = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis();
                            let note_id = format!("skrib-hotkey-{timestamp}");
                            let (rel_x, rel_y) = relative_note_position(
                                &target,
                                initial_metrics.overlay_physical_x,
                                initial_metrics.overlay_physical_y,
                            );
                            let new_note = SkribNote {
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
                                deleted_at: None,
                            };
                            if let Err(message) =
                                run_persisted_mutation(&state_hk, |coordinator| {
                                    coordinator
                                        .upsert_skrib(new_note)
                                        .then_some(())
                                        .ok_or_else(|| {
                                            "The new note did not pass native validation."
                                                .to_string()
                                        })
                                })
                            {
                                let _ = app_handle_hk.emit("skribly://storage-error", message);
                                continue;
                            }
                            #[cfg(target_os = "windows")]
                            if let Ok(mut runtime) = state_hk.note_window_runtime.lock() {
                                runtime.record_programmatic_placement(
                                    &note_id,
                                    false,
                                    &initial_metrics,
                                );
                            }
                            created_open_request(note_id)
                        };

                        let _ = window.show();
                        let _ = window.set_focus();
                        let payload = build_overlay_payload(&app_handle_hk, &state_hk, false);
                        let _ = app_handle_hk.emit("skribly://global-shortcut", payload);
                        let _ = app_handle_hk.emit("skribly://open-note-request", open_request);
                    }
                }
            });

            let app_handle_ev = app_handle.clone();
            std::thread::spawn(move || {
                let mut tick_counter: u32 = 0;
                while running_flag.load(Ordering::Relaxed) {
                    tick_counter = tick_counter.wrapping_add(1);
                    if let Ok(mut notice) = event_receiver.recv_timeout(Duration::from_millis(500)) {
                        notice.mark_processing_started();
                        let state_ev = app_handle_ev.state::<AppState>();
                        let note_window_visible = app_handle_ev
                            .get_webview_window("main")
                            .and_then(|window| window.is_visible().ok())
                            .unwrap_or(false);

                        #[cfg(target_os = "windows")]
                        if note_window_visible {
                            if matches!(
                                notice.event_type,
                                EVENT_OBJECT_LOCATIONCHANGE | EVENT_SYSTEM_MINIMIZEEND
                            ) {
                                if let Some(target) = coordinator.get_active_target() {
                                    if target.hwnd_val == notice.hwnd_val {
                                        if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                            if let Some(updated) = inspect_target_window(hwnd) {
                                                set_runtime_active_target(
                                                    &state_ev,
                                                    Some(updated.clone()),
                                                );
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
                                                            format!("Skribli could not keep the editor on the target display: {message}"),
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
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
                                | EVENT_OBJECT_LOCATIONCHANGE
                        ) {
                            if let Some(target) = coordinator.get_active_target() {
                                if target.hwnd_val == notice.hwnd_val {
                                    if notice.event_type == EVENT_OBJECT_DESTROY {
                                        set_runtime_active_target(&state_ev, None);
                                        let payload = build_mutation_payload(
                                            &app_handle_ev,
                                            &state_ev,
                                            false,
                                        );
                                        let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                    } else if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                        if let Some(updated) = inspect_target_window(hwnd) {
                                            set_runtime_active_target(
                                                &state_ev,
                                                Some(updated.clone()),
                                            );
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                        } else {
                                            set_runtime_active_target(&state_ev, None);
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                        }
                                    }
                                } else if notice.event_type == EVENT_SYSTEM_FOREGROUND {
                                    if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                        if let Some(new_target) = inspect_target_window(hwnd) {
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
                            if let Some(target) = coordinator.get_active_target() {
                                let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) else {
                                    set_runtime_active_target(&state_ev, None);
                                    let payload =
                                        build_mutation_payload(&app_handle_ev, &state_ev, false);
                                    let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                    continue;
                                };

                                if let Some(updated) = inspect_target_window(hwnd) {
                                    let placement_changed = updated.bounds != target.bounds
                                        || updated.dpi != target.dpi;
                                    set_runtime_active_target(&state_ev, Some(updated.clone()));
                                    let note_window_visible = app_handle_ev
                                        .get_webview_window("main")
                                        .and_then(|window| window.is_visible().ok())
                                        .unwrap_or(false);
                                    if placement_changed && note_window_visible {
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
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" || label == "home" || label == "library" => {
            api.prevent_close();
            if let Some(window) = app_handle.get_webview_window(label.as_str()) {
                let _ = window.hide();
            }
        }
        RunEvent::Exit => {
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
            deleted_at: None,
        }
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
            "yellow"
        );
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
}
