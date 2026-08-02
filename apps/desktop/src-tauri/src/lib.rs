mod core;
mod desktop;
mod platform;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

use core::coordinator::{Coordinator, MatchResult};
use core::models::{
    HitTestRect, OverlayInitializationStatus, OverlayMetrics, OverlayStatePayload, SkribNote,
    TargetWindowInfo,
};
use core::storage;

#[cfg(target_os = "windows")]
use platform::windows::{
    get_overlay_metrics as query_overlay_metrics, inspect_target_window, install_hotkey_sender,
    install_overlay_subclass, install_winevent_hooks, list_candidate_target_windows,
    reconstruct_hwnd, register_global_hotkey, set_dpi_awareness, uninstall_overlay_subclass,
    uninstall_winevent_hooks, unregister_global_hotkey, EVENT_OBJECT_DESTROY,
    EVENT_OBJECT_LOCATIONCHANGE, EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND,
    EVENT_SYSTEM_MINIMIZESTART,
};
#[cfg(target_os = "windows")]
use platform::windows_events::{WinEventPipeline, WIN_EVENT_QUEUE_CAPACITY};
#[cfg(target_os = "windows")]
use platform::windows_focus::focus_external_window;
#[cfg(target_os = "windows")]
use platform::windows_placement::{initialize_compact_window, position_compact_window_for_target};
#[cfg(target_os = "windows")]
use platform::windows_target_capture::{
    capture_foreground_target, revalidate_captured_target, TargetCaptureError,
};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageHealthPayload {
    notice: Option<storage::StorageNotice>,
    error: Option<String>,
    writable: bool,
    revision: u64,
    backup_directory: String,
}

pub struct AppState {
    pub coordinator: Coordinator,
    pub running: Arc<AtomicBool>,
    pub init_status: Mutex<OverlayInitializationStatus>,
    pub mutation_lock: Mutex<()>,
    pub storage: Mutex<storage::StorageService>,
    pub storage_notice: Mutex<Option<storage::StorageNotice>>,
    pub storage_error: Mutex<Option<String>>,
    #[cfg(target_os = "windows")]
    pub win_event_pipeline: WinEventPipeline,
}

fn set_runtime_active_target(state: &AppState, target: Option<TargetWindowInfo>) {
    #[cfg(target_os = "windows")]
    state
        .win_event_pipeline
        .set_active_target(target.as_ref().map(|target| target.hwnd_val));
    state.coordinator.set_active_target(target);
}

#[cfg(target_os = "windows")]
fn present_target_capture_error(
    app_handle: &AppHandle,
    state: &AppState,
    error: TargetCaptureError,
) {
    set_runtime_active_target(state, None);
    let _ = app_handle.emit("skribly://target-capture-error", error);
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(target_os = "windows")]
fn clear_target_capture_error(app_handle: &AppHandle) {
    let _ = app_handle.emit("skribly://target-capture-clear", ());
}

fn persist_skribs(state: &AppState) -> Result<(), String> {
    let skribs = state.coordinator.get_all_skribs();
    let result = {
        let mut storage = state
            .storage
            .lock()
            .map_err(|_| "Local storage service is unavailable".to_string())?;
        storage
            .save(&skribs)
            .map(|_| ())
            .map_err(|error| error.to_string())
    };

    match result {
        Ok(()) => {
            state.clear_storage_error();
            Ok(())
        }
        Err(message) => {
            state.record_storage_error(message.clone());
            Err(message)
        }
    }
}

