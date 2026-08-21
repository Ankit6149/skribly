//! Real Windows native platform implementation for Skribli.
//! Provides handle-leak-free window enumeration, HWND numeric conversion,
//! RegisterHotKey global shortcuts, compact-window WndProc subclassing,
//! WinEvent hooks, DPI awareness, and coordinate conversion helpers.

use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, Sender};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

use windows::core::BOOL;
use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::System::ProcessStatus::K32GetModuleFileNameExW;
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
use windows::Win32::UI::HiDpi::{
    GetDpiForWindow, SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, MOD_CONTROL, MOD_SHIFT, VK_SPACE,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallWindowProcW, EnumWindows, GetClassNameW, GetForegroundWindow, GetMessageW,
    GetWindowLongPtrW, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
    IsWindowVisible, SetWindowLongPtrW, GWLP_WNDPROC, MSG, WINEVENT_OUTOFCONTEXT,
    WINEVENT_SKIPOWNPROCESS, WM_HOTKEY, WNDPROC,
};

use crate::core::coordinator::Coordinator;
use crate::core::models::{HitTestRect, OverlayMetrics, TargetWindowInfo, WindowRect};

use super::windows_events::{deliver_global_win_event, WinEventPipeline};
pub use super::windows_events::{
    EVENT_OBJECT_DESTROY, EVENT_OBJECT_HIDE, EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_NAMECHANGE,
    EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND, EVENT_SYSTEM_MINIMIZESTART,
};

static ORIGINAL_WNDPROC: AtomicIsize = AtomicIsize::new(0);
static GLOBAL_COORDINATOR: OnceLock<Coordinator> = OnceLock::new();
static ACTIVE_WINEVENT_HOOKS: std::sync::Mutex<Vec<isize>> = std::sync::Mutex::new(Vec::new());
static ENUMERATION_COUNT: AtomicU64 = AtomicU64::new(0);

/// RAII wrapper for Win32 HANDLE to guarantee CloseHandle is invoked on drop.
pub struct AutoCloseHandle(pub HANDLE);

impl Drop for AutoCloseHandle {
    fn drop(&mut self) {
        if !self.0.is_invalid() && self.0 .0 != std::ptr::null_mut() {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }
}

/// Set process-level DPI awareness context to Per-Monitor Aware V2.
pub fn set_dpi_awareness() {
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
}

/// Convert physical screen coordinates to logical DIP coordinates.
pub fn physical_to_logical(px: i32, py: i32, scale_factor: f64) -> (i32, i32) {
    let scale = if scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };
    (
        (px as f64 / scale).round() as i32,
        (py as f64 / scale).round() as i32,
    )
}

/// Convert logical DIP coordinates to physical screen coordinates.
pub fn logical_to_physical(lx: i32, ly: i32, scale_factor: f64) -> (i32, i32) {
    let scale = if scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };
    (
        (lx as f64 * scale).round() as i32,
        (ly as f64 * scale).round() as i32,
    )
}

/// Query current compact editor physical metrics.
pub fn get_overlay_metrics(hwnd: HWND) -> OverlayMetrics {
    unsafe {
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_ok() {
            let overlay_physical_x = rect.left;
            let overlay_physical_y = rect.top;
            let overlay_physical_width = (rect.right - rect.left).max(0);
            let overlay_physical_height = (rect.bottom - rect.top).max(0);
            let (dpi, scale_factor) = get_window_dpi(hwnd);

            OverlayMetrics {
                overlay_physical_x,
                overlay_physical_y,
                overlay_physical_width,
                overlay_physical_height,
                dpi,
                scale_factor,
            }
        } else {
            OverlayMetrics::default()
        }
    }
}

/// Track total window enumeration invocations for verification.
pub fn get_window_enumeration_count() -> u64 {
    ENUMERATION_COUNT.load(Ordering::Relaxed)
}

pub fn reset_window_enumeration_count() {
    ENUMERATION_COUNT.store(0, Ordering::Relaxed);
}

