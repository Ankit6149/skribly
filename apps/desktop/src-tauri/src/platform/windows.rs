//! Real Windows native platform implementation for Skribly.
//! Provides handle-leak-free window enumeration, HWND numeric conversion,
//! RegisterHotKey global shortcuts, WM_NCHITTEST native WndProc subclassing,
//! WinEvent hooks, DPI awareness, and coordinate conversion helpers.

use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::sync::mpsc::Sender;

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
    CallWindowProcW, EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowLongPtrW,
    GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible,
    SetWindowLongPtrW, GWLP_WNDPROC, HTCLIENT, HTTRANSPARENT, WM_NCHITTEST, WNDPROC,
};

use crate::core::coordinator::Coordinator;
use crate::core::models::{TargetWindowInfo, WindowRect};

pub const WINEVENT_OUTOFCONTEXT: u32 = 0x0000;
pub const WINEVENT_SKIPOWNPROCESS: u32 = 0x0002;
pub const EVENT_SYSTEM_FOREGROUND: u32 = 0x0003;
pub const EVENT_SYSTEM_MINIMIZESTART: u32 = 0x0016;
pub const EVENT_SYSTEM_MINIMIZEEND: u32 = 0x0017;
pub const EVENT_OBJECT_DESTROY: u32 = 0x8001;
pub const EVENT_OBJECT_LOCATIONCHANGE: u32 = 0x800B;

static ORIGINAL_WNDPROC: AtomicIsize = AtomicIsize::new(0);
static ACTIVE_WINEVENT_HOOK: AtomicIsize = AtomicIsize::new(0);
static GLOBAL_COORDINATOR: std::sync::OnceLock<Coordinator> = std::sync::OnceLock::new();

#[derive(Debug, Clone)]
pub struct WinEventNotice {
    pub event_type: u32,
    pub hwnd_val: isize,
}

static EVENT_SENDER: std::sync::OnceLock<Sender<WinEventNotice>> = std::sync::OnceLock::new();

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

/// Convert Physical screen coordinates to Logical DIP coordinates.
pub fn physical_to_logical(px: i32, py: i32, scale_factor: f64) -> (i32, i32) {
    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };
    (
        (px as f64 / scale).round() as i32,
        (py as f64 / scale).round() as i32,
    )
}

/// Convert Logical DIP coordinates to Physical screen coordinates.
pub fn logical_to_physical(lx: i32, ly: i32, scale_factor: f64) -> (i32, i32) {
    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };
    (
        (lx as f64 * scale).round() as i32,
        (ly as f64 * scale).round() as i32,
    )
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

/// Register Win32 global hotkey for Ctrl + Shift + Space.
pub fn register_global_hotkey(hwnd: HWND, hotkey_id: i32) -> Result<(), String> {
    unsafe {
        RegisterHotKey(
            Some(hwnd),
            hotkey_id,
            MOD_CONTROL | MOD_SHIFT,
            VK_SPACE.0 as u32,
        )
        .map_err(|e| format!("Failed to register Ctrl+Shift+Space global hotkey: {}", e))
    }
}

/// Unregister Win32 global hotkey.
pub fn unregister_global_hotkey(hwnd: HWND, hotkey_id: i32) {
    unsafe {
        let _ = UnregisterHotKey(Some(hwnd), hotkey_id);
    }
}

/// Custom WndProc subclass function intercepting WM_NCHITTEST for selective click-through.
unsafe extern "system" fn overlay_subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_NCHITTEST {
        let px = (lparam.0 as i32 & 0xFFFF) as i16 as i32;
        let py = ((lparam.0 as i32 >> 16) & 0xFFFF) as i16 as i32;

        if let Some(coordinator) = GLOBAL_COORDINATOR.get() {
            if coordinator.is_point_interactive(px, py) {
                return LRESULT(HTCLIENT as isize);
            } else {
                return LRESULT(HTTRANSPARENT as isize);
            }
        }
    }

    let orig = ORIGINAL_WNDPROC.load(Ordering::Relaxed);
    if orig != 0 {
        let orig_fn: WNDPROC = std::mem::transmute(orig);
        CallWindowProcW(orig_fn, hwnd, msg, wparam, lparam)
    } else {
        LRESULT(0)
    }
}

/// Install native WM_NCHITTEST subclassing on overlay window HWND.
pub fn install_overlay_subclass(hwnd: HWND, coordinator: Coordinator) {
    let _ = GLOBAL_COORDINATOR.set(coordinator);
    unsafe {
        let old_proc = GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
        if old_proc != 0 && old_proc != (overlay_subclass_proc as *const () as isize) {
            ORIGINAL_WNDPROC.store(old_proc, Ordering::Relaxed);
            SetWindowLongPtrW(hwnd, GWLP_WNDPROC, overlay_subclass_proc as *const () as isize);
        }
    }
}

