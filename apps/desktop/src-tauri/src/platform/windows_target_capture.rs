//! Fail-closed foreground target capture for the Windows compact-note workflow.
//!
//! A capture is intentionally short-lived. The foreground HWND is inspected once when the
//! shortcut arrives, paired with its owning process identifier, then revalidated immediately
//! before placement or note access. This prevents a missing foreground window, stale active
//! target, destroyed HWND, or recycled HWND from silently opening the wrong note.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible,
};

use crate::core::models::TargetWindowInfo;

use super::windows::{
    get_window_bounds, get_window_class, get_window_process_name, inspect_target_window,
    reconstruct_hwnd,
};

const MAX_CAPTURE_AGE: Duration = Duration::from_secs(2);
const MIN_TARGET_WIDTH: i32 = 100;
const MIN_TARGET_HEIGHT: i32 = 100;
static CAPTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TargetCaptureErrorCode {
    NoForegroundWindow,
    SkribliIsForeground,
    DesktopOrSystemSurface,
    HiddenOrDestroyedWindow,
    MinimizedWindow,
    MissingProcessIdentity,
    InvalidWindowBounds,
    ForegroundChanged,
    TargetExpired,
    ProcessIdentityChanged,
    UnsupportedWindow,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TargetCaptureError {
    pub code: TargetCaptureErrorCode,
    pub message: String,
}

impl TargetCaptureError {
    fn new(code: TargetCaptureErrorCode) -> Self {
        Self {
            code,
            message: user_message(code).to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CapturedTarget {
    pub target: TargetWindowInfo,
    pub process_id: u32,
    pub sequence: u64,
    pub captured_at_unix_ms: u64,
    captured_at: Instant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CandidateSnapshot {
    hwnd_val: isize,
    visible: bool,
    minimized: bool,
    class_name: String,
    process_name: String,
    width: i32,
    height: i32,
}

fn user_message(code: TargetCaptureErrorCode) -> &'static str {
    match code {
        TargetCaptureErrorCode::NoForegroundWindow => {
            "Skribli could not identify the application in front of you. Focus the app, then press Ctrl+Shift+Space again."
        }
        TargetCaptureErrorCode::SkribliIsForeground => {
            "Focus the application that should own the note, then press Ctrl+Shift+Space again."
        }
        TargetCaptureErrorCode::DesktopOrSystemSurface => {
            "Skribli cannot attach a note to the desktop, taskbar, or this Windows system surface. Focus a normal app and try again."
        }
        TargetCaptureErrorCode::HiddenOrDestroyedWindow => {
            "That application window is no longer available. Focus the app again, then retry the shortcut."
        }
        TargetCaptureErrorCode::MinimizedWindow => {
            "Restore the application window before creating its note."
        }
        TargetCaptureErrorCode::MissingProcessIdentity => {
            "Windows did not provide a safe application identity for this window. Skribli did not create or open a note."
        }
        TargetCaptureErrorCode::InvalidWindowBounds => {
            "This window is too small or does not expose usable bounds. Open the application normally and try again."
        }
        TargetCaptureErrorCode::ForegroundChanged => {
            "The active application changed before Skribli could open the note. Focus the intended app and retry."
        }
        TargetCaptureErrorCode::TargetExpired => {
            "The shortcut target took too long to verify. Focus the intended app and press Ctrl+Shift+Space again."
        }
        TargetCaptureErrorCode::ProcessIdentityChanged => {
            "Windows reused or changed the target window before Skribli could open it. No note was created or reopened."
        }
        TargetCaptureErrorCode::UnsupportedWindow => {
            "Skribli cannot safely attach a note to this window yet. Focus another application and try again."
        }
    }
}

fn is_skribli_process(process_name: &str) -> bool {
    let process = process_name.trim().to_ascii_lowercase();
    process == "skribli.exe" || process == "skribly.exe" || process.starts_with("skribli")
}

fn is_system_surface(class_name: &str, process_name: &str) -> bool {
    let process = process_name.trim().to_ascii_lowercase();
    matches!(
        class_name.trim(),
        "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
    ) || matches!(
        process.as_str(),
        "startmenuexperiencehost.exe"
            | "shellexperiencehost.exe"
            | "searchhost.exe"
            | "searchui.exe"
            | "lockapp.exe"
    )
}

fn validate_candidate(snapshot: &CandidateSnapshot) -> Result<(), TargetCaptureError> {
    if snapshot.hwnd_val == 0 || !snapshot.visible {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::HiddenOrDestroyedWindow,
        ));
    }
    if snapshot.minimized {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::MinimizedWindow,
        ));
    }
    if is_skribli_process(&snapshot.process_name) {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::SkribliIsForeground,
        ));
    }
    if is_system_surface(&snapshot.class_name, &snapshot.process_name) {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::DesktopOrSystemSurface,
        ));
    }
    if snapshot.process_name.trim().is_empty() {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::MissingProcessIdentity,
        ));
    }
    if snapshot.width < MIN_TARGET_WIDTH || snapshot.height < MIN_TARGET_HEIGHT {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::InvalidWindowBounds,
        ));
    }
    Ok(())
}