/// Reconstruct HWND safely from numeric handle value.
pub fn reconstruct_hwnd(hwnd_val: isize) -> Option<HWND> {
    if hwnd_val == 0 {
        return None;
    }
    let hwnd = HWND(hwnd_val as *mut _);
    unsafe {
        if IsWindow(Some(hwnd)).as_bool() {
            Some(hwnd)
        } else {
            None
        }
    }
}

fn is_expected_hotkey_message(message: &MSG, hotkey_id: i32) -> bool {
    message.message == WM_HOTKEY && message.wParam.0 as i32 == hotkey_id
}

/// Own the global shortcut on a dedicated native message thread.
///
/// WebView window procedures can be replaced during a show/hide lifecycle. A
/// thread-owned hotkey stays reliable regardless of compact-window visibility.
pub fn start_global_hotkey_listener(
    sender: Sender<i32>,
    running: Arc<AtomicBool>,
    hotkey_id: i32,
) -> Result<(), String> {
    let (ready_sender, ready_receiver) = sync_channel::<Result<(), String>>(1);

    std::thread::Builder::new()
        .name("skribli-global-hotkey".to_string())
        .spawn(move || {
            let registration = unsafe {
                RegisterHotKey(None, hotkey_id, MOD_CONTROL | MOD_SHIFT, VK_SPACE.0 as u32).map_err(
                    |error| format!("Failed to register Ctrl+Shift+Space global hotkey: {error}"),
                )
            };

            if let Err(message) = registration {
                let _ = ready_sender.send(Err(message));
                return;
            }
            let _ = ready_sender.send(Ok(()));

            let mut last_forwarded: Option<Instant> = None;
            while running.load(Ordering::Relaxed) {
                let mut message = MSG::default();
                let result = unsafe { GetMessageW(&mut message, None, WM_HOTKEY, WM_HOTKEY) };
                if result.0 <= 0 {
                    break;
                }
                if !is_expected_hotkey_message(&message, hotkey_id) {
                    continue;
                }
                let outside_debounce =
                    last_forwarded.is_none_or(|last| last.elapsed() >= Duration::from_millis(300));
                if outside_debounce {
                    last_forwarded = Some(Instant::now());
                    if sender.send(hotkey_id).is_err() {
                        break;
                    }
                }
            }

            unsafe {
                let _ = UnregisterHotKey(None, hotkey_id);
            }
        })
        .map_err(|error| format!("Failed to start the global-hotkey listener: {error}"))?;

    ready_receiver
        .recv_timeout(Duration::from_secs(2))
        .map_err(|_| "The global-hotkey listener did not start in time.".to_string())?
}

/// Calculate hit-testing intersection between physical cursor and client DIP rectangles.
pub fn check_hit_test_rect_math(
    overlay_x: i32,
    overlay_y: i32,
    scale_factor: f64,
    rects: &[HitTestRect],
    px: i32,
    py: i32,
) -> bool {
    let scale = if scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };
    for rect in rects {
        let phys_left = overlay_x + (rect.x as f64 * scale).round() as i32;
        let phys_top = overlay_y + (rect.y as f64 * scale).round() as i32;
        let phys_right = phys_left + (rect.width as f64 * scale).round() as i32;
        let phys_bottom = phys_top + (rect.height as f64 * scale).round() as i32;

        if px >= phys_left && px <= phys_right && py >= phys_top && py <= phys_bottom {
            return true;
        }
    }
    false
}

/// Perform DPI- and screen-origin-aware hit testing against client rects.
pub fn check_hit_test_interactive(hwnd: HWND, px: i32, py: i32, rects: &[HitTestRect]) -> bool {
    unsafe {
        let mut window_rect = RECT::default();
        if GetWindowRect(hwnd, &mut window_rect).is_err() {
            return false;
        }
        let overlay_x = window_rect.left;
        let overlay_y = window_rect.top;
        let (_, scale_factor) = get_window_dpi(hwnd);

        check_hit_test_rect_math(overlay_x, overlay_y, scale_factor, rects, px, py)
    }
}

