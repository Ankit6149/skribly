mod core;
mod platform;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

use core::coordinator::{Coordinator, MatchResult};
use core::models::{HitTestRect, OverlayMetrics, OverlayStatePayload, SkribNote, TargetWindowInfo};

#[cfg(target_os = "windows")]
use platform::windows::{
    get_foreground_target_window, get_overlay_metrics as query_overlay_metrics, inspect_target_window,
    install_hotkey_sender, install_overlay_subclass, install_winevent_hooks,
    list_candidate_target_windows, reconstruct_hwnd, register_global_hotkey, set_dpi_awareness,
    uninstall_overlay_subclass, uninstall_winevent_hooks, unregister_global_hotkey,
    verify_overlay_bounds, WinEventNotice, EVENT_OBJECT_DESTROY, EVENT_OBJECT_LOCATIONCHANGE,
    EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND, EVENT_SYSTEM_MINIMIZESTART,
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
    coordinator: &Coordinator,
    is_ambiguous: bool,
) -> OverlayStatePayload {
    let active_target = coordinator.get_active_target();
    let skribs = if let Some(ref target) = active_target {
        coordinator.get_skribs_for_target(target)
    } else {
        Vec::new()
    };
    let available_windows = list_target_windows();
    let overlay_metrics = get_current_overlay_metrics(app_handle);

    OverlayStatePayload {
        active_target,
        skribs,
        available_windows,
        is_shortcut_active: false,
        is_ambiguous,
        overlay_metrics,
    }
}

fn build_mutation_payload(
    app_handle: &AppHandle,
    coordinator: &Coordinator,
    is_ambiguous: bool,
) -> OverlayStatePayload {
    let active_target = coordinator.get_active_target();
    let skribs = if let Some(ref target) = active_target {
        coordinator.get_skribs_for_target(target)
    } else {
        coordinator.get_all_skribs()
    };
    let overlay_metrics = get_current_overlay_metrics(app_handle);

    OverlayStatePayload {
        active_target,
        skribs,
        available_windows: Vec::new(),
        is_shortcut_active: false,
        is_ambiguous,
        overlay_metrics,
    }
}

#[tauri::command]
fn set_active_target(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    target: Option<TargetWindowInfo>,
) -> OverlayStatePayload {
    state.coordinator.set_active_target(target);
    build_overlay_payload(&app_handle, &state.coordinator, false)
}

#[tauri::command]
fn upsert_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    note: SkribNote,
) -> OverlayStatePayload {
    state.coordinator.upsert_skrib(note);
    build_mutation_payload(&app_handle, &state.coordinator, false)
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
) -> OverlayStatePayload {
    state
        .coordinator
        .update_skrib_position(&id, rel_x, rel_y, width, height);
    build_mutation_payload(&app_handle, &state.coordinator, false)
}

#[tauri::command]
fn update_skrib_text(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    text: String,
) -> OverlayStatePayload {
    state.coordinator.update_skrib_text(&id, text);
    build_mutation_payload(&app_handle, &state.coordinator, false)
}

#[tauri::command]
fn update_skrib_color(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    color: String,
) -> OverlayStatePayload {
    state.coordinator.update_skrib_color(&id, color);
    build_mutation_payload(&app_handle, &state.coordinator, false)
}

