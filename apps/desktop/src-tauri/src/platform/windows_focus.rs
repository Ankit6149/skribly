use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    IsIconic, IsWindow, SetForegroundWindow, ShowWindow, SW_RESTORE,
};

pub fn focus_external_window(hwnd_val: isize) -> Result<(), String> {
    let hwnd = HWND(hwnd_val as *mut std::ffi::c_void);
    unsafe {
        if hwnd.0.is_null() || !IsWindow(Some(hwnd)).as_bool() {
            return Err("The original application window is no longer available.".into());
        }

        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }

        if !SetForegroundWindow(hwnd).as_bool() {
            return Err(
                "Windows did not allow Skribly to focus that app. Click the app once, then retry."
                    .into(),
            );
        }
    }

    Ok(())
}
