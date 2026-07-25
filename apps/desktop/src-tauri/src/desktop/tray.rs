use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Manager, Runtime,
};

const TRAY_ID: &str = "skribly-tray";
const SHOW_ID: &str = "show";
const NEW_ID: &str = "new-skrib";
const NOTES_ID: &str = "saved-skribs";
const QUIT_ID: &str = "quit";

fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn install_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    crate::desktop::license_bridge::install_license_bridge(app)?;

    let show = MenuItem::with_id(app, SHOW_ID, "Show Skribly", true, None::<&str>)?;
    let new_skrib = MenuItem::with_id(
        app,
        NEW_ID,
        "New Skrib   Ctrl+Shift+Space",
        true,
        None::<&str>,
    )?;
    let saved = MenuItem::with_id(app, NOTES_ID, "Saved Skribs", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "Quit Skribly", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &new_skrib, &saved, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/icon.png"))
        .tooltip("Skribly — contextual notes")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            SHOW_ID => show_main_window(app),
            NEW_ID => {
                show_main_window(app);
                let _ = app.emit("skribly://tray-action", "new");
            }
            NOTES_ID => {
                show_main_window(app);
                let _ = app.emit("skribly://tray-action", "saved");
            }
            QUIT_ID => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