/// Custom WndProc subclass function keeping the compact window interactive.
unsafe extern "system" fn overlay_subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    // Always delegate hit testing to Tauri's original procedure. Tauri uses that path to turn
    // only `data-tauri-drag-region` elements into native caption drags while leaving buttons,
    // inputs, the editor canvas, and other controls as normal client interactions.
    let original = ORIGINAL_WNDPROC.load(Ordering::Relaxed);
    if original != 0 {
        let original_fn: WNDPROC = std::mem::transmute(original);
        CallWindowProcW(original_fn, hwnd, msg, wparam, lparam)
    } else {
        LRESULT(0)
    }
}

/// Install native WndProc subclassing on the compact editor HWND.
pub fn install_overlay_subclass(hwnd: HWND, coordinator: Coordinator) -> Result<(), String> {
    let _ = GLOBAL_COORDINATOR.set(coordinator);
    unsafe {
        let current_proc = GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
        let subclass_proc = overlay_subclass_proc as *const () as isize;
        if current_proc == subclass_proc {
            return Ok(());
        }
        if current_proc == 0 {
            return Err("Failed to read the compact editor window procedure".into());
        }

        let replaced_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, subclass_proc);
        if replaced_proc == 0 {
            return Err("Failed to install compact editor native input handling".into());
        }
        ORIGINAL_WNDPROC.store(current_proc, Ordering::Relaxed);
    }
    Ok(())
}

/// Restore original WndProc on shutdown.
pub fn uninstall_overlay_subclass(hwnd: HWND) {
    let original = ORIGINAL_WNDPROC.swap(0, Ordering::Relaxed);
    if original != 0 {
        unsafe {
            SetWindowLongPtrW(hwnd, GWLP_WNDPROC, original);
        }
    }
}

/// WinEvent callback. Filtering, coalescing, and non-blocking delivery happen in the pipeline.
unsafe extern "system" fn win_event_proc(
    _h_win_event_hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    id_child: i32,
    _id_event_thread: u32,
    _dwms_event_time: u32,
) {
    deliver_global_win_event(event, hwnd.0 as isize, id_object, id_child);
}

/// Install the exact hook set once. Retrying initialization is idempotent.
pub fn install_winevent_hooks(pipeline: WinEventPipeline) -> bool {
    if !pipeline.install_global() {
        return false;
    }

    let target_events = [
        EVENT_SYSTEM_FOREGROUND,
        EVENT_SYSTEM_MINIMIZESTART,
        EVENT_SYSTEM_MINIMIZEEND,
        EVENT_OBJECT_DESTROY,
        EVENT_OBJECT_HIDE,
        EVENT_OBJECT_LOCATIONCHANGE,
        EVENT_OBJECT_NAMECHANGE,
    ];

    let Ok(mut hooks_guard) = ACTIVE_WINEVENT_HOOKS.lock() else {
        return false;
    };
    if hooks_guard.len() == target_events.len() {
        return true;
    }

    for raw in hooks_guard.drain(..) {
        unsafe {
            let hook = HWINEVENTHOOK(raw as *mut _);
            let _ = UnhookWinEvent(hook);
        }
    }

    unsafe {
        for &event in &target_events {
            let hook = SetWinEventHook(
                event,
                event,
                None,
                Some(win_event_proc),
                0,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );
            if hook.0 != std::ptr::null_mut() {
                hooks_guard.push(hook.0 as isize);
            }
        }
    }

    if hooks_guard.len() == target_events.len() {
        true
    } else {
        for raw in hooks_guard.drain(..) {
            unsafe {
                let hook = HWINEVENTHOOK(raw as *mut _);
                let _ = UnhookWinEvent(hook);
            }
        }
        false
    }
}

/// Unhook WinEvent hooks on application exit.
pub fn uninstall_winevent_hooks() {
    if let Ok(mut hooks_guard) = ACTIVE_WINEVENT_HOOKS.lock() {
        for raw in hooks_guard.drain(..) {
            unsafe {
                let hook = HWINEVENTHOOK(raw as *mut _);
                let _ = UnhookWinEvent(hook);
            }
        }
    }
}