fn process_identity_matches(
    captured_process_id: u32,
    captured_process_name: &str,
    captured_class_name: &str,
    current_process_id: u32,
    current_process_name: &str,
    current_class_name: &str,
) -> bool {
    captured_process_id != 0
        && captured_process_id == current_process_id
        && captured_process_name.eq_ignore_ascii_case(current_process_name)
        && captured_class_name.eq_ignore_ascii_case(current_class_name)
}

fn next_capture_sequence() -> u64 {
    CAPTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed) + 1
}

fn current_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn query_process_id(hwnd: HWND) -> Option<u32> {
    let mut process_id = 0u32;
    let thread_id = unsafe { GetWindowThreadProcessId(hwnd, Some(&mut process_id)) };
    if thread_id == 0 || process_id == 0 {
        None
    } else {
        Some(process_id)
    }
}

fn snapshot_window(hwnd: HWND) -> CandidateSnapshot {
    let bounds = get_window_bounds(hwnd);
    CandidateSnapshot {
        hwnd_val: hwnd.0 as isize,
        visible: unsafe { IsWindowVisible(hwnd).as_bool() },
        minimized: unsafe { IsIconic(hwnd).as_bool() },
        class_name: get_window_class(hwnd),
        process_name: get_window_process_name(hwnd),
        width: bounds.as_ref().map(|rect| rect.width).unwrap_or(0),
        height: bounds.as_ref().map(|rect| rect.height).unwrap_or(0),
    }
}

pub fn capture_foreground_target() -> Result<CapturedTarget, TargetCaptureError> {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::NoForegroundWindow,
        ));
    }

    let snapshot = snapshot_window(hwnd);
    validate_candidate(&snapshot)?;
    let process_id = query_process_id(hwnd)
        .ok_or_else(|| TargetCaptureError::new(TargetCaptureErrorCode::MissingProcessIdentity))?;
    let target = inspect_target_window(hwnd)
        .ok_or_else(|| TargetCaptureError::new(TargetCaptureErrorCode::UnsupportedWindow))?;
    if !target.is_focused {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::ForegroundChanged,
        ));
    }

    Ok(CapturedTarget {
        target,
        process_id,
        sequence: next_capture_sequence(),
        captured_at_unix_ms: current_unix_ms(),
        captured_at: Instant::now(),
    })
}

