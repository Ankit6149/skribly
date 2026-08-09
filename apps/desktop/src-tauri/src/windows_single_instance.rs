//! Windows process exclusivity before the Tauri runtime starts.
//!
//! The primary process keeps a per-session named mutex handle alive for its full lifetime. A
//! second process locates the visible Skribli home window, restores it, and exits before storage,
//! tray, hooks, or worker threads are initialized.

use std::thread;
use std::time::Duration;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE};
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, MessageBoxW, SetForegroundWindow, ShowWindow, MB_ICONERROR, MB_OK, SW_RESTORE,
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

fn signal_existing_instance() -> Result<(), String> {
    for _ in 0..SIGNAL_ATTEMPTS {
        let home_window = unsafe { FindWindowW(None, w!("Skribli")) }.ok();
        if let Some(hwnd) = home_window {
            unsafe {
                let _ = ShowWindow(hwnd, SW_RESTORE);
                if !SetForegroundWindow(hwnd).as_bool() {
                    return Err(
                        "Windows found Skribli but did not allow its Home window to come forward. Select Skribli from the taskbar and try again."
                            .to_string(),
                    );
                }
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
    let already_exists = unsafe { GetLastError() == ERROR_ALREADY_EXISTS };

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
    fn global_hotkey_identifier_remains_stable_for_the_primary_runtime() {
        assert_eq!(GLOBAL_HOTKEY_ID, 0x534B);
    }

    #[test]
    fn signal_retry_window_is_bounded() {
        assert_eq!(SIGNAL_ATTEMPTS, 40);
        assert_eq!(SIGNAL_RETRY_DELAY, Duration::from_millis(50));
    }
}
