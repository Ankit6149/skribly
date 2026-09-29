//! Small, local app logos for the expanded Skrib panel.
//! The source is the actual running application's window icon, never a guessed brand asset.

use std::ffi::c_void;
use std::mem::size_of;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject, BITMAPINFO,
    BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
};
use windows::Win32::UI::WindowsAndMessaging::{
    DrawIconEx, GetClassLongPtrW, SendMessageTimeoutW, DI_NORMAL, GCLP_HICON, GCLP_HICONSM, HICON,
    ICON_BIG, ICON_SMALL2, SMTO_ABORTIFHUNG, WM_GETICON,
};

use super::windows::list_candidate_target_windows;

const ICON_SIZE: usize = 32;

pub fn app_icon_data_url(process_name: &str) -> Option<String> {
    let process_name = process_name.trim();
    if process_name.is_empty() || process_name.len() > 128 {
        return None;
    }
    let target = list_candidate_target_windows()
        .into_iter()
        .find(|target| target.process_name.eq_ignore_ascii_case(process_name))?;
    let hwnd = HWND(target.hwnd_val as *mut _);
    let icon = window_icon(hwnd)?;
    let rgba = draw_icon_rgba(icon)?;

    let mut encoded = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut encoded, ICON_SIZE as u32, ICON_SIZE as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(&rgba).ok()?;
    }
    Some(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(encoded)
    ))
}

fn window_icon(hwnd: HWND) -> Option<HICON> {
    unsafe {
        for kind in [ICON_BIG, ICON_SMALL2] {
            let mut result = 0usize;
            let _ = SendMessageTimeoutW(
                hwnd,
                WM_GETICON,
                WPARAM(kind as usize),
                LPARAM(0),
                SMTO_ABORTIFHUNG,
                100,
                Some(&mut result),
            );
            if result != 0 {
                return Some(HICON(result as *mut _));
            }
        }
        for index in [GCLP_HICON, GCLP_HICONSM] {
            let icon = GetClassLongPtrW(hwnd, index);
            if icon != 0 {
                return Some(HICON(icon as *mut _));
            }
        }
    }
    None
}

fn draw_icon_rgba(icon: HICON) -> Option<Vec<u8>> {
    let mut info = BITMAPINFO::default();
    info.bmiHeader = BITMAPINFOHEADER {
        biSize: size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: ICON_SIZE as i32,
        biHeight: -(ICON_SIZE as i32),
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB.0,
        ..Default::default()
    };
    unsafe {
        let mut bits: *mut c_void = std::ptr::null_mut();
        let bitmap = CreateDIBSection(None, &info, DIB_RGB_COLORS, &mut bits, None, 0).ok()?;
        let dc = CreateCompatibleDC(None);
        if dc.0.is_null() {
            let _ = DeleteObject(bitmap.into());
            return None;
        }
        let previous = SelectObject(dc, HGDIOBJ(bitmap.0));
        if previous.0.is_null() || bits.is_null() {
            let _ = DeleteDC(dc);
            let _ = DeleteObject(bitmap.into());
            return None;
        }
        let drawn = DrawIconEx(
            dc,
            0,
            0,
            icon,
            ICON_SIZE as i32,
            ICON_SIZE as i32,
            0,
            None,
            DI_NORMAL,
        )
        .is_ok();
        let mut rgba = Vec::with_capacity(ICON_SIZE * ICON_SIZE * 4);
        if drawn {
            let bgra = std::slice::from_raw_parts(bits as *const u8, ICON_SIZE * ICON_SIZE * 4);
            for pixel in bgra.chunks_exact(4) {
                let alpha = pixel[3];
                let straight = |premultiplied: u8| {
                    if alpha > 0 && alpha < 255 {
                        ((premultiplied as u16 * 255) / alpha as u16).min(255) as u8
                    } else {
                        premultiplied
                    }
                };
                rgba.extend_from_slice(&[
                    straight(pixel[2]),
                    straight(pixel[1]),
                    straight(pixel[0]),
                    alpha,
                ]);
            }
        }
        let _ = SelectObject(dc, previous);
        let _ = DeleteDC(dc);
        let _ = DeleteObject(bitmap.into());
        if !drawn || rgba.chunks_exact(4).all(|pixel| pixel[3] == 0) {
            return None;
        }
        Some(rgba)
    }
}
