//! macOS implementation spike.
//!
//! Planned APIs: NSWorkspace, NSWindow/NSPanel, Core Graphics window data,
//! and AXUIElement accessibility APIs. Request Accessibility permission only;
//! v1 must not require Screen Recording permission.

use super::PlatformWindowService;

pub struct MacOsWindowService;

impl PlatformWindowService for MacOsWindowService {
    fn start(&self) -> Result<(), String> {
        Err("macOS overlay spike not implemented".into())
    }

    fn stop(&self) -> Result<(), String> {
        Ok(())
    }
}
