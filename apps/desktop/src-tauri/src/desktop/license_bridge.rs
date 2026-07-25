use crate::core::license;
use serde::Deserialize;
use tauri::{App, Emitter, Listener, Runtime};

const STATUS_EVENT: &str = "skribly://license-status";
const ERROR_EVENT: &str = "skribly://license-error";
const STATUS_REQUEST_EVENT: &str = "skribly://license-status-request";
const ACTIVATE_EVENT: &str = "skribly://license-activate";

#[derive(Debug, Deserialize)]
struct ActivationRequest {
    key: String,
}

fn emit_current_status<R: Runtime>(app: &tauri::AppHandle<R>) {
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
        emit_current_status(&status_handle);
    });

    let activation_handle = app.handle().clone();
    app.listen(ACTIVATE_EVENT, move |event| {
        let request = serde_json::from_str::<ActivationRequest>(event.payload());
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

    Ok(())
}