fn run_persisted_mutation<T>(
    state: &AppState,
    mutation: impl FnOnce(&Coordinator) -> Result<T, String>,
) -> Result<T, String> {
    let _mutation_guard = state
        .mutation_lock
        .lock()
        .map_err(|_| "Local note mutation lock is unavailable".to_string())?;
    let previous = state.coordinator.get_all_skribs();
    let result = mutation(&state.coordinator)?;

    if let Err(message) = persist_skribs(state) {
        state.coordinator.replace_all_skribs(previous);
        return Err(message);
    }
    Ok(result)
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

    fn set_storage_notice(&self, notice: Option<storage::StorageNotice>) {
        if let Ok(mut lock) = self.storage_notice.lock() {
            *lock = notice;
        }
    }

    fn record_storage_error(&self, message: String) {
        if let Ok(mut lock) = self.storage_error.lock() {
            *lock = Some(message);
        }
    }

    fn clear_storage_error(&self) {
        if let Ok(mut lock) = self.storage_error.lock() {
            *lock = None;
        }
    }

    fn storage_health(&self) -> StorageHealthPayload {
        let notice = self
            .storage_notice
            .lock()
            .ok()
            .and_then(|notice| notice.clone());
        let mut error = self
            .storage_error
            .lock()
            .ok()
            .and_then(|message| message.clone());

        let (writable, revision, backup_directory) = match self.storage.lock() {
            Ok(storage) => {
                if error.is_none() {
                    error = storage.blocked_reason().map(ToString::to_string);
                }
                (
                    storage.is_writable(),
                    storage.current_revision(),
                    storage
                        .primary_path()
                        .parent()
                        .map(|path| path.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                )
            }
            Err(_) => {
                if error.is_none() {
                    error = Some("Local storage service is unavailable".to_string());
                }
                (false, 0, String::new())
            }
        };

        StorageHealthPayload {
            notice,
            error,
            writable,
            revision,
            backup_directory,
        }
    }
}

#[tauri::command]
fn get_foreground_window() -> Option<TargetWindowInfo> {
    #[cfg(target_os = "windows")]
    {
        capture_foreground_target()
            .ok()
            .and_then(|capture| revalidate_captured_target(&capture).ok())
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
            .map_err(|error| format!("Failed to acquire compact editor HWND: {error}"))?;
        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
        let metrics = initialize_compact_window(window)?;

        install_overlay_subclass(win_hwnd, state.coordinator.clone())?;

        unregister_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID);
        register_global_hotkey(win_hwnd, GLOBAL_HOTKEY_ID)?;
        if !install_winevent_hooks(state.win_event_pipeline.clone()) {
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
            initialize_native_overlay(&app_handle, &state, &window);
        }
    }
    build_overlay_payload(&app_handle, &state, false)
}

#[tauri::command]
fn reposition_compact_window(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<OverlayMetrics, String> {
    #[cfg(target_os = "windows")]
    {
        let target = state
            .coordinator
            .get_active_target()
            .ok_or_else(|| "Skribli no longer has an active target application.".to_string())?;
        let hwnd = reconstruct_hwnd(target.hwnd_val)
            .ok_or_else(|| "The original target application is no longer available.".to_string())?;
        let refreshed_target = inspect_target_window(hwnd)
            .ok_or_else(|| "Windows could not refresh the target application.".to_string())?;
        let window = app_handle
            .get_webview_window("main")
            .ok_or_else(|| "The compact editor window is unavailable.".to_string())?;
        let metrics = position_compact_window_for_target(&window, &refreshed_target)?;
        set_runtime_active_target(&state, Some(refreshed_target));
        Ok(metrics)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app_handle, state);
        Err("Compact editor repositioning is currently available on Windows only.".into())
    }
}

#[tauri::command]
fn set_active_target(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    target: Option<TargetWindowInfo>,
) -> OverlayStatePayload {
    set_runtime_active_target(&state, target);
    build_overlay_payload(&app_handle, &state, false)
}

#[tauri::command]
fn get_storage_health(state: State<'_, AppState>) -> StorageHealthPayload {
    state.storage_health()
}

