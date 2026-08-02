//! OS-specific window observation and accessibility adapters.

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "windows")]
pub mod windows_events;

#[cfg(target_os = "windows")]
pub mod windows_focus;

#[cfg(target_os = "windows")]
pub mod windows_placement;

#[cfg(target_os = "macos")]
pub mod macos;

pub trait PlatformWindowService {
    fn start(&self) -> Result<(), String>;
    fn stop(&self) -> Result<(), String>;
}
