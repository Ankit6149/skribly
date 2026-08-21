use crate::desktop::library::LIBRARY_WINDOW_LABEL;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Manager, Runtime,
};

const TRAY_ID: &str = "skribly-tray";
const OPEN_SKRIBLI_ID: &str = "open-skribli";
const ALL_SKRIBS_ID: &str = "all-skribs";
const QUICK_GUIDE_ID: &str = "quick-guide";
const QUIT_ID: &str = "quit";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrayAction {
    OpenSkribli,
    OpenAllSkribs,
    ShowQuickGuide,
    Quit,
    Ignore,
}

fn classify_tray_action(id: &str) -> TrayAction {
    match id {
        OPEN_SKRIBLI_ID => TrayAction::OpenSkribli,
        ALL_SKRIBS_ID => TrayAction::OpenAllSkribs,
        QUICK_GUIDE_ID => TrayAction::ShowQuickGuide,
        QUIT_ID => TrayAction::Quit,
        _ => TrayAction::Ignore,
    }
}

fn tray_action_requires_overlay_hide(action: TrayAction) -> bool {
    action == TrayAction::Quit
}

pub fn install_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    crate::desktop::license_bridge::install_license_bridge(app)?;
    crate::desktop::library::install_library_bridge(app)?;
    crate::desktop::library_import::install_library_import_bridge(app)?;

    let open_skribli = MenuItem::with_id(app, OPEN_SKRIBLI_ID, "Open Skribli", true, None::<&str>)?;
    let all_skribs = MenuItem::with_id(app, ALL_SKRIBS_ID, "All Skribs", true, None::<&str>)?;
    let quick_guide = MenuItem::with_id(app, QUICK_GUIDE_ID, "Quick guide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "Quit Skribli", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_skribli, &all_skribs, &quick_guide, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/icon.png"))
        .tooltip("Skribli — contextual annotations for Windows")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let action = classify_tray_action(event.id.as_ref());
            if tray_action_requires_overlay_hide(action) {
                // Hide the transparent always-on-top HWND before beginning shutdown so neither a
                // dot nor its native region can linger during teardown.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            match action {
                TrayAction::OpenSkribli => {
                    if let Some(window) = app.get_webview_window("home") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                TrayAction::OpenAllSkribs => {
                    if let Some(window) = app.get_webview_window(LIBRARY_WINDOW_LABEL) {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                TrayAction::ShowQuickGuide => {
                    let _ = app.emit("skribly://show-onboarding", ());
                    if let Some(window) = app.get_webview_window("home") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                TrayAction::Quit => app.exit(0),
                TrayAction::Ignore => {}
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_actions_are_classified_without_side_effects() {
        assert_eq!(
            classify_tray_action(OPEN_SKRIBLI_ID),
            TrayAction::OpenSkribli
        );
        assert_eq!(
            classify_tray_action(ALL_SKRIBS_ID),
            TrayAction::OpenAllSkribs
        );
        assert_eq!(
            classify_tray_action(QUICK_GUIDE_ID),
            TrayAction::ShowQuickGuide
        );
        assert_eq!(classify_tray_action(QUIT_ID), TrayAction::Quit);
        assert_eq!(classify_tray_action("unknown"), TrayAction::Ignore);
        assert!(tray_action_requires_overlay_hide(TrayAction::Quit));
        assert!(!tray_action_requires_overlay_hide(TrayAction::OpenSkribli));
    }
}
