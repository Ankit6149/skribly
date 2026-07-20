//! OS-specific window observation and accessibility adapters.

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;

pub trait PlatformWindowService {
    fn start(&self) -> Result<(), String>;
    fn stop(&self) -> Result<(), String>;
}
