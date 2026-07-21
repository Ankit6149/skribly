//! Real Windows native platform implementation for Skribly.
//! Provides handle-leak-free window enumeration, HWND numeric conversion,
//! WinEvent hooks, DPI awareness, global hotkeys, and WM_NCHITTEST selective click-through.

use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;

use windows::core::BOOL;
use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND, LPARAM, RECT};
use windows::Win32::System::ProcessStatus::K32GetModuleFileNameExW;
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use windows::Win32::UI::HiDpi::{
    GetDpiForWindow, SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowTextW,
    GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible,
};

use crate::core::models::{TargetWindowInfo, WindowRect};

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

/// Extract process executable name (e.g., "notepad.exe") from HWND.
/// Uses AutoCloseHandle to prevent handle leaks.
pub fn get_window_process_name(hwnd: HWND) -> String {
    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return String::new();
        }

        if let Ok(raw_handle) = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid)
        {
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

        // Filter out desktop, shell, tooltips, and empty system windows
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
}