/// Restore original WndProc on shutdown.
pub fn uninstall_overlay_subclass(hwnd: HWND) {
    let orig = ORIGINAL_WNDPROC.swap(0, Ordering::Relaxed);
    if orig != 0 {
        unsafe {
            SetWindowLongPtrW(hwnd, GWLP_WNDPROC, orig);
        }
    }
}

/// WinEvent callback for Win32 event hooks. Passes lightweight notifications over channel.
unsafe extern "system" fn win_event_proc(
    _h_win_event_hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _id_event_thread: u32,
    _dwms_event_time: u32,
) {
    if hwnd.0 != std::ptr::null_mut() {
        if let Some(sender) = EVENT_SENDER.get() {
            let notice = WinEventNotice {
                event_type: event,
                hwnd_val: hwnd.0 as isize,
            };
            let _ = sender.send(notice);
        }
    }
}

/// Install WinEvent hooks for location change, minimize, restore, destroy, and foreground events.
pub fn install_winevent_hooks(sender: Sender<WinEventNotice>) -> bool {
    let _ = EVENT_SENDER.set(sender);
    unsafe {
        let hook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_OBJECT_LOCATIONCHANGE,
            None,
            Some(win_event_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
        if hook.0 != std::ptr::null_mut() {
            ACTIVE_WINEVENT_HOOK.store(hook.0 as isize, Ordering::Relaxed);
            true
        } else {
            false
        }
    }
}

/// Unhook WinEvent hooks on application exit.
pub fn uninstall_winevent_hooks() {
    let raw = ACTIVE_WINEVENT_HOOK.swap(0, Ordering::Relaxed);
    if raw != 0 {
        unsafe {
            let hook = HWINEVENTHOOK(raw as *mut _);
            let _ = UnhookWinEvent(hook);
        }
    }
}

/// Extract window title string from HWND.
pub fn get_window_title(hwnd: HWND) -> String {
    unsafe {
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buf);
        if len > 0 {
            OsString::from_wide(&buf[..len as usize])
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
        let mut buf = [0u16; 256];
        let len = GetClassNameW(hwnd, &mut buf);
        if len > 0 {
            OsString::from_wide(&buf[..len as usize])
                .to_string_lossy()
                .trim()
                .to_string()
        } else {
            String::new()
        }
    }
}

/// Extract process executable name (e.g., "notepad.exe") from HWND using AutoCloseHandle.
pub fn get_window_process_name(hwnd: HWND) -> String {
    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return String::new();
        }

        if let Ok(raw_handle) = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid) {
            let handle = AutoCloseHandle(raw_handle);
            let mut buf = [0u16; 1024];
            let len = K32GetModuleFileNameExW(Some(handle.0), None, &mut buf);
            if len > 0 {
                let full_path = OsString::from_wide(&buf[..len as usize])
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

/// Inspect target window bounds in screen coordinates.
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
        {
            return None;
        }

        let bounds = get_window_bounds(hwnd)?;
        if bounds.width < 100 || bounds.height < 100 {
            return None;
        }

        let is_minimized = IsIconic(hwnd).as_bool();
        let fg_hwnd = GetForegroundWindow();
        let is_focused = fg_hwnd == hwnd;
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
    let mut candidates: Vec<TargetWindowInfo> = Vec::new();
    let ptr = &mut candidates as *mut Vec<TargetWindowInfo> as isize;

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let candidates = unsafe { &mut *(lparam.0 as *mut Vec<TargetWindowInfo>) };
        if let Some(target) = inspect_target_window(hwnd) {
            if !candidates.iter().any(|c| c.hwnd_val == target.hwnd_val) {
                candidates.push(target);
            }
        }
        BOOL(1)
    }

    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(ptr));
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
    fn test_dpi_coordinate_conversion() {
        // 100% scale
        assert_eq!(physical_to_logical(200, 300, 1.0), (200, 300));
        assert_eq!(logical_to_physical(200, 300, 1.0), (200, 300));

        // 125% scale
        assert_eq!(physical_to_logical(250, 375, 1.25), (200, 300));
        assert_eq!(logical_to_physical(200, 300, 1.25), (250, 375));

        // 150% scale
        assert_eq!(physical_to_logical(300, 450, 1.5), (200, 300));
        assert_eq!(logical_to_physical(200, 300, 1.5), (300, 450));

        // Negative multi-monitor coordinates
        assert_eq!(physical_to_logical(-1920, -1080, 1.0), (-1920, -1080));
    }
}
