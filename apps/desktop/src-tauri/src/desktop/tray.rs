use crate::desktop::library::LIBRARY_WINDOW_LABEL;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Manager, Runtime,
};

const TRAY_ID: &str = "skribly-tray";
const ALL_SKRIBS_ID: &str = "all-skribs";
const QUICK_GUIDE_ID: &str = "quick-guide";
const QUIT_ID: &str = "quit";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrayAction {
    OpenAllSkribs,
    ShowQuickGuide,
    Quit,
    Ignore,
}

fn classify_tray_action(id: &str) -> TrayAction {
    match id {
        ALL_SKRIBS_ID => TrayAction::OpenAllSkribs,
        QUICK_GUIDE_ID => TrayAction::ShowQuickGuide,
        QUIT_ID => TrayAction::Quit,
        _ => TrayAction::Ignore,
    }
}

pub fn install_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    crate::desktop::license_bridge::install_license_bridge(app)?;
    crate::desktop::library::install_library_bridge(app)?;

    let all_skribs = MenuItem::with_id(app, ALL_SKRIBS_ID, "All Skribs", true, None::<&str>)?;
    let quick_guide = MenuItem::with_id(app, QUICK_GUIDE_ID, "Quick guide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "Quit Skribli", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&all_skribs, &quick_guide, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/icon.png"))
        .tooltip("Skribli — open a contextual note or browse All Skribs")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match classify_tray_action(event.id.as_ref()) {
            TrayAction::OpenAllSkribs => {
                if let Some(window) = app.get_webview_window(LIBRARY_WINDOW_LABEL) {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            TrayAction::ShowQuickGuide => {
                let _ = app.emit("skribly://show-onboarding", ());
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.center();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            TrayAction::Quit => app.exit(0),
            TrayAction::Ignore => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_actions_are_classified_without_side_effects() {
        assert_eq!(classify_tray_action(ALL_SKRIBS_ID), TrayAction::OpenAllSkribs);
        assert_eq!(classify_tray_action(QUICK_GUIDE_ID), TrayAction::ShowQuickGuide);
        assert_eq!(classify_tray_action(QUIT_ID), TrayAction::Quit);
        assert_eq!(classify_tray_action("unknown"), TrayAction::Ignore);
    }
}
