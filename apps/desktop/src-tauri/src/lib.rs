mod core;
mod platform;

use std::time::Duration;
use tauri::{Emitter, Manager, State, WebviewWindow};

use core::coordinator::Coordinator;
use core::models::{OverlayStatePayload, SkribNote, TargetWindowInfo};

#[cfg(target_os = "windows")]
use platform::windows::{
    get_foreground_target_window, inspect_target_window, list_candidate_target_windows,
};

pub struct AppState {
    pub coordinator: Coordinator,
}

#[tauri::command]
fn get_foreground_window() -> Option<TargetWindowInfo> {
    #[cfg(target_os = "windows")]
    {
        get_foreground_target_window()
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

fn build_overlay_payload(coordinator: &Coordinator) -> OverlayStatePayload {
    let active_target = coordinator.get_active_target();
    let skribs = if let Some(ref target) = active_target {
        coordinator.get_skribs_for_target(target)
    } else {
        Vec::new()
    };
    let available_windows = list_target_windows();

    OverlayStatePayload {
        active_target,
        skribs,
        available_windows,
    }
}

#[tauri::command]
fn set_active_target(
    state: State<'_, AppState>,
    target: Option<TargetWindowInfo>,
) -> OverlayStatePayload {
    state.coordinator.set_active_target(target);
    build_overlay_payload(&state.coordinator)
}

#[tauri::command]
fn upsert_skrib_note(state: State<'_, AppState>, note: SkribNote) -> OverlayStatePayload {
    state.coordinator.upsert_skrib(note);
    build_overlay_payload(&state.coordinator)
}

#[tauri::command]
fn update_skrib_position(
    state: State<'_, AppState>,
    id: String,
    rel_x: f64,
    rel_y: f64,
    width: f64,
    height: f64,
) -> OverlayStatePayload {
    state
        .coordinator
        .update_skrib_position(&id, rel_x, rel_y, width, height);
    build_overlay_payload(&state.coordinator)
}

#[tauri::command]
fn update_skrib_text(state: State<'_, AppState>, id: String, text: String) -> OverlayStatePayload {
    state.coordinator.update_skrib_text(&id, text);
    build_overlay_payload(&state.coordinator)
}

#[tauri::command]
fn update_skrib_color(
    state: State<'_, AppState>,
    id: String,
    color: String,
) -> OverlayStatePayload {
    state.coordinator.update_skrib_color(&id, color);
    build_overlay_payload(&state.coordinator)
}

#[tauri::command]
fn toggle_skrib_collapse(state: State<'_, AppState>, id: String) -> OverlayStatePayload {
    state.coordinator.toggle_skrib_collapse(&id);
    build_overlay_payload(&state.coordinator)
}

#[tauri::command]
fn delete_skrib_note(state: State<'_, AppState>, id: String) -> OverlayStatePayload {
    state.coordinator.remove_skrib(&id);
    build_overlay_payload(&state.coordinator)
}

#[tauri::command]
fn set_ignore_cursor_events(window: WebviewWindow, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn refresh_target_state(state: State<'_, AppState>) -> OverlayStatePayload {
    #[cfg(target_os = "windows")]
    {
        if let Some(target) = state.coordinator.get_active_target() {
            // Re-inspect HWND
            if let Ok(hwnd_ptr) = target.hwnd_id.parse::<usize>() {
                let hwnd = windows::Win32::Foundation::HWND(hwnd_ptr as *mut _);
                if let Some(updated_target) = inspect_target_window(hwnd) {
                    state.coordinator.set_active_target(Some(updated_target));
                } else {
                    // Window closed or un-inspectable
                    state.coordinator.set_active_target(None);
                }
            }
        }
    }
    build_overlay_payload(&state.coordinator)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let coordinator = Coordinator::new();
    let app_state = AppState { coordinator };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            list_target_windows,
            set_active_target,
            upsert_skrib_note,
            update_skrib_position,
            update_skrib_text,
            update_skrib_color,
            toggle_skrib_collapse,
            delete_skrib_note,
            set_ignore_cursor_events,
            refresh_target_state,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let coordinator = app.state::<AppState>().coordinator.clone();

            // Background window tracking thread
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_millis(120));

                    #[cfg(target_os = "windows")]
                    {
                        if let Some(target) = coordinator.get_active_target() {
                            if let Ok(hwnd_ptr) = target.hwnd_id.parse::<usize>() {
                                let hwnd = windows::Win32::Foundation::HWND(hwnd_ptr as *mut _);
                                if let Some(updated_target) = inspect_target_window(hwnd) {
                                    coordinator.set_active_target(Some(updated_target.clone()));
                                    let payload = OverlayStatePayload {
                                        active_target: Some(updated_target.clone()),
                                        skribs: coordinator.get_skribs_for_target(&updated_target),
                                        available_windows: list_candidate_target_windows(),
                                    };
                                    let _ = app_handle.emit("skribly://overlay-update", payload);
                                } else {
                                    // Target closed or disappeared
                                    coordinator.set_active_target(None);
                                    let payload = OverlayStatePayload {
                                        active_target: None,
                                        skribs: Vec::new(),
                                        available_windows: list_candidate_target_windows(),
                                    };
                                    let _ = app_handle.emit("skribly://overlay-update", payload);
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Skribly");
}
