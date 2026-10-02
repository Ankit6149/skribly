use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use tauri::{PhysicalPosition, PhysicalSize};

use crate::core::models::TargetWindowInfo;
use crate::desktop::rail_presentation::RailPresentation;

pub(crate) const GLOBAL_RAIL_COLLAPSED_WIDTH: f64 = 28.0;
pub(crate) const GLOBAL_RAIL_COLLAPSED_HEIGHT: f64 = 80.0;
pub(crate) const CONTEXT_RAIL_COLLAPSED_WIDTH: f64 = 28.0;
pub(crate) const CONTEXT_RAIL_COLLAPSED_HEIGHT: f64 = 28.0;
pub(crate) const CONTEXT_RAIL_PEEK_WIDTH: f64 = 164.0;
pub(crate) const CONTEXT_RAIL_PEEK_HEIGHT: f64 = 36.0;
pub(crate) const RAIL_EXPANDED_WIDTH: f64 = 388.0;
pub(crate) const RAIL_EXPANDED_FALLBACK_HEIGHT: f64 = 430.0;
pub(crate) const GLOBAL_RAIL_EDGE_MARGIN_LOGICAL: f64 = 0.0;
pub(crate) const CONTEXT_RAIL_EDGE_MARGIN_LOGICAL: f64 = 8.0;
pub(crate) const RAIL_DOCK_DEBOUNCE: Duration = Duration::from_millis(180);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ContextRailPlacement {
    pub(crate) target_hwnd: isize,
    pub(crate) bounds: RailDockBounds,
    pub(crate) relative_x: i32,
    pub(crate) relative_y: i32,
}

#[derive(Debug, Default)]
pub(crate) struct RailWindowRuntime {
    pub(crate) presentation: Mutex<RailPresentation>,
    pub(crate) reveal_width: AtomicU32,
    pub(crate) reduced_motion: AtomicBool,
    pub(crate) movement_generation: AtomicU64,
    pub(crate) pending_programmatic_positions: Mutex<VecDeque<(i32, i32)>>,
    pub(crate) has_docked_position: AtomicBool,
    pub(crate) global_widget_return_y: Mutex<Option<i32>>,
    pub(crate) expanded: AtomicBool,
    pub(crate) revealed: AtomicBool,
    pub(crate) arrival_revision: AtomicU64,
    pub(crate) state_revision: AtomicU64,
    pub(crate) docked_left: AtomicBool,
    pub(crate) foreground_target: Mutex<Option<TargetWindowInfo>>,
    pub(crate) suppressed_context: Mutex<Option<String>>,
    pub(crate) context_placement: Mutex<Option<ContextRailPlacement>>,
}

#[derive(Debug, Default, Clone, Copy, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RailWindowState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) surface_revision: Option<u64>,
    pub(crate) contextual: bool,
    pub(crate) expanded: bool,
    pub(crate) revealed: bool,
    pub(crate) arrival_revision: u64,
    #[serde(rename = "revision")]
    pub(crate) state_revision: u64,
    pub(crate) dock_side: RailDockSide,
}

pub(crate) fn context_arrival_matches(expected: Option<u64>, current: RailWindowState) -> bool {
    expected.is_none_or(|revision| revision == current.arrival_revision)
}

pub(crate) fn detached_note_rail_label(
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


impl RailWindowRuntime {
    pub(crate) fn remember_global_widget_y(&self, y: i32) {
        if let Ok(mut saved) = self.global_widget_return_y.lock() {
            *saved = Some(y);
        }
    }

    pub(crate) fn global_widget_return_y(&self) -> Option<i32> {
        self.global_widget_return_y
            .lock()
            .ok()
            .and_then(|saved| *saved)
    }

    pub(crate) fn foreground_target(&self) -> Option<TargetWindowInfo> {
        self.foreground_target
            .lock()
            .ok()
            .and_then(|value| value.clone())
    }

    pub(crate) fn arrive(&self, target: &TargetWindowInfo) {
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

    pub(crate) fn is_suppressed(&self, target: &TargetWindowInfo) -> bool {
        self.suppressed_context
            .lock()
            .ok()
            .is_some_and(|value| value.as_deref() == Some(target.context_fingerprint().as_str()))
    }

    pub(crate) fn cancel_pending_user_dock(&self) {
        self.movement_generation.fetch_add(1, Ordering::AcqRel);
    }

    pub(crate) fn record_programmatic_position(&self, position: PhysicalPosition<i32>) {
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

    pub(crate) fn consume_programmatic_movement(&self, position: PhysicalPosition<i32>) -> bool {
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

    pub(crate) fn begin_user_movement(&self) -> u64 {
        self.movement_generation
            .fetch_add(1, Ordering::AcqRel)
            .wrapping_add(1)
    }

    pub(crate) fn movement_is_current(&self, generation: u64) -> bool {
        self.movement_generation.load(Ordering::Acquire) == generation
    }

    pub(crate) fn has_docked_position(&self) -> bool {
        self.has_docked_position.load(Ordering::Acquire)
    }

    pub(crate) fn context_placement(&self) -> Option<ContextRailPlacement> {
        self.context_placement.lock().ok().and_then(|value| *value)
    }

    pub(crate) fn record_context_placement(
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

    pub(crate) fn clear_context_placement(&self) {
        if let Ok(mut placement) = self.context_placement.lock() {
            *placement = None;
        }
    }
}

static RAIL_WINDOW_RUNTIME: OnceLock<RailWindowRuntime> = OnceLock::new();
static CONTEXT_RAIL_WINDOW_RUNTIME: OnceLock<RailWindowRuntime> = OnceLock::new();

pub(crate) fn rail_window_runtime() -> &'static RailWindowRuntime {
    RAIL_WINDOW_RUNTIME.get_or_init(RailWindowRuntime::default)
}

pub(crate) fn context_rail_window_runtime() -> &'static RailWindowRuntime {
    CONTEXT_RAIL_WINDOW_RUNTIME.get_or_init(RailWindowRuntime::default)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct RailDockBounds {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: i32,
    pub(crate) height: i32,
}

#[derive(Debug, Default, Clone, Copy, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum RailDockSide {
    Left,
    #[default]
    Right,
}

pub(crate) fn rail_dock_limits(
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

pub(crate) fn rail_dock_side(
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

pub(crate) fn rail_position_for_side_and_y(
    side: RailDockSide,
    pub(crate) y: i32,
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

pub(crate) fn rail_position_after_size_change(
    previous_position: PhysicalPosition<i32>,
    previous_size: PhysicalSize<u32>,
    next_size: PhysicalSize<u32>,
    work_area: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    let side = rail_dock_side(previous_position, previous_size, work_area, margin);
    rail_position_for_side_and_y(side, previous_position.y, next_size, work_area, margin)
}

pub(crate) fn nearest_rail_edge_position(
    position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
    work_area: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    let side = rail_dock_side(position, window_size, work_area, margin);
    rail_position_for_side_and_y(side, position.y, window_size, work_area, margin)
}

pub(crate) fn clamp_rail_position_to_bounds(
    position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
    pub(crate) bounds: RailDockBounds,
    margin: i32,
) -> PhysicalPosition<i32> {
    let (left, right, top, bottom) = rail_dock_limits(window_size, bounds, margin);
    PhysicalPosition::new(
        i64::from(position.x).clamp(left, right) as i32,
        i64::from(position.y).clamp(top, bottom) as i32,
    )
}



