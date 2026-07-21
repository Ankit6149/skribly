mod core;
mod platform;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager, RunEvent, State, WebviewWindow};

use core::coordinator::Coordinator;
use core::models::{HitTestRect, OverlayStatePayload, SkribNote, TargetWindowInfo};

#[cfg(target_os = "windows")]
use platform::windows::{
    get_foreground_target_window, inspect_target_window, list_candidate_target_windows,
    reconstruct_hwnd, set_dpi_awareness,
};

pub struct AppState {
    pub coordinator: Coordinator,
    pub running: Arc<AtomicBool>,
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
        is_shortcut_active: false,
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
fn set_hit_test_rects(state: State<'_, AppState>, rects: Vec<HitTestRect>) {
    state.coordinator.set_hit_test_rects(rects);
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
            if let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) {
                if let Some(updated_target) = inspect_target_window(hwnd) {
                    state.coordinator.set_active_target(Some(updated_target));
                } else {
                    // Window closed or destroyed
                    state.coordinator.set_active_target(None);
                }
            } else {
                state.coordinator.set_active_target(None);
            }
        } else {
            // Check for disconnected context return
            let candidates = list_candidate_target_windows();
            for cand in candidates {
                if state.coordinator.find_disconnected_context_match(&cand) {
                    state.coordinator.set_active_target(Some(cand));
                    break;
                }
            }
        }
    }
    build_overlay_payload(&state.coordinator)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        set_dpi_awareness();
    }

    let coordinator = Coordinator::new();
    let running = Arc::new(AtomicBool::new(true));
    let app_state = AppState {
        coordinator,
        running: running.clone(),
    };

    let app = tauri::Builder::default()
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
            set_hit_test_rects,
            set_ignore_cursor_events,
            refresh_target_state,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let coordinator = app.state::<AppState>().coordinator.clone();
            let running_flag = app.state::<AppState>().running.clone();

            // Background window tracking & context return observer thread
            std::thread::spawn(move || {
                while running_flag.load(Ordering::Relaxed) {
                    std::thread::sleep(Duration::from_millis(500));

                    #[cfg(target_os = "windows")]
                    {
                        if let Some(target) = coordinator.get_active_target() {
                            if let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) {
                                if let Some(updated_target) = inspect_target_window(hwnd) {
                                    coordinator.set_active_target(Some(updated_target.clone()));
                                    let payload = OverlayStatePayload {
                                        active_target: Some(updated_target.clone()),
                                        skribs: coordinator.get_skribs_for_target(&updated_target),
                                        available_windows: Vec::new(),
                                        is_shortcut_active: false,
                                    };
                                    let _ = app_handle.emit("skribly://overlay-update", payload);
                                } else {
                                    // Target window closed or un-inspectable: mark context disconnected
                                    coordinator.set_active_target(None);
                                    let payload = OverlayStatePayload {
                                        active_target: None,
                                        skribs: Vec::new(),
                                        available_windows: Vec::new(),
                                        is_shortcut_active: false,
                                    };
                                    let _ = app_handle.emit("skribly://overlay-update", payload);
                                }
                            }
                        } else {
                            // Check for same-session reopened context return
                            let candidates = list_candidate_target_windows();
                            for cand in candidates {
                                if coordinator.find_disconnected_context_match(&cand) {
                                    coordinator.set_active_target(Some(cand.clone()));
                                    let payload = OverlayStatePayload {
                                        active_target: Some(cand.clone()),
                                        skribs: coordinator.get_skribs_for_target(&cand),
                                        available_windows: Vec::new(),
                                        is_shortcut_active: false,
                                    };
                                    let _ = app_handle.emit("skribly://overlay-update", payload);
                                    break;
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Skribly");

    app.run(move |_app_handle, event| {
        if let RunEvent::Exit = event {
            running.store(false, Ordering::Relaxed);
        }
    });
}
