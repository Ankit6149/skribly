use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex, MutexGuard};

use crate::core::coordinator::Coordinator;
use crate::core::models::{
    OverlayInitializationStatus, OverlayMetrics, SkribNote, TargetWindowInfo,
};
use crate::core::storage;
use crate::note_lifecycle::OpenNoteRequest;

#[cfg(target_os = "windows")]
use crate::platform::windows_events::WinEventPipeline;
#[cfg(target_os = "windows")]
use crate::platform::windows_placement::COMPACT_WINDOW_LOGICAL_WIDTH;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProgrammaticNotePlacement {
    note_id: String,
    physical_x: i32,
    physical_y: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DismissedCollapsedWindow {
    note_id: String,
    pub(crate) target_hwnd: isize,
    pub(crate) target_process_name: String,
    pub(crate) target_title: String,
    pub(crate) armed: bool,
}

#[derive(Debug, Default)]
pub(crate) struct NoteWindowRuntime {
    pub(crate) active_note_id: Option<String>,
    detached: bool,
    borrowed_dimensions: Option<(f64, f64)>,
    workspace_expanded: bool,
    pending_programmatic_placement: Option<ProgrammaticNotePlacement>,
    dismissed_collapsed_window: Option<DismissedCollapsedWindow>,
    pending_open_request: Option<OpenNoteRequest>,
}

#[derive(Debug, Default)]
pub(crate) struct NativeWindowOperationGate(Mutex<()>);

impl NativeWindowOperationGate {
    pub(crate) fn lock(&self) -> Result<MutexGuard<'_, ()>, String> {
        self.0
            .lock()
            .map_err(|_| "The native window operation lock is unavailable.".to_string())
    }
    pub(crate) fn try_lock(&self) -> Result<Option<MutexGuard<'_, ()>>, String> {
        match self.0.try_lock() {
            Ok(guard) => Ok(Some(guard)),
            Err(std::sync::TryLockError::WouldBlock) => Ok(None),
            Err(std::sync::TryLockError::Poisoned(_)) => {
                Err("The native window operation lock is unavailable.".into())
            }
        }
    }
}


impl NoteWindowRuntime {
    pub(crate) fn active_note_id(&self) -> Option<&str> {
        self.active_note_id.as_deref()
    }

    pub(crate) fn detached_note_id(&self) -> Option<&str> {
        self.active_note_id.as_deref().filter(|_| self.detached)
    }

    pub(crate) fn workspace_expanded_for(&self, note_id: &str) -> bool {
        self.active_note_id.as_deref() == Some(note_id) && self.workspace_expanded
    }

    pub(crate) fn workspace_is_expanded(&self) -> bool {
        self.active_note_id.is_some() && self.workspace_expanded
    }

    pub(crate) fn clear(&mut self) {
        self.active_note_id = None;
        self.detached = false;
        self.borrowed_dimensions = None;
        self.workspace_expanded = false;
        self.pending_programmatic_placement = None;
        self.dismissed_collapsed_window = None;
        self.pending_open_request = None;
    }

    pub(crate) fn dismiss_collapsed_window(&mut self, note: &SkribNote, target: &TargetWindowInfo) {
        self.hide_collapsed_window(note, target, false);
    }

    pub(crate) fn hide_active_note_until_context_returns(
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

    pub(crate) fn hide_collapsed_window(&mut self, note: &SkribNote, target: &TargetWindowInfo, armed: bool) {
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

    pub(crate) fn dismissed_collapsed_window(&self) -> Option<&DismissedCollapsedWindow> {
        self.dismissed_collapsed_window.as_ref()
    }

    pub(crate) fn arm_dismissed_collapsed_window(&mut self, expected: &DismissedCollapsedWindow) -> bool {
        let Some(current) = self.dismissed_collapsed_window.as_mut() else {
            return false;
        };
        if current != expected || current.armed {
            return false;
        }
        current.armed = true;
        true
    }

    pub(crate) fn record_programmatic_placement(
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

    pub(crate) fn record_detached_placement(&mut self, note_id: &str, metrics: &OverlayMetrics) {
        self.record_programmatic_placement(note_id, true, metrics);
        self.detached = true;
    }

    pub(crate) fn borrowed_dimensions_for(&self, note_id: &str) -> Option<(f64, f64)> {
        (self.active_note_id() == Some(note_id))
            .then_some(self.borrowed_dimensions)
            .flatten()
    }

    pub(crate) fn dimensions_to_save(&self, note: &SkribNote, observed: (f64, f64)) -> (f64, f64) {
        if self.borrowed_dimensions_for(&note.id).is_some() {
            (note.width, note.height)
        } else {
            observed
        }
    }

    pub(crate) fn record_size_mode(&mut self, note: &SkribNote, width: f64, height: f64, temporary: bool) {
        self.borrowed_dimensions = if temporary && (width != note.width || height != note.height) {
            Some((width, height))
        } else {
            None
        };
    }

    pub(crate) fn record_open_request(&mut self, request: OpenNoteRequest) {
        self.pending_open_request = Some(request);
    }

    pub(crate) fn pending_open_request(&self) -> Option<OpenNoteRequest> {
        self.pending_open_request.clone()
    }

    pub(crate) fn acknowledge_open_request(&mut self, note_id: &str) -> bool {
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

    pub(crate) fn should_ignore_position_save(
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
    pub(crate) native_lifecycle_generation: AtomicU64,
    pub(crate) native_lifecycle_commit_lock: Mutex<()>,
    pub(crate) native_window_operation_gate: NativeWindowOperationGate,
    #[cfg(target_os = "windows")]
    pub win_event_pipeline: WinEventPipeline,
}

