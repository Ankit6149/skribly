mod core;
mod platform;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

use core::models::{
    HitTestRect, OverlayInitializationStatus, OverlayMetrics, OverlayStatePayload, SkribNote,
    TargetWindowInfo,
};
use core::coordinator::{Coordinator, MatchResult};
use core::storage;

#[cfg(target_os = "windows")]
use platform::windows::{
    get_foreground_target_window, get_overlay_metrics as query_overlay_metrics,
    initialize_overlay_with_retry, inspect_target_window, install_hotkey_sender,
    install_overlay_subclass, install_winevent_hooks, list_candidate_target_windows,
    reconstruct_hwnd, register_global_hotkey, set_dpi_awareness, uninstall_overlay_subclass,
    uninstall_winevent_hooks, unregister_global_hotkey, WinEventNotice, EVENT_OBJECT_DESTROY,
    EVENT_OBJECT_LOCATIONCHANGE, EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND,
    EVENT_SYSTEM_MINIMIZESTART,
};

pub struct AppState {
    pub coordinator: Coordinator,
    pub running: Arc<AtomicBool>,
    pub init_status: Mutex<OverlayInitializationStatus>,
    pub storage_path: Mutex<std::path::PathBuf>,
    #[cfg(target_os = "windows")]
    pub win_event_sender: std::sync::mpsc::Sender<WinEventNotice>,
}

fn persist_skribs(state: &AppState) -> Result<(), String> {
    let path = state
        .storage_path
        .lock()
        .map_err(|_| "Local storage path is unavailable".to_string())?
        .clone();
    storage::save(&path, &state.coordinator.get_all_skribs())
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

#[cfg(target_os = "windows")]
fn initialize_native_overlay(
    app_handle: &AppHandle,
    state: &AppState,
    window: &tauri::WebviewWindow,
) -> OverlayInitializationStatus {
    let result = (|| {
        let hwnd = window
            .hwnd()
            .map_err(|error| format!("Failed to acquire overlay HWND: {error}"))?;
        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
        let metrics = initialize_overlay_with_retry(window)?;

        install_overlay_subclass(win_hwnd, state.coordinator.clone())?;

        // Retry is idempotent: remove any previous registration/hooks first.
        unregister_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID);
        register_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID)?;
        uninstall_winevent_hooks();
        if !install_winevent_hooks(state.win_event_sender.clone()) {
            unregister_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID);
            return Err("Failed to install required Windows event hooks".into());
        }

        Ok(metrics)
    })();

    let status = match result {
        Ok(metrics) => OverlayInitializationStatus::Ready(metrics),
        Err(message) => {
            if let Ok(hwnd) = window.hwnd() {
                let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
                unregister_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID);
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
            if let Ok(hwnd) = window.hwnd() {
                let _ = hwnd;
                initialize_native_overlay(&app_handle, &state, &window);
            }
        }
    }
    build_overlay_payload(&app_handle, &state, false)
}

#[tauri::command]
fn set_active_target(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    target: Option<TargetWindowInfo>,
) -> OverlayStatePayload {
    state.coordinator.set_active_target(target);
    build_overlay_payload(&app_handle, &state, false)
}

