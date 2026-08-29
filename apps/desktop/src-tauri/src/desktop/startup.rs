use std::ffi::OsString;
use std::path::Path;

pub const BACKGROUND_LAUNCH_ARGUMENT: &str = "--background";

pub fn is_background_launch(args: impl IntoIterator<Item = OsString>) -> bool {
    args.into_iter()
        .any(|argument| argument == BACKGROUND_LAUNCH_ARGUMENT)
}

fn launch_command(executable: &Path) -> String {
    format!(
        "\"{}\" {BACKGROUND_LAUNCH_ARGUMENT}",
        executable.to_string_lossy()
    )
}

#[cfg(target_os = "windows")]
pub fn register_launch_at_login() -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const VALUE_NAME: &str = "Skribli";

    let executable = std::env::current_exe()
        .map_err(|error| format!("Windows could not locate the Skribli executable: {error}"))?;
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let (run_key, _) = current_user
        .create_subkey(RUN_KEY)
        .map_err(|error| format!("Windows could not open the launch-at-login setting: {error}"))?;
    run_key
        .set_value(VALUE_NAME, &launch_command(&executable))
        .map_err(|error| format!("Windows could not enable launch at login for Skribli: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn background_mode_requires_the_exact_private_argument() {
        assert!(is_background_launch([
            OsString::from("skribly.exe"),
            OsString::from(BACKGROUND_LAUNCH_ARGUMENT),
        ]));
        assert!(!is_background_launch([
            OsString::from("skribly.exe"),
            OsString::from("--background-task"),
        ]));
    }

    #[test]
    fn launch_command_quotes_paths_and_starts_without_the_dashboard() {
        let command = launch_command(Path::new(r"C:\Program Files\Skribli\skribly.exe"));
        assert_eq!(
            command,
            r#""C:\Program Files\Skribli\skribly.exe" --background"#
        );
    }
}
