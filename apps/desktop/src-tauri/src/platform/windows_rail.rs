//! Keep the Acrylic backdrop, content and hit region inside one native reveal.
use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{CreateRectRgn, DeleteObject, SetWindowRgn};
use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};

pub fn set_geometry(
    window: &WebviewWindow,
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> Result<(), String> {
    let raw = window.hwnd().map_err(|e| e.to_string())?;
    // One WM_WINDOWPOS transaction: never show a full-width HWND at the widget's old x/y.
    unsafe {
        SetWindowPos(
            HWND(raw.0 as *mut _),
            None,
            position.x,
            position.y,
            size.width as i32,
            size.height as i32,
            SWP_NOACTIVATE | SWP_NOZORDER,
        )
    }
    .map_err(|e| format!("Skribli could not place the panel: {e}"))
}

pub fn reveal_bounds(
    width: i32,
    height: i32,
    visible: i32,
    left_dock: bool,
) -> (i32, i32, i32, i32) {
    let visible = visible.clamp(0, width.max(0));
    if left_dock {
        (0, 0, visible, height)
    } else {
        (width - visible, 0, width, height)
    }
}

pub fn set_reveal(
    window: &WebviewWindow,
    visible: Option<u32>,
    left_dock: bool,
) -> Result<(), String> {
    let raw = window.hwnd().map_err(|e| e.to_string())?;
    let hwnd = HWND(raw.0 as *mut _);
    let Some(visible) = visible else {
        if unsafe { SetWindowRgn(hwnd, None, true) } == 0 {
            return Err("Windows could not restore the panel region.".into());
        }
        return Ok(());
    };
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let (left, top, right, bottom) = reveal_bounds(
        size.width as i32,
        size.height as i32,
        visible as i32,
        left_dock,
    );
    let region = unsafe { CreateRectRgn(left, top, right, bottom) };
    if region.0.is_null() {
        return Err("Windows could not create the panel reveal region.".into());
    }
    if unsafe { SetWindowRgn(hwnd, Some(region), true) } == 0 {
        // Windows owns the region on success; on failure it is still ours.
        let _ = unsafe { DeleteObject(region.into()) };
        return Err("Windows could not apply the panel reveal region.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::Graphics::Gdi::PtInRegion;

    #[test]
    fn native_reveal_clips_backdrop_and_hits_to_the_correct_edge_at_every_scale() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let width = (388.0 * scale) as i32;
            let height = (800.0 * scale) as i32;
            for left_dock in [true, false] {
                for visible in [0, width / 2, width] {
                    let (l, t, r, b) = reveal_bounds(width, height, visible, left_dock);
                    let region = unsafe { CreateRectRgn(l, t, r, b) };
                    assert!(!region.0.is_null());
                    let middle = height / 2;
                    assert_eq!(
                        unsafe {
                            PtInRegion(region, if left_dock { 0 } else { width - 1 }, middle)
                        }
                        .as_bool(),
                        visible > 0
                    );
                    assert_eq!(
                        unsafe {
                            PtInRegion(region, if left_dock { width - 1 } else { 0 }, middle)
                        }
                        .as_bool(),
                        visible == width
                    );
                    assert!(!unsafe { PtInRegion(region, width, middle) }.as_bool());
                    let _ = unsafe { DeleteObject(region.into()) };
                }
            }
        }
    }
}
