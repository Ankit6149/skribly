//! Draft-safe native transitions. Waiting happens on a worker, never under a native window gate.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, Runtime};

static REQUEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static TRANSITION_BUSY: AtomicBool = AtomicBool::new(false);
static PENDING: Mutex<Option<Pending>> = Mutex::new(None);
static QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);
static QUIT_APPROVED: AtomicBool = AtomicBool::new(false);

struct Pending {
    request_id: String,
    sender: Sender<bool>,
}

pub(crate) fn acknowledge(request_id: &str, saved: bool) -> Result<(), String> {
    let mut pending = PENDING
        .lock()
        .map_err(|_| "Editor transition state is unavailable.".to_string())?;
    if !pending
        .as_ref()
        .is_some_and(|request| request.request_id == request_id)
    {
        return Err("The editor transition is stale or was cancelled.".into());
    }
    let request = pending
        .take()
        .ok_or("The editor transition was cancelled.")?;
    request
        .sender
        .send(saved)
        .map_err(|_| "The editor transition expired.".into())
}

pub(crate) struct TransitionTicket<R: Runtime> {
    app: AppHandle<R>,
    request_id: Option<String>,
    note_id: Option<String>,
    deadline: Instant,
    completed: bool,
}

impl<R: Runtime> TransitionTicket<R> {
    /// Call only while owning the native operation gate immediately before the native commit.
    pub(crate) fn can_commit(&self, state: &crate::AppState) -> bool {
        Instant::now() < self.deadline
            && state
                .note_window_runtime
                .lock()
                .is_ok_and(|runtime| runtime.active_note_id() == self.note_id.as_deref())
    }
    pub(crate) fn finish(mut self, completed: bool) {
        self.completed = completed;
    }
}

impl<R: Runtime> Drop for TransitionTicket<R> {
    fn drop(&mut self) {
        if let Some(request_id) = &self.request_id {
            let _ = self.app.emit_to("main", "skribly://native-transition-finished",
                serde_json::json!({"requestId":request_id,"noteId":self.note_id,"completed":self.completed}));
        }
        TRANSITION_BUSY.store(false, Ordering::Release);
    }
}

pub(crate) fn flush_active_editor<R: Runtime>(
    app: &AppHandle<R>,
    reason: &str,
) -> Result<TransitionTicket<R>, String> {
    if TRANSITION_BUSY
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("Another editor transition is in progress. Try again after saving.".into());
    }
    let mut ticket = TransitionTicket {
        app: app.clone(),
        request_id: None,
        note_id: None,
        deadline: Instant::now() + Duration::from_secs(5),
        completed: false,
    };
    let state = app.state::<crate::AppState>();
    let note_id = state
        .note_window_runtime
        .lock()
        .map_err(|_| "Editor state is unavailable.".to_string())?
        .active_note_id()
        .map(str::to_owned);
    ticket.note_id = note_id.clone();
    let Some(note_id) = note_id else {
        return Ok(ticket);
    };
    let request_id = format!(
        "native-{}-{}",
        std::process::id(),
        REQUEST_SEQUENCE.fetch_add(1, Ordering::AcqRel)
    );
    ticket.request_id = Some(request_id.clone());
    let (sender, receiver) = channel();
    *PENDING
        .lock()
        .map_err(|_| "Editor transition state is unavailable.".to_string())? = Some(Pending {
        request_id: request_id.clone(),
        sender,
    });
    let emitted = app.emit_to(
        "main",
        "skribly://prepare-native-transition",
        serde_json::json!({"requestId":request_id,"reason":reason,"noteId":note_id}),
    );
    let result = if emitted.is_ok() {
        receiver.recv_timeout(Duration::from_secs(5)).ok()
    } else {
        None
    };
    if let Ok(mut pending) = PENDING.lock() {
        if pending
            .as_ref()
            .is_some_and(|request| request.request_id == request_id)
        {
            *pending = None;
        }
    }
    if result != Some(true) {
        return Err("Skribli could not confirm that your current note was saved. The transition was cancelled; keep the editor open and retry saving.".into());
    }
    Ok(ticket)
}

pub(crate) fn quit_approved() -> bool {
    QUIT_APPROVED.load(Ordering::Acquire)
}

pub(crate) fn request_close(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || match flush_active_editor(&app, "close") {
        Ok(ticket) => {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || {
                let state = handle.state::<crate::AppState>();
                let Ok(_gate) = state.native_window_operation_gate.lock() else {
                    return;
                };
                if !ticket.can_commit(&state) {
                    return;
                }
                let Ok(generation) = crate::begin_native_lifecycle_action(&state) else {
                    return;
                };
                if crate::native_lifecycle_action_is_current(&state, generation) {
                    crate::hide_main_note_window(&handle);
                    ticket.finish(true);
                }
            });
        }
        Err(message) => {
            let _ = app.emit("skribly://storage-error", message);
        }
    });
}

pub(crate) fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    if QUIT_REQUESTED.swap(true, Ordering::AcqRel) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || match flush_active_editor(&app, "quit") {
        Ok(ticket) => {
            let handle = app.clone();
            if app
                .run_on_main_thread(move || {
                    let state = handle.state::<crate::AppState>();
                    let Ok(_gate) = state.native_window_operation_gate.lock() else {
                        QUIT_REQUESTED.store(false, Ordering::Release);
                        return;
                    };
                    if !ticket.can_commit(&state) {
                        QUIT_REQUESTED.store(false, Ordering::Release);
                        return;
                    }
                    QUIT_APPROVED.store(true, Ordering::Release);
                    handle.exit(0);
                    ticket.finish(true);
                })
                .is_err()
            {
                QUIT_REQUESTED.store(false, Ordering::Release);
            }
        }
        Err(message) => {
            QUIT_REQUESTED.store(false, Ordering::Release);
            let _ = app.emit("skribly://storage-error", message);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stale_acknowledgement_cannot_approve_a_newer_transition() {
        let (sender, receiver) = channel();
        *PENDING.lock().unwrap() = Some(Pending {
            request_id: "new-request".into(),
            sender,
        });
        assert!(acknowledge("old-request", true).is_err());
        assert!(receiver.try_recv().is_err());
        acknowledge("new-request", false).unwrap();
        assert_eq!(receiver.recv().unwrap(), false);
        assert!(acknowledge("new-request", true).is_err());
    }
}