#[tauri::command]
fn export_storage_diagnostics(state: State<'_, AppState>) -> Result<String, String> {
    let storage = state
        .storage
        .lock()
        .map_err(|_| "Local storage service is unavailable".to_string())?;
    storage
        .export_diagnostics()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    note: SkribNote,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .upsert_skrib(note)
            .then_some(())
            .ok_or_else(|| "Skrib note input is invalid or storage is read-only".to_string())
    })?;
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
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_position(&id, rel_x, rel_y, width, height)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn update_skrib_text(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    text: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_text(&id, text)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn update_skrib_color(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    color: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .update_skrib_color(&id, color)
            .then_some(())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn toggle_skrib_collapse(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .toggle_skrib_collapse(&id)
            .map(|_| ())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn delete_skrib_note(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<OverlayStatePayload, String> {
    run_persisted_mutation(&state, |coordinator| {
        coordinator
            .remove_skrib(&id)
            .map(|_| ())
            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())
    })?;
    Ok(build_mutation_payload(&app_handle, &state, false))
}

#[tauri::command]
fn get_all_skribs(state: State<'_, AppState>) -> Vec<SkribNote> {
    let mut skribs = state.coordinator.get_all_skribs();
    skribs.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    skribs
}

#[tauri::command]
fn focus_target_window(hwnd_val: isize) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        focus_external_window(hwnd_val)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = hwnd_val;
        Err("Focusing an external application is currently available on Windows only.".into())
    }
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
                    set_runtime_active_target(&state, Some(updated_target));
                } else {
                    set_runtime_active_target(&state, None);
                }
            } else {
                set_runtime_active_target(&state, None);
            }
        } else {
            let candidates = list_candidate_target_windows();
            match state.coordinator.find_best_context_match(&candidates) {
                MatchResult::Unique(best) => {
                    set_runtime_active_target(&state, Some(best));
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

const GLOBAL_HOTKEY_ID: i32 = 0x534B;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        set_dpi_awareness();
    }

    let (hotkey_sender, hotkey_receiver): (std::sync::mpsc::Sender<i32>, Receiver<i32>) = channel();

    let coordinator = Coordinator::new();
    #[cfg(target_os = "windows")]
    let (win_event_pipeline, event_receiver) = WinEventPipeline::new(WIN_EVENT_QUEUE_CAPACITY);
    let running = Arc::new(AtomicBool::new(true));
    let storage_path = std::env::temp_dir().join("skribly-uninitialized.json");
    let app_state = AppState {
        coordinator: coordinator.clone(),
        running: running.clone(),
        init_status: Mutex::new(OverlayInitializationStatus::Initializing),
        mutation_lock: Mutex::new(()),
        storage: Mutex::new(storage::StorageService::new(storage_path)),
        storage_notice: Mutex::new(None),
        storage_error: Mutex::new(None),
        #[cfg(target_os = "windows")]
        win_event_pipeline: win_event_pipeline.clone(),
    };

    let app = tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            list_target_windows,
            get_overlay_metrics,
            retry_overlay_initialization,
            reposition_compact_window,
            set_active_target,
            get_storage_health,
            export_storage_diagnostics,
            upsert_skrib_note,
            update_skrib_position,
            update_skrib_text,
            update_skrib_color,
            toggle_skrib_collapse,
            delete_skrib_note,
            get_all_skribs,
            focus_target_window,
            set_hit_test_rects,
            refresh_target_state,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let data_dir = app.path().app_data_dir()?;
            let storage_path = data_dir.join("skribs.json");
            let mut storage_service = storage::StorageService::new(storage_path);
            let loaded = storage_service.load();
            {
                let state = app.state::<AppState>();
                let mut storage = state
                    .storage
                    .lock()
                    .map_err(|_| "Local storage service is unavailable")?;
                *storage = storage_service;
                drop(storage);

                match loaded {
                    Ok(outcome) => {
                        state.coordinator.replace_all_skribs(outcome.skribs);
                        state.set_storage_notice(outcome.notice);
                        state.clear_storage_error();
                    }
                    Err(error) => {
                        state.record_storage_error(error.to_string());
                    }
                }
            }

            desktop::tray::install_tray(app)?;

            let coordinator = app.state::<AppState>().coordinator.clone();
            let running_flag = app.state::<AppState>().running.clone();
            let main_window = app.get_webview_window("main");

            #[cfg(target_os = "windows")]
            {
                if let Some(ref window) = main_window {
                    if window.hwnd().is_ok() {
                        install_hotkey_sender(hotkey_sender);
                        let state = app.state::<AppState>();
                        initialize_native_overlay(&app_handle, &state, window);
                    }
                }
            }

            let coordinator_hk = coordinator.clone();
            let app_handle_hk = app_handle.clone();
            let running_flag_hk = running_flag.clone();

            std::thread::spawn(move || {
                while running_flag_hk.load(Ordering::Relaxed) {
                    if let Ok(hotkey_id) = hotkey_receiver.recv_timeout(Duration::from_millis(100))
                    {
                        if hotkey_id != GLOBAL_HOTKEY_ID {
                            continue;
                        }

                        let state_hk = app_handle_hk.state::<AppState>();
                        set_runtime_active_target(&state_hk, None);

                        #[cfg(target_os = "windows")]
                        let capture = match capture_foreground_target() {
                            Ok(capture) => capture,
                            Err(error) => {
                                present_target_capture_error(&app_handle_hk, &state_hk, error);
                                continue;
                            }
                        };

                        #[cfg(target_os = "windows")]
                        let target = match revalidate_captured_target(&capture) {
                            Ok(target) => target,
                            Err(error) => {
                                present_target_capture_error(&app_handle_hk, &state_hk, error);
                                continue;
                            }
                        };

                        #[cfg(not(target_os = "windows"))]
                        let target = match coordinator_hk.get_active_target() {
                            Some(target) => target,
                            None => continue,
                        };

                        let Some(window) = app_handle_hk.get_webview_window("main") else {
                            let _ = app_handle_hk.emit(
                                "skribly://hotkey-error",
                                "The compact editor window is unavailable. Restart Skribli and try again.",
                            );
                            continue;
                        };

                        #[cfg(target_os = "windows")]
                        if let Err(message) = position_compact_window_for_target(&window, &target) {
                            let _ = app_handle_hk.emit(
                                "skribly://hotkey-error",
                                format!("Skribli could not place the compact editor safely: {message}"),
                            );
                            continue;
                        }

                        #[cfg(target_os = "windows")]
                        clear_target_capture_error(&app_handle_hk);
                        set_runtime_active_target(&state_hk, Some(target.clone()));
                        let existing_notes = coordinator_hk.get_skribs_for_target(&target);
                        if existing_notes.is_empty() {
                            let timestamp = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis();
                            let new_note = SkribNote {
                                id: format!("skrib-hotkey-{timestamp}"),
                                target_process_name: target.process_name.clone(),
                                target_title: target.title.clone(),
                                rel_x: 0.0,
                                rel_y: 0.0,
                                width: 400.0,
                                height: 340.0,
                                text: String::new(),
                                color: "yellow".into(),
                                collapsed: false,
                                created_at: (timestamp / 1000) as u64,
                                updated_at: (timestamp / 1000) as u64,
                            };
                            if let Err(message) =
                                run_persisted_mutation(&state_hk, |coordinator| {
                                    coordinator
                                        .upsert_skrib(new_note)
                                        .then_some(())
                                        .ok_or_else(|| {
                                            "The new note did not pass native validation."
                                                .to_string()
                                        })
                                })
                            {
                                let _ = app_handle_hk.emit("skribly://storage-error", message);
                                continue;
                            }
                        }

                        let _ = window.show();
                        let _ = window.set_focus();
                        let payload = build_overlay_payload(&app_handle_hk, &state_hk, false);
                        let _ = app_handle_hk.emit("skribly://global-shortcut", payload);
                    }
                }
            });

            let app_handle_ev = app_handle.clone();
            std::thread::spawn(move || {
                let mut tick_counter: u32 = 0;
                while running_flag.load(Ordering::Relaxed) {
                    tick_counter = tick_counter.wrapping_add(1);
                    if let Ok(mut notice) = event_receiver.recv_timeout(Duration::from_millis(500)) {
                        notice.mark_processing_started();
                        let state_ev = app_handle_ev.state::<AppState>();
                        let note_window_visible = app_handle_ev
                            .get_webview_window("main")
                            .and_then(|window| window.is_visible().ok())
                            .unwrap_or(false);

                        #[cfg(target_os = "windows")]
                        if note_window_visible {
                            if matches!(
                                notice.event_type,
                                EVENT_OBJECT_LOCATIONCHANGE | EVENT_SYSTEM_MINIMIZEEND
                            ) {
                                if let Some(target) = coordinator.get_active_target() {
                                    if target.hwnd_val == notice.hwnd_val {
                                        if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                            if let Some(updated) = inspect_target_window(hwnd) {
                                                set_runtime_active_target(
                                                    &state_ev,
                                                    Some(updated.clone()),
                                                );
                                                if let Some(window) =
                                                    app_handle_ev.get_webview_window("main")
                                                {
                                                    if let Err(message) =
                                                        position_compact_window_for_target(
                                                            &window, &updated,
                                                        )
                                                    {
                                                        let _ = app_handle_ev.emit(
                                                            "skribly://hotkey-error",
                                                            format!("Skribli could not keep the editor on the target display: {message}"),
                                                        );
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            continue;
                        }

                        #[cfg(target_os = "windows")]
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
                                        set_runtime_active_target(&state_ev, None);
                                        let payload = build_mutation_payload(
                                            &app_handle_ev,
                                            &state_ev,
                                            false,
                                        );
                                        let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                    } else if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                        if let Some(updated) = inspect_target_window(hwnd) {
                                            set_runtime_active_target(
                                                &state_ev,
                                                Some(updated.clone()),
                                            );
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                        } else {
                                            set_runtime_active_target(&state_ev, None);
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
                                            let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                        }
                                    }
                                } else if notice.event_type == EVENT_SYSTEM_FOREGROUND {
                                    if let Some(hwnd) = reconstruct_hwnd(notice.hwnd_val) {
                                        if let Some(new_target) = inspect_target_window(hwnd) {
                                            let candidates = vec![new_target.clone()];
                                            match coordinator.find_best_context_match(&candidates) {
                                                MatchResult::Unique(best) => {
                                                    set_runtime_active_target(&state_ev, Some(best));
                                                }
                                                _ => {
                                                    set_runtime_active_target(
                                                        &state_ev,
                                                        Some(new_target),
                                                    );
                                                }
                                            }
                                            let payload = build_mutation_payload(
                                                &app_handle_ev,
                                                &state_ev,
                                                false,
                                            );
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
                                                set_runtime_active_target(&state_ev, Some(best));
                                            }
                                            MatchResult::Ambiguous(matched) => {
                                                let mut payload = build_mutation_payload(
                                                    &app_handle_ev,
                                                    &state_ev,
                                                    true,
                                                );
                                                payload.available_windows = matched;
                                                let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                            }
                                            MatchResult::None => {
                                                set_runtime_active_target(
                                                    &state_ev,
                                                    Some(new_target),
                                                );
                                            }
                                        }
                                        let payload = build_mutation_payload(
                                            &app_handle_ev,
                                            &state_ev,
                                            false,
                                        );
                                        let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                    }
                                }
                            }
                        }
                    } else if tick_counter % 4 == 0 {
                        #[cfg(target_os = "windows")]
                        {
                            let state_ev = app_handle_ev.state::<AppState>();
                            if let Some(target) = coordinator.get_active_target() {
                                let Some(hwnd) = reconstruct_hwnd(target.hwnd_val) else {
                                    set_runtime_active_target(&state_ev, None);
                                    let payload =
                                        build_mutation_payload(&app_handle_ev, &state_ev, false);
                                    let _ = app_handle_ev.emit("skribly://overlay-update", payload);
                                    continue;
                                };

                                if let Some(updated) = inspect_target_window(hwnd) {
                                    let placement_changed = updated.bounds != target.bounds
                                        || updated.dpi != target.dpi;
                                    set_runtime_active_target(&state_ev, Some(updated.clone()));
                                    let note_window_visible = app_handle_ev
                                        .get_webview_window("main")
                                        .and_then(|window| window.is_visible().ok())
                                        .unwrap_or(false);
                                    if placement_changed && note_window_visible {
                                        if let Some(window) =
                                            app_handle_ev.get_webview_window("main")
                                        {
                                            if let Err(message) =
                                                position_compact_window_for_target(
                                                    &window, &updated,
                                                )
                                            {
                                                let _ = app_handle_ev.emit(
                                                    "skribly://hotkey-error",
                                                    format!("Skribli could not update the editor position after a display change: {message}"),
                                                );
                                            }
                                        }
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
        .expect("error while building Skribli");

    app.run(move |app_handle, event| match event {
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
            api.prevent_close();
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        RunEvent::Exit => {
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
        _ => {}
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
        let coordinator = Coordinator::new();
        #[cfg(target_os = "windows")]
        let (win_event_pipeline, _event_receiver) = WinEventPipeline::new(WIN_EVENT_QUEUE_CAPACITY);
        let app_state = AppState {
            coordinator,
            running: Arc::new(AtomicBool::new(true)),
            init_status: Mutex::new(OverlayInitializationStatus::Initializing),
            mutation_lock: Mutex::new(()),
            storage: Mutex::new(storage::StorageService::new(
                std::env::temp_dir().join("skribly-test.json"),
            )),
            storage_notice: Mutex::new(None),
            storage_error: Mutex::new(None),
            #[cfg(target_os = "windows")]
            win_event_pipeline,
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

    #[test]
    fn failed_persistence_restores_the_previous_coordinator_snapshot() {
        let directory = std::env::temp_dir().join(format!(
            "skribly-lib-storage-rollback-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&directory);
        std::fs::create_dir_all(&directory).expect("create test directory");
        let storage_path = directory.join("skribs.json");
        std::fs::write(
            &storage_path,
            r#"{"schema_version":99,"revision":1,"written_at_ms":1,"integrity":"future","skribs":[]}"#,
        )
        .expect("write unsupported schema fixture");

        let mut storage_service = storage::StorageService::new(storage_path);
        assert!(storage_service.load().is_err());
        let coordinator = Coordinator::new();
        let original = SkribNote {
            id: "note-a".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document-A.txt - Notepad".into(),
            rel_x: 20.0,
            rel_y: 20.0,
            width: 300.0,
            height: 220.0,
            text: "Original".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 1,
        };
        coordinator.upsert_skrib(original.clone());
        #[cfg(target_os = "windows")]
        let (win_event_pipeline, _event_receiver) = WinEventPipeline::new(WIN_EVENT_QUEUE_CAPACITY);
        let app_state = AppState {
            coordinator: coordinator.clone(),
            running: Arc::new(AtomicBool::new(true)),
            init_status: Mutex::new(OverlayInitializationStatus::Initializing),
            mutation_lock: Mutex::new(()),
            storage: Mutex::new(storage_service),
            storage_notice: Mutex::new(None),
            storage_error: Mutex::new(None),
            #[cfg(target_os = "windows")]
            win_event_pipeline,
        };

        let initial_health = app_state.storage_health();
        assert!(!initial_health.writable);
        assert!(initial_health.error.is_some());

        let result = run_persisted_mutation(&app_state, |coordinator| {
            coordinator
                .update_skrib_text("note-a", "Unsaved".to_string())
                .then_some(())
                .ok_or_else(|| "note missing".to_string())
        });
        assert!(result.is_err());
        assert_eq!(coordinator.get_all_skribs(), vec![original]);
        assert!(app_state.storage_health().error.is_some());
        assert!(!app_state.storage_health().writable);
        let _ = std::fs::remove_dir_all(&directory);
    }
}
