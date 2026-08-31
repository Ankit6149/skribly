#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct SupportedApplication {
    executable: &'static str,
    display_name: &'static str,
}

fn supported_application(process_name: &str) -> Option<SupportedApplication> {
    let normalized = process_name.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "chrome" | "chrome.exe" => Some(SupportedApplication {
            executable: "chrome.exe",
            display_name: "Google Chrome",
        }),
        "msedge" | "msedge.exe" => Some(SupportedApplication {
            executable: "msedge.exe",
            display_name: "Microsoft Edge",
        }),
        "firefox" | "firefox.exe" => Some(SupportedApplication {
            executable: "firefox.exe",
            display_name: "Firefox",
        }),
        "explorer" | "explorer.exe" => Some(SupportedApplication {
            executable: "explorer.exe",
            display_name: "File Explorer",
        }),
        "notepad" | "notepad.exe" => Some(SupportedApplication {
            executable: "notepad.exe",
            display_name: "Notepad",
        }),
        "code" | "code.exe" => Some(SupportedApplication {
            executable: "Code.exe",
            display_name: "Visual Studio Code",
        }),
        "winword" | "winword.exe" => Some(SupportedApplication {
            executable: "WINWORD.EXE",
            display_name: "Microsoft Word",
        }),
        "excel" | "excel.exe" => Some(SupportedApplication {
            executable: "EXCEL.EXE",
            display_name: "Microsoft Excel",
        }),
        "powerpnt" | "powerpnt.exe" => Some(SupportedApplication {
            executable: "POWERPNT.EXE",
            display_name: "Microsoft PowerPoint",
        }),
        "outlook" | "outlook.exe" => Some(SupportedApplication {
            executable: "OUTLOOK.EXE",
            display_name: "Microsoft Outlook",
        }),
        "chatgpt" | "chatgpt.exe" => Some(SupportedApplication {
            executable: "ChatGPT.exe",
            display_name: "ChatGPT",
        }),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
pub fn launch(process_name: &str) -> Result<String, String> {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let application = supported_application(process_name).ok_or_else(|| {
        "This application cannot be started automatically yet. Open it once, then choose Open there again."
            .to_string()
    })?;

    Command::new("cmd.exe")
        .args(["/C", "start", "", application.executable])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| format!("Skribli could not start {}: {error}", application.display_name))?;
    Ok(application.display_name.to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn launch(process_name: &str) -> Result<String, String> {
    let _ = process_name;
    Err("Starting the saved application is currently supported only on Windows.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_application_names_are_launchable() {
        assert_eq!(
            supported_application("chrome.exe").map(|application| application.display_name),
            Some("Google Chrome")
        );
        assert_eq!(
            supported_application(" CODE.EXE ").map(|application| application.display_name),
            Some("Visual Studio Code")
        );
        assert_eq!(supported_application("cmd.exe"), None);
        assert_eq!(supported_application("calc.exe & whoami"), None);
    }
}