pub fn revalidate_captured_target(
    capture: &CapturedTarget,
) -> Result<TargetWindowInfo, TargetCaptureError> {
    if capture.captured_at.elapsed() > MAX_CAPTURE_AGE {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::TargetExpired,
        ));
    }

    let hwnd = reconstruct_hwnd(capture.target.hwnd_val)
        .ok_or_else(|| TargetCaptureError::new(TargetCaptureErrorCode::HiddenOrDestroyedWindow))?;
    if !unsafe { IsWindow(Some(hwnd)).as_bool() } {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::HiddenOrDestroyedWindow,
        ));
    }

    let foreground = unsafe { GetForegroundWindow() };
    if foreground != hwnd {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::ForegroundChanged,
        ));
    }

    let snapshot = snapshot_window(hwnd);
    validate_candidate(&snapshot)?;
    let current_process_id = query_process_id(hwnd)
        .ok_or_else(|| TargetCaptureError::new(TargetCaptureErrorCode::MissingProcessIdentity))?;
    if !process_identity_matches(
        capture.process_id,
        &capture.target.process_name,
        &capture.target.class_name,
        current_process_id,
        &snapshot.process_name,
        &snapshot.class_name,
    ) {
        return Err(TargetCaptureError::new(
            TargetCaptureErrorCode::ProcessIdentityChanged,
        ));
    }

    inspect_target_window(hwnd)
        .ok_or_else(|| TargetCaptureError::new(TargetCaptureErrorCode::UnsupportedWindow))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate() -> CandidateSnapshot {
        CandidateSnapshot {
            hwnd_val: 100,
            visible: true,
            minimized: false,
            class_name: "Notepad".into(),
            process_name: "notepad.exe".into(),
            width: 900,
            height: 700,
        }
    }

    #[test]
    fn accepts_a_visible_normal_application_window() {
        assert!(validate_candidate(&candidate()).is_ok());
    }

    #[test]
    fn accepts_a_normal_packaged_application_window() {
        let packaged = CandidateSnapshot {
            class_name: "Windows.UI.Core.CoreWindow".into(),
            process_name: "calculatorapp.exe".into(),
            ..candidate()
        };
        assert!(validate_candidate(&packaged).is_ok());
    }

    #[test]
    fn capture_metadata_is_monotonic_and_timestamped() {
        let first = next_capture_sequence();
        let second = next_capture_sequence();
        assert_eq!(second, first + 1);
        assert!(current_unix_ms() > 0);
    }

    #[test]
    fn rejects_self_shell_hidden_minimized_identity_and_bounds_failures() {
        let cases = [
            (
                CandidateSnapshot {
                    process_name: "Skribli.exe".into(),
                    ..candidate()
                },
                TargetCaptureErrorCode::SkribliIsForeground,
            ),
            (
                CandidateSnapshot {
                    class_name: "Shell_TrayWnd".into(),
                    ..candidate()
                },
                TargetCaptureErrorCode::DesktopOrSystemSurface,
            ),
            (
                CandidateSnapshot {
                    class_name: "Windows.UI.Core.CoreWindow".into(),
                    process_name: "StartMenuExperienceHost.exe".into(),
                    ..candidate()
                },
                TargetCaptureErrorCode::DesktopOrSystemSurface,
            ),
            (
                CandidateSnapshot {
                    visible: false,
                    ..candidate()
                },
                TargetCaptureErrorCode::HiddenOrDestroyedWindow,
            ),
            (
                CandidateSnapshot {
                    minimized: true,
                    ..candidate()
                },
                TargetCaptureErrorCode::MinimizedWindow,
            ),
            (
                CandidateSnapshot {
                    process_name: String::new(),
                    ..candidate()
                },
                TargetCaptureErrorCode::MissingProcessIdentity,
            ),
            (
                CandidateSnapshot {
                    width: 80,
                    ..candidate()
                },
                TargetCaptureErrorCode::InvalidWindowBounds,
            ),
        ];

        for (snapshot, expected) in cases {
            assert_eq!(
                validate_candidate(&snapshot)
                    .expect_err("candidate must fail")
                    .code,
                expected
            );
        }
    }

    #[test]
    fn process_identity_revalidation_detects_recycled_or_changed_windows() {
        assert!(process_identity_matches(
            42,
            "notepad.exe",
            "Notepad",
            42,
            "NOTEPAD.EXE",
            "notepad"
        ));
        assert!(!process_identity_matches(
            42,
            "notepad.exe",
            "Notepad",
            84,
            "notepad.exe",
            "Notepad"
        ));
        assert!(!process_identity_matches(
            42,
            "notepad.exe",
            "Notepad",
            42,
            "explorer.exe",
            "CabinetWClass"
        ));
    }

    #[test]
    fn all_failures_have_privacy_safe_actionable_messages() {
        let codes = [
            TargetCaptureErrorCode::NoForegroundWindow,
            TargetCaptureErrorCode::SkribliIsForeground,
            TargetCaptureErrorCode::DesktopOrSystemSurface,
            TargetCaptureErrorCode::HiddenOrDestroyedWindow,
            TargetCaptureErrorCode::MinimizedWindow,
            TargetCaptureErrorCode::MissingProcessIdentity,
            TargetCaptureErrorCode::InvalidWindowBounds,
            TargetCaptureErrorCode::ForegroundChanged,
            TargetCaptureErrorCode::TargetExpired,
            TargetCaptureErrorCode::ProcessIdentityChanged,
            TargetCaptureErrorCode::UnsupportedWindow,
        ];

        for code in codes {
            let message = TargetCaptureError::new(code).message;
            assert!(message.len() >= 24);
            assert!(!message.contains(".exe:"));
            assert!(!message.contains('\\'));
        }
    }
}
