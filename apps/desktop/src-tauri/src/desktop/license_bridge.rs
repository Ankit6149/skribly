use crate::core::license;
use serde::Deserialize;
use std::sync::Mutex;
use tauri::{App, Emitter, Listener, Runtime};

const STATUS_EVENT: &str = "skribly://license-status";
const ERROR_EVENT: &str = "skribly://license-error";
const STATUS_REQUEST_EVENT: &str = "skribly://license-status-request";
const ACTIVATE_EVENT: &str = "skribly://license-activate";
// Keep each bridge read/mutation and its status emission together: an older status must not
// overwrite a newer activation response merely because separate workers finished out of order.
static BRIDGE_IO: Mutex<()> = Mutex::new(());

#[derive(Debug, Deserialize)]
struct ActivationRequest {
    key: String,
}

fn emit_current_status<R: Runtime>(app: &tauri::AppHandle<R>) {
    let Ok(_guard) = BRIDGE_IO.lock() else {
        let _ = app.emit(
            ERROR_EVENT,
            "The licence status worker is unavailable. Retry refreshing.",
        );
        return;
    };
    match license::current_global_status() {
        Ok(status) => {
            let _ = app.emit(STATUS_EVENT, status);
        }
        Err(message) => {
            let _ = app.emit(ERROR_EVENT, message);
        }
    }
}

pub fn install_license_bridge<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let status_handle = app.handle().clone();
    app.listen(STATUS_REQUEST_EVENT, move |_| {
        let status_handle = status_handle.clone();
        tauri::async_runtime::spawn_blocking(move || emit_current_status(&status_handle));
    });

    let activation_handle = app.handle().clone();
    app.listen(ACTIVATE_EVENT, move |event| {
        let activation_handle = activation_handle.clone();
        let payload = event.payload().to_owned();
        tauri::async_runtime::spawn_blocking(move || {
            let Ok(_guard) = BRIDGE_IO.lock() else {
                let _ = activation_handle.emit(
                    ERROR_EVENT,
                    "The licence activation worker is unavailable. Retry activation.",
                );
                return;
            };
            let request = serde_json::from_str::<ActivationRequest>(&payload);
            match request {
                Ok(request) => match license::activate_global(request.key.trim()) {
                    Ok(status) => {
                        let _ = activation_handle.emit(STATUS_EVENT, status);
                    }
                    Err(message) => {
                        let _ = activation_handle.emit(ERROR_EVENT, message);
                    }
                },
                Err(_) => {
                    let _ = activation_handle.emit(
                        ERROR_EVENT,
                        "The licence activation request could not be read.".to_string(),
                    );
                }
            }
        });
    });

    Ok(())
}