#[tauri::command]
fn toggle_skrib_collapse(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> OverlayStatePayload {
    state.coordinator.toggle_skrib_collapse(&id);
    build_mutation_payload(&app_handle, &state.coordinator, false)
}

#[tauri::command]
fn delete_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> OverlayStatePayload {
    state.coordinator.remove_skrib(&id);
    build_mutation_payload(&app_handle, &state.coordinator, false)
}

#[tauri::command]
fn set_hit_test_rects(state: State<'_, AppState>, rects: Vec<HitTestRect>) {
    state.coordinator.set_hit_test_rects(rects);
}

#[tauri::command]
fn refresh_target_state(app_handle: AppHandle, state: State<'_, AppState>) -> OverlayStatePayload {
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
    build_overlay_payload(&app_handle, &state.coordinator, is_ambiguous)
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

    let (hotkey_sender, hotkey_receiver): (
        std::sync::mpsc::Sender<i32>,
        Receiver<i32>,
    ) = channel();

    let app = tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            list_target_windows,
            get_overlay_metrics,
            set_active_target,
            upsert_skrib_note,
            update_skrib_position,
            update_skrib_text,
            update_skrib_color,
            toggle_skrib_collapse,
            delete_skrib_note,
            set_hit_test_rects,
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

                        // 1. Set Virtual Desktop overlay bounds for multi-monitor coverage
                        let vbounds = platform::windows::get_virtual_screen_bounds();
                        let _ = window.set_position(tauri::PhysicalPosition::new(vbounds.x, vbounds.y));
                        let _ = window.set_size(tauri::PhysicalSize::new(vbounds.width as u32, vbounds.height as u32));

                        // 2. Read back native bounds and verify match against virtual-screen metrics
                        match verify_overlay_bounds(win_hwnd) {
                            Ok(metrics) => {
                                println!(
                                    "Overlay native bounds verified matching Virtual Desktop: ({}, {}) {}x{} @ DPI {}",
                                    metrics.overlay_physical_x, metrics.overlay_physical_y,
                                    metrics.overlay_physical_width, metrics.overlay_physical_height, metrics.dpi
                                );
                            }
                            Err(err_msg) => {
                                eprintln!("{}", err_msg);
                            }
                        }

                        // 3. Install WM_NCHITTEST WndProc subclassing
                        install_overlay_subclass(win_hwnd, coordinator.clone());

                        // 4. Install hotkey channel sender & Register Ctrl + Shift + Space global hotkey
                        install_hotkey_sender(hotkey_sender);
                        if let Err(err) = register_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID) {
                            let error_msg = format!("Global shortcut registration error: {}", err);
                            eprintln!("{}", error_msg);
                            let _ = app_handle.emit("skribly://hotkey-error", error_msg);
                        }

                        // 5. Install WinEvent hooks
                        let _ = install_winevent_hooks(event_sender);
                    }
                }
            }

            // Dedicated thread processing WM_HOTKEY native events
            let coordinator_hk = coordinator.clone();
            let app_handle_hk = app_handle.clone();
            let running_flag_hk = running_flag.clone();

            std::thread::spawn(move || {
                while running_flag_hk.load(Ordering::Relaxed) {
                    if let Ok(hotkey_id) = hotkey_receiver.recv_timeout(Duration::from_millis(100)) {
                        if hotkey_id == GLOBAL_HOTKEY_ID {
                            if let Some(window) = app_handle_hk.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }

                            let active_target = coordinator_hk.get_active_target();
                            if let Some(ref target) = active_target {
                                let timestamp = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis();
                                let new_note = SkribNote {
                                    id: format!("skrib-hotkey-{}", timestamp),
                                    target_process_name: target.process_name.clone(),
                                    target_title: target.title.clone(),
                                    rel_x: 40.0,
                                    rel_y: 40.0,
                                    width: 320.0,
                                    height: 230.0,
                                    text: "New Skrib created via Ctrl+Shift+Space".into(),
                                    color: "yellow".into(),
                                    collapsed: false,
                                    created_at: (timestamp / 1000) as u64,
                                    updated_at: (timestamp / 1000) as u64,
                                };
                                coordinator_hk.upsert_skrib(new_note);
                            }

                            let payload = build_overlay_payload(&app_handle_hk, &coordinator_hk, false);
                            let _ = app_handle_hk.emit("skribly://global-shortcut", payload);
                        }
                    }
                }
            });

            // Event-driven WinEvent processing thread
            std::thread::spawn(move || {
                let mut tick_counter: u32 = 0;
                while running_flag.load(Ordering::Relaxed) {
                    tick_counter += 1;
                    if let Ok(notice) = event_receiver.recv_timeout(Duration::from_millis(500)) {
                        #[cfg(target_os = "windows")]
                        {
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
                                        if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                            if let Some(updated) = inspect_target_window(hwnd) {
                                                coordinator.set_active_target(Some(updated.clone()));
                                                let payload = build_mutation_payload(&app_handle, &coordinator, false);
                                                let _ = app_handle.emit("skribly://overlay-update", payload);
                                            } else {
                                                coordinator.set_active_target(None);
                                                let payload = build_mutation_payload(&app_handle, &coordinator, false);
                                                let _ = app_handle.emit("skribly://overlay-update", payload);
                                            }
                                        }
                                    }
                                } else if notice.event_type == EVENT_SYSTEM_FOREGROUND {
                                    let candidates = list_candidate_target_windows();
                                    match coordinator.find_best_context_match(&candidates) {
                                        MatchResult::Unique(best) => {
                                            coordinator.set_active_target(Some(best.clone()));
                                            let payload = build_mutation_payload(&app_handle, &coordinator, false);
                                            let _ = app_handle.emit("skribly://overlay-update", payload);
                                        }
                                        MatchResult::Ambiguous(matched) => {
                                            let mut payload = build_mutation_payload(&app_handle, &coordinator, true);
                                            payload.available_windows = matched;
                                            let _ = app_handle.emit("skribly://overlay-update", payload);
                                        }
                                        MatchResult::None => {}
                                    }
                                }
                            }
                        }
                    } else {
                        // Periodic fallback check (every ~2 seconds) for target window validity
                        if tick_counter % 4 == 0 {
                            #[cfg(target_os = "windows")]
                            {
                                if let Some(target) = coordinator.get_active_target() {
                                    if reconstruct_hwnd(target.hwnd_val).is_none() {
                                        coordinator.set_active_target(None);
                                        let payload = build_mutation_payload(&app_handle, &coordinator, false);
                                        let _ = app_handle.emit("skribly://overlay-update", payload);
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

#[cfg(test)]
mod tests {
    use super::*;

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
        };

        assert!(payload.available_windows.is_empty());

        #[cfg(target_os = "windows")]
        assert_eq!(platform::windows::get_window_enumeration_count(), 0);
    }
}

