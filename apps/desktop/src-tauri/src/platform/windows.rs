//! Windows implementation spike.
//!
//! Planned APIs: SetWinEventHook, GetForegroundWindow, monitor/DPI APIs,
//! Windows UI Automation, and native hit-testing for click-through overlays.

use super::PlatformWindowService;

pub struct WindowsWindowService;

impl PlatformWindowService for WindowsWindowService {
    fn start(&self) -> Result<(), String> {
        Err("Windows overlay spike not implemented".into())
    }

    fn stop(&self) -> Result<(), String> {
        Ok(())
    }
}
