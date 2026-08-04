use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Manager, Runtime,
};

const TRAY_ID: &str = "skribly-tray";
const QUICK_GUIDE_ID: &str = "quick-guide";
const QUIT_ID: &str = "quit";

pub fn install_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    crate::desktop::license_bridge::install_license_bridge(app)?;

    let quick_guide = MenuItem::with_id(app, QUICK_GUIDE_ID, "Quick guide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "Quit Skribli", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quick_guide, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/icon.png"))
        .tooltip("Skribli — Ctrl+Shift+Space opens the current app note")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            QUICK_GUIDE_ID => {
                let _ = app.emit("skribly://show-onboarding", ());
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.center();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            QUIT_ID => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