/// Extract window title string from HWND.
pub fn get_window_title(hwnd: HWND) -> String {
    unsafe {
        let mut buffer = [0u16; 512];
        let length = GetWindowTextW(hwnd, &mut buffer);
        if length > 0 {
            OsString::from_wide(&buffer[..length as usize])
                .to_string_lossy()
                .trim()
                .to_string()
        } else {
            String::new()
        }
    }
}

/// Extract window class name from HWND.
pub fn get_window_class(hwnd: HWND) -> String {
    unsafe {
        let mut buffer = [0u16; 256];
        let length = GetClassNameW(hwnd, &mut buffer);
        if length > 0 {
            OsString::from_wide(&buffer[..length as usize])
                .to_string_lossy()
                .trim()
                .to_string()
        } else {
            String::new()
        }
    }
}

/// Extract process executable name (e.g. `notepad.exe`) from HWND using AutoCloseHandle.
pub fn get_window_process_name(hwnd: HWND) -> String {
    unsafe {
        let mut pid: u32 = 0;
        let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return String::new();
        }

        if let Ok(raw_handle) = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid)
        {
            let handle = AutoCloseHandle(raw_handle);
            let mut buffer = [0u16; 1024];
            let length = K32GetModuleFileNameExW(Some(handle.0), None, &mut buffer);
            if length > 0 {
                let full_path = OsString::from_wide(&buffer[..length as usize])
                    .to_string_lossy()
                    .to_string();
                if let Some(filename) = Path::new(&full_path).file_name() {
                    return filename.to_string_lossy().to_string();
                }
            }
        }
        String::new()
    }
}

/// Inspect target window bounds in physical screen coordinates.
pub fn get_window_bounds(hwnd: HWND) -> Option<WindowRect> {
    unsafe {
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_ok() {
            let width = (rect.right - rect.left).max(0);
            let height = (rect.bottom - rect.top).max(0);
            Some(WindowRect {
                x: rect.left,
                y: rect.top,
                width,
                height,
            })
        } else {
            None
        }
    }
}

/// Determine DPI and display scale factor for a given HWND.
pub fn get_window_dpi(hwnd: HWND) -> (u32, f64) {
    unsafe {
        let dpi = GetDpiForWindow(hwnd);
        let dpi = if dpi > 0 { dpi } else { 96 };
        let scale_factor = dpi as f64 / 96.0;
        (dpi, scale_factor)
    }
}

/// Get detailed TargetWindowInfo for an HWND if valid.
pub fn inspect_target_window(hwnd: HWND) -> Option<TargetWindowInfo> {
    unsafe {
        if !IsWindow(Some(hwnd)).as_bool() || !IsWindowVisible(hwnd).as_bool() {
            return None;
        }

        let title = get_window_title(hwnd);
        let class_name = get_window_class(hwnd);
        let process_name = get_window_process_name(hwnd);

        if class_name == "Progman"
            || class_name == "WorkerW"
            || class_name == "Shell_TrayWnd"
            || class_name == "Windows.UI.Core.CoreWindow"
            || process_name.eq_ignore_ascii_case("skribly.exe")
            || process_name.eq_ignore_ascii_case("skribli.exe")
        {
            return None;
        }

        let bounds = get_window_bounds(hwnd)?;
        if bounds.width < 100 || bounds.height < 100 {
            return None;
        }

        let is_minimized = IsIconic(hwnd).as_bool();
        let foreground_hwnd = GetForegroundWindow();
        let is_focused = foreground_hwnd == hwnd;
        let (dpi, scale_factor) = get_window_dpi(hwnd);

        Some(TargetWindowInfo {
            hwnd_val: hwnd.0 as isize,
            title,
            process_name,
            class_name,
            bounds,
            is_minimized,
            is_focused,
            dpi,
            scale_factor,
        })
    }
}

/// Retrieve current foreground window details.
pub fn get_foreground_target_window() -> Option<TargetWindowInfo> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 != std::ptr::null_mut() {
            inspect_target_window(hwnd)
        } else {
            None
        }
    }
}

