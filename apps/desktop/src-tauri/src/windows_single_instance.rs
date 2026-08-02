//! Windows process exclusivity before the Tauri runtime starts.
//!
//! The primary process keeps a per-session named mutex handle alive for its full lifetime. A
//! second process locates the existing Skribli top-level window, posts the same `WM_HOTKEY`
//! message used by the registered global shortcut, and exits before storage, tray, hooks, or
//! worker threads are initialized.

use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;
use std::thread;
use std::time::Duration;

use windows::core::{w, BOOL, PCWSTR};
use windows::Win32::Foundation::{
    CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE, HWND, LPARAM, WPARAM,
};
use windows::Win32::System::ProcessStatus::K32GetModuleFileNameExW;
use windows::Win32::System::Threading::{
    CreateMutexW, OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, MessageBoxW, PostMessageW, MB_ICONERROR, MB_OK, WM_HOTKEY,
};

pub const GLOBAL_HOTKEY_ID: i32 = 0x534B;
#[allow(dead_code)]
pub const SINGLE_INSTANCE_MUTEX_NAME: &str = "Local\\app.skribly.desktop.single-instance.2026-08";
const SIGNAL_ATTEMPTS: usize = 40;
const SIGNAL_RETRY_DELAY: Duration = Duration::from_millis(50);

#[derive(Debug)]
pub enum SingleInstanceOutcome {
    Primary(SingleInstanceGuard),
    SecondarySignalled,
}

#[derive(Debug)]
pub struct SingleInstanceGuard {
    handle: HANDLE,
}

impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {
        if !self.handle.is_invalid() && !self.handle.0.is_null() {
            unsafe {
                let _ = CloseHandle(self.handle);
            }
        }
    }
}

struct ProcessHandle(HANDLE);

impl Drop for ProcessHandle {
    fn drop(&mut self) {
        if !self.0.is_invalid() && !self.0 .0.is_null() {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }
}

fn is_skribli_process_name(process_name: &str) -> bool {
    process_name.eq_ignore_ascii_case("skribly.exe")
        || process_name.eq_ignore_ascii_case("skribli.exe")
}

fn process_name_for_window(hwnd: HWND) -> String {
    unsafe {
        let mut process_id = 0u32;
        let _ = windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(
            hwnd,
            Some(&mut process_id),
        );
        if process_id == 0 {
            return String::new();
        }

        let Ok(raw_handle) = OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
            false,
            process_id,
        ) else {
            return String::new();
        };
        let handle = ProcessHandle(raw_handle);
        let mut buffer = [0u16; 1024];
        let length = K32GetModuleFileNameExW(Some(handle.0), None, &mut buffer);
        if length == 0 {
            return String::new();
        }

        let full_path = OsString::from_wide(&buffer[..length as usize]);
        Path::new(&full_path)
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default()
    }
}

fn find_existing_skribli_window() -> Option<HWND> {
    let mut found = HWND::default();
    let pointer = &mut found as *mut HWND as isize;

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let found = unsafe { &mut *(lparam.0 as *mut HWND) };
        if is_skribli_process_name(&process_name_for_window(hwnd)) {
            *found = hwnd;
            return BOOL(0);
        }
        BOOL(1)
    }

    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(pointer));
    }

    if found.0.is_null() {
        None
    } else {
        Some(found)
    }
}

fn signal_existing_instance() -> Result<(), String> {
    for _ in 0..SIGNAL_ATTEMPTS {
        if let Some(hwnd) = find_existing_skribli_window() {
            unsafe {
                PostMessageW(
                    Some(hwnd),
                    WM_HOTKEY,
                    WPARAM(GLOBAL_HOTKEY_ID as usize),
                    LPARAM(0),
                )
                .map_err(|error| {
                    format!("Windows found Skribli but could not signal it: {error}")
                })?;
            }
            return Ok(());
        }
        thread::sleep(SIGNAL_RETRY_DELAY);
    }

    Err("Another Skribli process is running, but its window could not be reached. Quit Skribli from the tray and start it again.".into())
}

pub fn acquire_or_signal_existing() -> Result<SingleInstanceOutcome, String> {
    let handle = unsafe {
        CreateMutexW(
            None,
            false,
            w!("Local\\app.skribly.desktop.single-instance.2026-08"),
        )
        .map_err(|error| format!("Windows could not create the Skribli instance guard: {error}"))?
    };
    let already_exists =
        matches!(unsafe { GetLastError() }, Ok(code) if code == ERROR_ALREADY_EXISTS);

    if already_exists {
        let secondary_handle = SingleInstanceGuard { handle };
        let signal_result = signal_existing_instance();
        drop(secondary_handle);
        signal_result?;
        Ok(SingleInstanceOutcome::SecondarySignalled)
    } else {
        Ok(SingleInstanceOutcome::Primary(SingleInstanceGuard {
            handle,
        }))
    }
}

pub fn show_single_instance_error(message: &str) {
    let wide_message: Vec<u16> = message.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let _ = MessageBoxW(
            None,
            PCWSTR(wide_message.as_ptr()),
            w!("Skribli could not start"),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mutex_is_explicitly_scoped_to_the_local_user_session() {
        assert!(SINGLE_INSTANCE_MUTEX_NAME.starts_with("Local\\"));
        assert!(SINGLE_INSTANCE_MUTEX_NAME.len() < 260);
    }

    #[test]
    fn process_name_matching_accepts_current_and_legacy_binary_names_only() {
        assert!(is_skribli_process_name("Skribly.exe"));
        assert!(is_skribli_process_name("skribli.exe"));
        assert!(!is_skribli_process_name("skribly-helper.exe"));
        assert!(!is_skribli_process_name("explorer.exe"));
    }

    #[test]
    fn second_launch_uses_the_same_hotkey_identifier_as_the_runtime() {
        assert_eq!(GLOBAL_HOTKEY_ID, 0x534B);
    }

    #[test]
    fn signal_retry_window_is_bounded() {
        assert_eq!(SIGNAL_ATTEMPTS, 40);
        assert_eq!(SIGNAL_RETRY_DELAY, Duration::from_millis(50));
    }
}
