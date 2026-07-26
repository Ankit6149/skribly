use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, Manager, Runtime,
};

const TRAY_ID: &str = "skribly-tray";
const SHOW_ID: &str = "show";
const HIDE_ID: &str = "hide";
const QUIT_ID: &str = "quit";

fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_main_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn install_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    crate::desktop::license_bridge::install_license_bridge(app)?;

    let show = MenuItem::with_id(app, SHOW_ID, "Show current notes", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, HIDE_ID, "Hide Skribli", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "Quit Skribli", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/icon.png"))
        .tooltip("Skribli — Ctrl+Shift+Space creates an attached note")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            SHOW_ID => show_main_window(app),
            HIDE_ID => hide_main_window(app),
            QUIT_ID => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
