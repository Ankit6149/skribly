mod core;
mod platform;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager, RunEvent, State, WebviewWindow};

use core::coordinator::{Coordinator, MatchResult};
use core::models::{HitTestRect, OverlayStatePayload, SkribNote, TargetWindowInfo};

#[cfg(target_os = "windows")]
use platform::windows::{
    get_foreground_target_window, inspect_target_window, install_overlay_subclass,
    install_winevent_hooks, list_candidate_target_windows, reconstruct_hwnd,
    register_global_hotkey, set_dpi_awareness, uninstall_overlay_subclass,
    uninstall_winevent_hooks, unregister_global_hotkey, WinEventNotice,
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

fn build_overlay_payload(coordinator: &Coordinator, is_ambiguous: bool) -> OverlayStatePayload {
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
        is_ambiguous,
    }
}

#[tauri::command]
fn set_active_target(
    state: State<'_, AppState>,
    target: Option<TargetWindowInfo>,
) -> OverlayStatePayload {
    state.coordinator.set_active_target(target);
    build_overlay_payload(&state.coordinator, false)
}

#[tauri::command]
fn upsert_skrib_note(state: State<'_, AppState>, note: SkribNote) -> OverlayStatePayload {
    state.coordinator.upsert_skrib(note);
    build_overlay_payload(&state.coordinator, false)
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
    build_overlay_payload(&state.coordinator, false)
}

#[tauri::command]
fn update_skrib_text(state: State<'_, AppState>, id: String, text: String) -> OverlayStatePayload {
    state.coordinator.update_skrib_text(&id, text);
    build_overlay_payload(&state.coordinator, false)
}

#[tauri::command]
fn update_skrib_color(
    state: State<'_, AppState>,
    id: String,
    color: String,
) -> OverlayStatePayload {
    state.coordinator.update_skrib_color(&id, color);
    build_overlay_payload(&state.coordinator, false)
}

#[tauri::command]
fn toggle_skrib_collapse(state: State<'_, AppState>, id: String) -> OverlayStatePayload {
    state.coordinator.toggle_skrib_collapse(&id);
    build_overlay_payload(&state.coordinator, false)
}

#[tauri::command]
fn delete_skrib_note(state: State<'_, AppState>, id: String) -> OverlayStatePayload {
    state.coordinator.remove_skrib(&id);
    build_overlay_payload(&state.coordinator, false)
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
    let mut is_ambiguous = false;
    #[cfg(target_os = "windows")]
    {
        if let Some(target) = state.coordinator.get_active_target() {
            if let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) {
                if let Some(updated_target) = inspect_target_window(hwnd) {
                    state.coordinator.set_active_target(Some(updated_target));
                } else {
                    state.coordinator.set_active_target(None);
                }
            } else {
                state.coordinator.set_active_target(None);
            }
        } else {
            let candidates = list_candidate_target_windows();
            match state.coordinator.find_best_context_match(&candidates) {
                MatchResult::Unique(best) => {
                    state.coordinator.set_active_target(Some(best));
                }
                MatchResult::Ambiguous(_) => {
                    is_ambiguous = true;
                }
                MatchResult::None => {}
            }
        }
    }
    build_overlay_payload(&state.coordinator, is_ambiguous)
}

const GLOBAL_HOTKEY_ID: i32 = 0x534B; // 'SK'

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        set_dpi_awareness();
    }

    let coordinator = Coordinator::new();
    let running = Arc::new(AtomicBool::new(true));
    let app_state = AppState {
        coordinator: coordinator.clone(),
        running: running.clone(),
    };

    let (event_sender, event_receiver): (
        std::sync::mpsc::Sender<WinEventNotice>,
        Receiver<WinEventNotice>,
    ) = channel();

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
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let coordinator = app.state::<AppState>().coordinator.clone();
            let running_flag = app.state::<AppState>().running.clone();

            let main_window = app.get_webview_window("main");

            #[cfg(target_os = "windows")]
            {
                if let Some(ref window) = main_window {
                    if let Ok(hwnd) = window.hwnd() {
                        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);

                        // 1. Install WM_NCHITTEST WndProc subclassing
                        install_overlay_subclass(win_hwnd, coordinator.clone());

                        // 2. Register Ctrl + Shift + Space global hotkey
                        if let Err(err) = register_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID) {
                            eprintln!("Global shortcut registration note: {}", err);
                        }

                        // 3. Install WinEvent hooks
                        let _ = install_winevent_hooks(event_sender);
                    }
                }
            }

            // Event-driven WinEvent & channel processing thread
            std::thread::spawn(move || {
                while running_flag.load(Ordering::Relaxed) {
                    if let Ok(notice) = event_receiver.recv_timeout(Duration::from_millis(500)) {
                        #[cfg(target_os = "windows")]
                        {
                            if let Some(target) = coordinator.get_active_target() {
                                if target.hwnd_val == notice.hwnd_val {
                                    if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                        if let Some(updated) = inspect_target_window(hwnd) {
                                            coordinator.set_active_target(Some(updated.clone()));
                                            let payload = OverlayStatePayload {
                                                active_target: Some(updated.clone()),
                                                skribs: coordinator.get_skribs_for_target(&updated),
                                                available_windows: Vec::new(),
                                                is_shortcut_active: false,
                                                is_ambiguous: false,
                                            };
                                            let _ = app_handle.emit("skribly://overlay-update", payload);
                                        } else {
                                            coordinator.set_active_target(None);
                                            let payload = OverlayStatePayload {
                                                active_target: None,
                                                skribs: Vec::new(),
                                                available_windows: Vec::new(),
                                                is_shortcut_active: false,
                                                is_ambiguous: false,
                                            };
                                            let _ = app_handle.emit("skribly://overlay-update", payload);
                                        }
                                    }
                                }
                            } else {
                                let candidates = list_candidate_target_windows();
                                match coordinator.find_best_context_match(&candidates) {
                                    MatchResult::Unique(best) => {
                                        coordinator.set_active_target(Some(best.clone()));
                                        let payload = OverlayStatePayload {
                                            active_target: Some(best.clone()),
                                            skribs: coordinator.get_skribs_for_target(&best),
                                            available_windows: Vec::new(),
                                            is_shortcut_active: false,
                                            is_ambiguous: false,
                                        };
                                        let _ = app_handle.emit("skribly://overlay-update", payload);
                                    }
                                    MatchResult::Ambiguous(matched) => {
                                        let payload = OverlayStatePayload {
                                            active_target: None,
                                            skribs: Vec::new(),
                                            available_windows: matched,
                                            is_shortcut_active: false,
                                            is_ambiguous: true,
                                        };
                                        let _ = app_handle.emit("skribly://overlay-update", payload);
                                    }
                                    MatchResult::None => {}
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

    app.run(move |app_handle, event| {
        if let RunEvent::Exit = event {
            running.store(false, Ordering::Relaxed);
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Ok(hwnd) = window.hwnd() {
                        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
                        unregister_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID);
                        uninstall_overlay_subclass(win_hwnd);
                        uninstall_winevent_hooks();
                    }
                }
            }
        }
    });
}