#[tauri::command]
fn upsert_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    note: SkribNote,
) -> Result<OverlayStatePayload, String> {
    state.coordinator.upsert_skrib(note);
    persist_skribs(&state)?;
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
    state
        .coordinator
        .update_skrib_position(&id, rel_x, rel_y, width, height);
    persist_skribs(&state)?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn update_skrib_text(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    text: String,
) -> Result<OverlayStatePayload, String> {
    state.coordinator.update_skrib_text(&id, text);
    persist_skribs(&state)?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn update_skrib_color(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    color: String,
) -> Result<OverlayStatePayload, String> {
    state.coordinator.update_skrib_color(&id, color);
    persist_skribs(&state)?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn toggle_skrib_collapse(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    state.coordinator.toggle_skrib_collapse(&id);
    persist_skribs(&state)?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn delete_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    state.coordinator.remove_skrib(&id);
    persist_skribs(&state)?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn get_all_skribs(state: State<'_, AppState>) -> Vec<SkribNote> {
    let mut skribs = state.coordinator.get_all_skribs();
    skribs.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    skribs
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
    build_overlay_payload(&app_handle, &state, is_ambiguous)
}

const GLOBAL_HOTKEY_ID: i32 = 0x534B; // 'SK'

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        set_dpi_awareness();
    }

    let (event_sender, event_receiver): (
        std::sync::mpsc::Sender<WinEventNotice>,
        Receiver<WinEventNotice>,
    ) = channel();

    let (hotkey_sender, hotkey_receiver): (std::sync::mpsc::Sender<i32>, Receiver<i32>) = channel();

    let coordinator = Coordinator::new();
    let running = Arc::new(AtomicBool::new(true));
    let storage_path = std::env::temp_dir().join("skribly-uninitialized.json");
    let app_state = AppState {
        coordinator: coordinator.clone(),
        running: running.clone(),
        init_status: Mutex::new(OverlayInitializationStatus::Initializing),
        storage_path: Mutex::new(storage_path),
        #[cfg(target_os = "windows")]
        win_event_sender: event_sender.clone(),
    };

    let app = tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            list_target_windows,
            get_overlay_metrics,
            retry_overlay_initialization,
            set_active_target,
            upsert_skrib_note,
            update_skrib_position,
            update_skrib_text,
            update_skrib_color,
            toggle_skrib_collapse,
            delete_skrib_note,
            get_all_skribs,
            set_hit_test_rects,
            refresh_target_state,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let data_dir = app.path().app_data_dir()?;
            let storage_path = data_dir.join("skribs.json");
            let loaded = storage::load(&storage_path).or_else(|primary_error| {
                let backup = storage_path.with_extension("json.bak");
                storage::load(&backup).map_err(|_| primary_error)
            });
            {
                let state = app.state::<AppState>();
                if let Ok(mut path) = state.storage_path.lock() {
                    *path = storage_path;
                }
                match loaded {
                    Ok(skribs) => state.coordinator.replace_all_skribs(skribs),
                    Err(message) => {
                        let _ = app_handle.emit("skribly://storage-error", message);
                    }
                }
            }
            let coordinator = app.state::<AppState>().coordinator.clone();
            let running_flag = app.state::<AppState>().running.clone();

            let main_window = app.get_webview_window("main");

            #[cfg(target_os = "windows")]
            {
                if let Some(ref window) = main_window {
                    if let Ok(hwnd) = window.hwnd() {
                        let _ = hwnd;
                        install_hotkey_sender(hotkey_sender);
                        let state = app.state::<AppState>();
                        initialize_native_overlay(&app_handle, &state, window);
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
                            let target_to_use = match active_target {
                                Some(t) => Some(t),
                                None => {
                                    #[cfg(target_os = "windows")]
                                    {
                                        get_foreground_target_window()
                                    }
                                    #[cfg(not(target_os = "windows"))]
                                    {
                                        None
                                    }
                                }
                            };

                            let state_hk = app_handle_hk.state::<AppState>();
                            if let Some(ref target) = target_to_use {
                                coordinator_hk.set_active_target(Some(target.clone()));
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
                                    text: "New Skrib note".into(),
                                    color: "yellow".into(),
                                    collapsed: false,
                                    created_at: (timestamp / 1000) as u64,
                                    updated_at: (timestamp / 1000) as u64,
                                };
                                coordinator_hk.upsert_skrib(new_note);
                                if let Err(message) = persist_skribs(&state_hk) {
                                    let _ = app_handle_hk.emit("skribly://storage-error", message);
                                }
                                let payload = build_overlay_payload(&app_handle_hk, &state_hk, false);
                                let _ = app_handle_hk.emit("skribly://global-shortcut", payload);
                            } else {
                                let mut payload = build_overlay_payload(&app_handle_hk, &state_hk, false);
                                payload.is_shortcut_active = true;
                                let _ = app_handle_hk.emit("skribly://global-shortcut", payload);
                            }
                        }
                    }
                }
            });

            // Event-driven WinEvent processing thread
            let app_handle_ev = app_handle.clone();
            std::thread::spawn(move || {
                let mut tick_counter: u32 = 0;
                while running_flag.load(Ordering::Relaxed) {
                    tick_counter += 1;
                    if let Ok(notice) = event_receiver.recv_timeout(Duration::from_millis(500)) {
                        #[cfg(target_os = "windows")]
                        {
                            let state_ev = app_handle_ev.state::<AppState>();
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
                                            coordinator.set_active_target(None);
                                            let payload = build_mutation_payload(&app_handle_ev, &state_ev, false);
                                            let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                        } else if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                            if let Some(updated) = inspect_target_window(hwnd) {
                                                coordinator.set_active_target(Some(updated.clone()));
                                                let payload = build_mutation_payload(&app_handle_ev, &state_ev, false);
                                                let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                            } else {
                                                coordinator.set_active_target(None);
                                                let payload = build_mutation_payload(&app_handle_ev, &state_ev, false);
                                                let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                            }
                                        }
                                    } else if notice.event_type == EVENT_SYSTEM_FOREGROUND {
                                        if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                            if let Some(new_target) = inspect_target_window(hwnd) {
                                                let candidates = vec![new_target.clone()];
                                                match coordinator.find_best_context_match(&candidates) {
                                                    MatchResult::Unique(best) => {
                                                        coordinator.set_active_target(Some(best));
                                                    }
                                                    _ => {
                                                        coordinator.set_active_target(Some(new_target));
                                                    }
                                                }
                                                let payload = build_mutation_payload(&app_handle_ev, &state_ev, false);
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
                                                    coordinator.set_active_target(Some(best));
                                                }
                                                MatchResult::Ambiguous(matched) => {
                                                    let mut payload = build_mutation_payload(&app_handle_ev, &state_ev, true);
                                                    payload.available_windows = matched;
                                                    let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                                }
                                                MatchResult::None => {
                                                    coordinator.set_active_target(Some(new_target));
                                                }
                                            }
                                            let payload = build_mutation_payload(&app_handle_ev, &state_ev, false);
                                            let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // Periodic fallback check (every ~2 seconds) for target window validity
                        if tick_counter % 4 == 0 {
                            #[cfg(target_os = "windows")]
                            {
                                let state_ev = app_handle_ev.state::<AppState>();
                                if let Some(target) = coordinator.get_active_target() {
                                    if reconstruct_hwnd(target.hwnd_val).is_none() {
                                        coordinator.set_active_target(None);
                                        let payload = build_mutation_payload(&app_handle_ev, &state_ev, false);
                                        let _ = app_handle_ev.emit("skribly://overlay-update", payload);
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
            init_status: OverlayInitializationStatus::Initializing,
        };

        assert!(payload.available_windows.is_empty());

        #[cfg(target_os = "windows")]
        assert_eq!(platform::windows::get_window_enumeration_count(), 0);
    }

    #[test]
    fn test_overlay_initialization_status_transitions() {
        let app_state = AppState {
            coordinator: Coordinator::new(),
            running: Arc::new(AtomicBool::new(true)),
            init_status: Mutex::new(OverlayInitializationStatus::Initializing),
            storage_path: Mutex::new(std::env::temp_dir().join("skribly-test.json")),
            #[cfg(target_os = "windows")]
            win_event_sender: channel().0,
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
        });

        assert!(visible_skribs(&coordinator, None).is_empty());
        assert_eq!(coordinator.get_all_skribs().len(), 1);
    }
}
