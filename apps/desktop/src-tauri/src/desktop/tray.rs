use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Runtime,
};

const TRAY_ID: &str = "skribly-tray";
const QUIT_ID: &str = "quit";

pub fn install_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    crate::desktop::license_bridge::install_license_bridge(app)?;

    let quit = MenuItem::with_id(app, QUIT_ID, "Quit Skribli", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/icon.png"))
        .tooltip("Skribli — Ctrl+Shift+Space opens the current app note")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == QUIT_ID {
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}