/// Enumerate top-level application windows suitable for Skrib binding.
pub fn list_candidate_target_windows() -> Vec<TargetWindowInfo> {
    ENUMERATION_COUNT.fetch_add(1, Ordering::Relaxed);
    let mut candidates: Vec<TargetWindowInfo> = Vec::new();
    let pointer = &mut candidates as *mut Vec<TargetWindowInfo> as isize;

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let candidates = unsafe { &mut *(lparam.0 as *mut Vec<TargetWindowInfo>) };
        if let Some(target) = inspect_target_window(hwnd) {
            if !candidates
                .iter()
                .any(|candidate| candidate.hwnd_val == target.hwnd_val)
            {
                candidates.push(target);
            }
        }
        BOOL(1)
    }

    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(pointer));
    }
    candidates
}

pub struct WindowsWindowService;

impl super::PlatformWindowService for WindowsWindowService {
    fn start(&self) -> Result<(), String> {
        set_dpi_awareness();
        Ok(())
    }

    fn stop(&self) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_autoclose_handle_invalid() {
        let handle = AutoCloseHandle(HANDLE(std::ptr::null_mut()));
        assert!(handle.0 .0.is_null());
    }

    #[test]
    fn test_hwnd_reconstruction() {
        assert_eq!(reconstruct_hwnd(0), None);
    }

    #[test]
    fn thread_hotkey_filter_accepts_only_the_registered_command() {
        let mut expected = MSG::default();
        expected.message = WM_HOTKEY;
        expected.wParam = WPARAM(0x534B);
        assert!(is_expected_hotkey_message(&expected, 0x534B));

        let mut wrong_id = expected;
        wrong_id.wParam = WPARAM(0x534C);
        assert!(!is_expected_hotkey_message(&wrong_id, 0x534B));

        let mut wrong_message = expected;
        wrong_message.message = windows::Win32::UI::WindowsAndMessaging::WM_NCHITTEST;
        assert!(!is_expected_hotkey_message(&wrong_message, 0x534B));
    }

    #[test]
    fn test_dpi_coordinate_conversion() {
        assert_eq!(physical_to_logical(200, 300, 1.0), (200, 300));
        assert_eq!(logical_to_physical(200, 300, 1.0), (200, 300));
        assert_eq!(physical_to_logical(250, 375, 1.25), (200, 300));
        assert_eq!(logical_to_physical(200, 300, 1.25), (250, 375));
        assert_eq!(physical_to_logical(300, 450, 1.5), (200, 300));
        assert_eq!(logical_to_physical(200, 300, 1.5), (300, 450));
        assert_eq!(physical_to_logical(-1920, -1080, 1.0), (-1920, -1080));
    }

    #[test]
    fn test_hit_test_rect_math_all_scales_and_origins() {
        let toolbar_rect = HitTestRect {
            x: 100,
            y: 20,
            width: 300,
            height: 40,
        };
        let note_rect = HitTestRect {
            x: 500,
            y: 200,
            width: 250,
            height: 180,
        };
        let rects = vec![toolbar_rect, note_rect];

        assert!(check_hit_test_rect_math(0, 0, 1.0, &rects, 150, 30));
        assert!(check_hit_test_rect_math(0, 0, 1.0, &rects, 600, 250));
        assert!(!check_hit_test_rect_math(0, 0, 1.0, &rects, 10, 10));
        assert!(check_hit_test_rect_math(0, 0, 1.25, &rects, 200, 40));
        assert!(check_hit_test_rect_math(0, 0, 1.25, &rects, 700, 300));
        assert!(!check_hit_test_rect_math(0, 0, 1.25, &rects, 100, 20));
        assert!(check_hit_test_rect_math(0, 0, 1.5, &rects, 300, 50));
        assert!(check_hit_test_rect_math(-1920, 0, 1.0, &rects, -1800, 30));
        assert!(!check_hit_test_rect_math(-1920, 0, 1.0, &rects, 150, 30));
        assert!(check_hit_test_rect_math(100, 200, 1.0, &rects, 250, 230));
        assert!(!check_hit_test_rect_math(100, 200, 1.0, &rects, 150, 30));
    }
}
