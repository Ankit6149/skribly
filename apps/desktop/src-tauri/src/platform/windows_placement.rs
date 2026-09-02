//! Monitor-aware compact-window placement for the Windows desktop build.
//!
//! All dimensions in the product contract are logical units. This module converts them to
//! physical pixels using the captured target window's DPI, selects the target monitor's usable
//! work area, and validates the final native window rectangle before Skribli is shown.

use std::mem::size_of;
use std::thread;
use std::time::Duration;

use tauri::{LogicalSize, PhysicalPosition, PhysicalSize};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    CombineRgn, CreateEllipticRgn, CreateRoundRectRgn, DeleteObject, GetMonitorInfoW,
    MonitorFromWindow, SetWindowRgn, MONITORINFO, MONITOR_DEFAULTTONEAREST, RGN_OR,
};

use crate::core::models::{OverlayMetrics, SkribNote, TargetWindowInfo, WindowRect};

use super::windows::{get_overlay_metrics, get_window_bounds, get_window_dpi, reconstruct_hwnd};

pub const COMPACT_WINDOW_LOGICAL_WIDTH: i32 = 420;
pub const COMPACT_WINDOW_LOGICAL_HEIGHT: i32 = 360;
pub const COLLAPSED_NOTE_LOGICAL_SIZE: i32 = 44;
pub const WORKSPACE_LOGICAL_WIDTH: i32 = 820;
pub const WORKSPACE_LOGICAL_HEIGHT: i32 = 760;
const COMPACT_WINDOW_MIN_LOGICAL_WIDTH: i32 = 320;
const COMPACT_WINDOW_MIN_LOGICAL_HEIGHT: i32 = 260;
const COMPACT_WINDOW_LOGICAL_MARGIN: i32 = 18;
const COMPACT_WINDOW_TARGET_RIGHT_INSET: i32 = 24;
const COMPACT_WINDOW_TARGET_TOP_OFFSET: i32 = 48;
const FINAL_RECT_TOLERANCE_PX: i32 = 8;
const NOTE_SURFACE_LOGICAL_RADIUS: i32 = 18;
const COLLAPSED_NOTE_MAIN_REGION_LOGICAL_DIAMETER: i32 = 40;
const COLLAPSED_NOTE_MAIN_REGION_LOGICAL_TOP: i32 = 4;
const COLLAPSED_NOTE_BADGE_REGION_LOGICAL_DIAMETER: i32 = 18;
const COLLAPSED_NOTE_BADGE_REGION_LOGICAL_LEFT: i32 = 26;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NativeNoteSurface {
    Note,
    Dot,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NativeEllipseRegion {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NativeSurfaceRegion {
    primary: NativeEllipseRegion,
    badge: Option<NativeEllipseRegion>,
    ellipse_width: i32,
    ellipse_height: i32,
    circular: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompactWindowPlacement {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub dpi: u32,
    pub scale_factor: f64,
    pub work_area: WindowRect,
}

fn normalized_dpi(dpi: u32) -> u32 {
    if dpi > 0 {
        dpi
    } else {
        96
    }
}

fn logical_to_physical(logical: i32, scale_factor: f64) -> i32 {
    ((logical as f64) * scale_factor).round().max(1.0) as i32
}

fn calculate_native_surface_region(
    physical_width: i32,
    physical_height: i32,
    scale_factor: f64,
    surface: NativeNoteSurface,
) -> Result<NativeSurfaceRegion, String> {
    if physical_width <= 0 || physical_height <= 0 {
        return Err("Skribli cannot shape an empty native note surface.".into());
    }

    match surface {
        NativeNoteSurface::Dot => {
            // Preserve the full 44x44 transparent HWND for CSS antialiasing and contained shadow,
            // but make only the dot + close-badge silhouette interactive. The main region gives
            // the visible 32px dot a 4px gutter; the badge region gives the visible 12px close
            // control a 3px gutter. Their union avoids both clipping and invisible corner hits.
            let main_diameter =
                logical_to_physical(COLLAPSED_NOTE_MAIN_REGION_LOGICAL_DIAMETER, scale_factor);
            let main_top =
                logical_to_physical(COLLAPSED_NOTE_MAIN_REGION_LOGICAL_TOP, scale_factor);
            let badge_diameter =
                logical_to_physical(COLLAPSED_NOTE_BADGE_REGION_LOGICAL_DIAMETER, scale_factor);
            let badge_left =
                logical_to_physical(COLLAPSED_NOTE_BADGE_REGION_LOGICAL_LEFT, scale_factor);
            let primary = NativeEllipseRegion {
                left: 0,
                top: main_top,
                right: main_diameter.min(physical_width),
                bottom: logical_to_physical(COLLAPSED_NOTE_LOGICAL_SIZE, scale_factor)
                    .min(physical_height),
            };
            let badge = NativeEllipseRegion {
                left: badge_left.min(physical_width),
                top: 0,
                right: logical_to_physical(COLLAPSED_NOTE_LOGICAL_SIZE, scale_factor)
                    .min(physical_width),
                bottom: badge_diameter.min(physical_height),
            };
            if primary.right <= primary.left
                || primary.bottom <= primary.top
                || badge.right <= badge.left
                || badge.bottom <= badge.top
            {
                return Err(
                    "Skribli cannot shape the native dot silhouette at this display scale.".into(),
                );
            }
            Ok(NativeSurfaceRegion {
                primary,
                badge: Some(badge),
                ellipse_width: main_diameter,
                ellipse_height: main_diameter,
                circular: true,
            })
        }
        NativeNoteSurface::Note => {
            // The frontend keeps its small contained CSS shadow inside these bounds. Shape the
            // entire transparent HWND as a rounded surface so corners do not intercept clicks,
            // without clipping that deliberately contained shadow.
            let ellipse =
                logical_to_physical(NOTE_SURFACE_LOGICAL_RADIUS.saturating_mul(2), scale_factor);
            Ok(NativeSurfaceRegion {
                primary: NativeEllipseRegion {
                    left: 0,
                    top: 0,
                    right: physical_width,
                    bottom: physical_height,
                },
                badge: None,
                ellipse_width: ellipse,
                ellipse_height: ellipse,
                circular: false,
            })
        }
    }
}

#[cfg(test)]
fn ellipse_region_contains(region: &NativeEllipseRegion, x: f64, y: f64) -> bool {
    let radius_x = (region.right - region.left) as f64 / 2.0;
    let radius_y = (region.bottom - region.top) as f64 / 2.0;
    if radius_x <= 0.0 || radius_y <= 0.0 {
        return false;
    }
    let center_x = region.left as f64 + radius_x;
    let center_y = region.top as f64 + radius_y;
    let normalized_x = (x - center_x) / radius_x;
    let normalized_y = (y - center_y) / radius_y;
    normalized_x * normalized_x + normalized_y * normalized_y <= 1.0
}

#[cfg(test)]
fn native_dot_region_contains(region: &NativeSurfaceRegion, x: f64, y: f64) -> bool {
    region.circular
        && (ellipse_region_contains(&region.primary, x, y)
            || region
                .badge
                .as_ref()
                .is_some_and(|badge| ellipse_region_contains(badge, x, y)))
}

fn apply_native_surface(
    window: &tauri::WebviewWindow,
    placement: &CompactWindowPlacement,
    surface: NativeNoteSurface,
) -> Result<(), String> {
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("Skribli could not shape the note window: {error}"))?;
    let bounds = calculate_native_surface_region(
        placement.width,
        placement.height,
        placement.scale_factor,
        surface,
    )?;
    let region = if bounds.circular {
        let primary = unsafe {
            CreateEllipticRgn(
                bounds.primary.left,
                bounds.primary.top,
                bounds.primary.right,
                bounds.primary.bottom,
            )
        };
        if primary.0.is_null() {
            return Err("Windows could not create the native dot region.".into());
        }
        let Some(badge_bounds) = bounds.badge.as_ref() else {
            let _ = unsafe { DeleteObject(primary.into()) };
            return Err("Skribli's native dot badge region is unavailable.".into());
        };
        let badge = unsafe {
            CreateEllipticRgn(
                badge_bounds.left,
                badge_bounds.top,
                badge_bounds.right,
                badge_bounds.bottom,
            )
        };
        if badge.0.is_null() {
            let _ = unsafe { DeleteObject(primary.into()) };
            return Err("Windows could not create the native close-badge region.".into());
        }
        let combined = unsafe { CombineRgn(Some(primary), Some(primary), Some(badge), RGN_OR) };
        // The temporary badge is always caller-owned. Only the combined primary is transferred
        // to Windows after SetWindowRgn succeeds.
        let _ = unsafe { DeleteObject(badge.into()) };
        if combined.0 == 0 {
            let _ = unsafe { DeleteObject(primary.into()) };
            return Err("Windows could not combine the native dot silhouette.".into());
        }
        primary
    } else {
        unsafe {
            CreateRoundRectRgn(
                bounds.primary.left,
                bounds.primary.top,
                bounds.primary.right,
                bounds.primary.bottom,
                bounds.ellipse_width,
                bounds.ellipse_height,
            )
        }
    };
    if region.0.is_null() {
        return Err("Windows could not create the native note surface region.".into());
    }
    let applied = unsafe { SetWindowRgn(HWND(hwnd.0 as *mut _), Some(region), true) };
    if applied == 0 {
        // On success Windows owns the region; on failure the caller remains responsible for it.
        let _ = unsafe { DeleteObject(region.into()) };
        return Err("Windows could not apply the native note surface region.".into());
    }
    Ok(())
}

pub fn restore_standard_window_surface(window: &tauri::WebviewWindow) -> Result<(), String> {
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("Skribli could not restore the window surface: {error}"))?;
    if unsafe { SetWindowRgn(HWND(hwnd.0 as *mut _), None, true) } == 0 {
        return Err("Windows could not restore the full window surface.".into());
    }
    window
        .set_shadow(true)
        .map_err(|error| format!("Skribli could not restore the standard window shadow: {error}"))
}

fn standard_compact_surface_logical_size() -> (u32, u32) {
    (
        COMPACT_WINDOW_LOGICAL_WIDTH as u32,
        COMPACT_WINDOW_LOGICAL_HEIGHT as u32,
    )
}

pub fn prepare_standard_compact_surface(window: &tauri::WebviewWindow) -> Result<(), String> {
    let (width, height) = standard_compact_surface_logical_size();
    window
        .set_min_size(Some(LogicalSize::new(
            COMPACT_WINDOW_MIN_LOGICAL_WIDTH as u32,
            COMPACT_WINDOW_MIN_LOGICAL_HEIGHT as u32,
        )))
        .map_err(|error| format!("Skribli could not restore the compact minimum size: {error}"))?;
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| format!("Skribli could not restore the compact recovery size: {error}"))?;
    restore_standard_window_surface(window)
}

fn rect_right(rect: &WindowRect) -> i64 {
    rect.x as i64 + rect.width as i64
}

fn rect_bottom(rect: &WindowRect) -> i64 {
    rect.y as i64 + rect.height as i64
}

pub fn rect_is_within_work_area(rect: &WindowRect, work_area: &WindowRect) -> bool {
    rect.width > 0
        && rect.height > 0
        && work_area.width > 0
        && work_area.height > 0
        && rect.x >= work_area.x
        && rect.y >= work_area.y
        && rect_right(rect) <= rect_right(work_area)
        && rect_bottom(rect) <= rect_bottom(work_area)
}

pub fn calculate_compact_window_placement(
    work_area: &WindowRect,
    target_bounds: &WindowRect,
    dpi: u32,
) -> Result<CompactWindowPlacement, String> {
    if work_area.width <= 0 || work_area.height <= 0 {
        return Err("The selected display reported an invalid usable work area.".into());
    }

    let dpi = normalized_dpi(dpi);
    let scale_factor = dpi as f64 / 96.0;
    let margin = logical_to_physical(COMPACT_WINDOW_LOGICAL_MARGIN, scale_factor);
    let desired_width = logical_to_physical(COMPACT_WINDOW_LOGICAL_WIDTH, scale_factor);
    let desired_height = logical_to_physical(COMPACT_WINDOW_LOGICAL_HEIGHT, scale_factor);
    let minimum_width = logical_to_physical(COMPACT_WINDOW_MIN_LOGICAL_WIDTH, scale_factor);
    let minimum_height = logical_to_physical(COMPACT_WINDOW_MIN_LOGICAL_HEIGHT, scale_factor);

    let available_width = work_area.width.saturating_sub(margin.saturating_mul(2));
    let available_height = work_area.height.saturating_sub(margin.saturating_mul(2));
    if available_width < minimum_width || available_height < minimum_height {
        return Err(format!(
            "The selected display work area is too small for the compact editor at {}% scaling.",
            (scale_factor * 100.0).round() as i32
        ));
    }

    let width = desired_width.min(available_width);
    let height = desired_height.min(available_height);
    let min_x = work_area.x.saturating_add(margin);
    let min_y = work_area.y.saturating_add(margin);
    let max_x = work_area
        .x
        .saturating_add(work_area.width)
        .saturating_sub(width)
        .saturating_sub(margin)
        .max(min_x);
    let max_y = work_area
        .y
        .saturating_add(work_area.height)
        .saturating_sub(height)
        .saturating_sub(margin)
        .max(min_y);
    let right_inset = logical_to_physical(COMPACT_WINDOW_TARGET_RIGHT_INSET, scale_factor);
    let top_offset = logical_to_physical(COMPACT_WINDOW_TARGET_TOP_OFFSET, scale_factor);
    let preferred_x = target_bounds
        .x
        .saturating_add(target_bounds.width)
        .saturating_sub(width)
        .saturating_sub(right_inset);
    let preferred_y = target_bounds.y.saturating_add(top_offset);
    let x = preferred_x.clamp(min_x, max_x);
    let y = preferred_y.clamp(min_y, max_y);

    let placement = CompactWindowPlacement {
        x,
        y,
        width,
        height,
        dpi,
        scale_factor,
        work_area: work_area.clone(),
    };
    let final_rect = WindowRect {
        x,
        y,
        width,
        height,
    };
    if !rect_is_within_work_area(&final_rect, work_area) {
        return Err(
            "Skribli could not calculate a safe position inside the display work area.".into(),
        );
    }

    Ok(placement)
}

pub fn calculate_saved_note_window_placement(
    work_area: &WindowRect,
    target_bounds: &WindowRect,
    note: &SkribNote,
    dpi: u32,
    collapsed: bool,
) -> Result<CompactWindowPlacement, String> {
    if work_area.width <= 0 || work_area.height <= 0 {
        return Err("The selected display reported an invalid usable work area.".into());
    }

    let dpi = normalized_dpi(dpi);
    let scale_factor = dpi as f64 / 96.0;
    let margin = logical_to_physical(
        if collapsed {
            8
        } else {
            COMPACT_WINDOW_LOGICAL_MARGIN
        },
        scale_factor,
    );
    let logical_width = if collapsed {
        COLLAPSED_NOTE_LOGICAL_SIZE
    } else {
        note.width.round().clamp(
            COMPACT_WINDOW_MIN_LOGICAL_WIDTH as f64,
            WORKSPACE_LOGICAL_WIDTH as f64,
        ) as i32
    };
    let logical_height = if collapsed {
        COLLAPSED_NOTE_LOGICAL_SIZE
    } else {
        note.height.round().clamp(
            COMPACT_WINDOW_MIN_LOGICAL_HEIGHT as f64,
            WORKSPACE_LOGICAL_HEIGHT as f64,
        ) as i32
    };
    let available_width = work_area.width.saturating_sub(margin.saturating_mul(2));
    let available_height = work_area.height.saturating_sub(margin.saturating_mul(2));
    let minimum_width = logical_to_physical(
        if collapsed {
            COLLAPSED_NOTE_LOGICAL_SIZE
        } else {
            COMPACT_WINDOW_MIN_LOGICAL_WIDTH
        },
        scale_factor,
    );
    let minimum_height = logical_to_physical(
        if collapsed {
            COLLAPSED_NOTE_LOGICAL_SIZE
        } else {
            COMPACT_WINDOW_MIN_LOGICAL_HEIGHT
        },
        scale_factor,
    );
    if available_width < minimum_width || available_height < minimum_height {
        return Err(format!(
            "The selected display work area is too small for this Skrib at {}% scaling.",
            (scale_factor * 100.0).round() as i32
        ));
    }
    // Large tools must reflow on smaller/high-DPI laptop displays, not fail to open.
    let width = logical_to_physical(logical_width, scale_factor).min(available_width);
    let height = logical_to_physical(logical_height, scale_factor).min(available_height);

    let min_x = work_area.x.saturating_add(margin);
    let min_y = work_area.y.saturating_add(margin);
    let max_x = work_area
        .x
        .saturating_add(work_area.width)
        .saturating_sub(width)
        .saturating_sub(margin)
        .max(min_x);
    let max_y = work_area
        .y
        .saturating_add(work_area.height)
        .saturating_sub(height)
        .saturating_sub(margin)
        .max(min_y);
    let preferred_x = target_bounds
        .x
        .saturating_add((note.rel_x * scale_factor).round() as i32);
    let preferred_y = target_bounds
        .y
        .saturating_add((note.rel_y * scale_factor).round() as i32);

    Ok(CompactWindowPlacement {
        x: preferred_x.clamp(min_x, max_x),
        y: preferred_y.clamp(min_y, max_y),
        width,
        height,
        dpi,
        scale_factor,
        work_area: work_area.clone(),
    })
}

pub fn calculate_note_workspace_placement(
    work_area: &WindowRect,
    target_bounds: &WindowRect,
    note: &SkribNote,
    dpi: u32,
) -> Result<CompactWindowPlacement, String> {
    if work_area.width <= 0 || work_area.height <= 0 {
        return Err("The selected display reported an invalid usable work area.".into());
    }
    let dpi = normalized_dpi(dpi);
    let scale_factor = dpi as f64 / 96.0;
    let margin = logical_to_physical(COMPACT_WINDOW_LOGICAL_MARGIN, scale_factor);
    let available_width = work_area.width.saturating_sub(margin.saturating_mul(2));
    let available_height = work_area.height.saturating_sub(margin.saturating_mul(2));
    let minimum_width = logical_to_physical(480, scale_factor);
    let minimum_height = logical_to_physical(360, scale_factor);
    if available_width < minimum_width || available_height < minimum_height {
        return Err(format!(
            "The selected display work area is too small for the writing workspace at {}% scaling.",
            (scale_factor * 100.0).round() as i32
        ));
    }
    let width = logical_to_physical(WORKSPACE_LOGICAL_WIDTH, scale_factor).min(available_width);
    let height = logical_to_physical(WORKSPACE_LOGICAL_HEIGHT, scale_factor).min(available_height);
    let min_x = work_area.x.saturating_add(margin);
    let min_y = work_area.y.saturating_add(margin);
    let max_x = work_area
        .x
        .saturating_add(work_area.width)
        .saturating_sub(width)
        .saturating_sub(margin)
        .max(min_x);
    let max_y = work_area
        .y
        .saturating_add(work_area.height)
        .saturating_sub(height)
        .saturating_sub(margin)
        .max(min_y);
    let preferred_x = target_bounds
        .x
        .saturating_add((note.rel_x * scale_factor).round() as i32);
    let preferred_y = target_bounds
        .y
        .saturating_add((note.rel_y * scale_factor).round() as i32);

    Ok(CompactWindowPlacement {
        x: preferred_x.clamp(min_x, max_x),
        y: preferred_y.clamp(min_y, max_y),
        width,
        height,
        dpi,
        scale_factor,
        work_area: work_area.clone(),
    })
}

pub fn monitor_work_area_for_window(hwnd: HWND) -> Result<WindowRect, String> {
    unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor.0.is_null() {
            return Err(
                "Windows could not identify the display nearest the target application.".into(),
            );
        }

        let mut monitor_info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut monitor_info).as_bool() {
            return Err("Windows could not read the selected display's usable work area.".into());
        }

        let work = monitor_info.rcWork;
        let width = work.right.saturating_sub(work.left);
        let height = work.bottom.saturating_sub(work.top);
        if width <= 0 || height <= 0 {
            return Err("Windows returned an invalid usable display work area.".into());
        }

        Ok(WindowRect {
            x: work.left,
            y: work.top,
            width,
            height,
        })
    }
}

fn actual_rect(metrics: &OverlayMetrics) -> WindowRect {
    WindowRect {
        x: metrics.overlay_physical_x,
        y: metrics.overlay_physical_y,
        width: metrics.overlay_physical_width,
        height: metrics.overlay_physical_height,
    }
}

struct AppliedPlacement {
    outer_metrics: OverlayMetrics,
    inner_width: i32,
    inner_height: i32,
}

fn actual_matches_placement(actual: &AppliedPlacement, placement: &CompactWindowPlacement) -> bool {
    let rect = actual_rect(&actual.outer_metrics);
    rect_is_within_work_area(&rect, &placement.work_area)
        && (rect.x - placement.x).abs() <= FINAL_RECT_TOLERANCE_PX
        && (rect.y - placement.y).abs() <= FINAL_RECT_TOLERANCE_PX
        && (actual.inner_width - placement.width).abs() <= FINAL_RECT_TOLERANCE_PX
        && (actual.inner_height - placement.height).abs() <= FINAL_RECT_TOLERANCE_PX
}

fn apply_placement(
    window: &tauri::WebviewWindow,
    placement: &CompactWindowPlacement,
    surface: NativeNoteSurface,
) -> Result<AppliedPlacement, String> {
    window.set_shadow(false).map_err(|error| {
        format!("Skribli could not disable the transparent window shadow: {error}")
    })?;
    window
        .set_size(PhysicalSize::new(
            placement.width as u32,
            placement.height as u32,
        ))
        .map_err(|error| format!("Skribli could not resize the compact editor: {error}"))?;
    window
        .set_position(PhysicalPosition::new(placement.x, placement.y))
        .map_err(|error| format!("Skribli could not move the compact editor: {error}"))?;
    apply_native_surface(window, placement, surface)?;

    thread::sleep(Duration::from_millis(35));
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("Skribli could not inspect the compact editor window: {error}"))?;
    let inner_size = window.inner_size().map_err(|error| {
        format!("Skribli could not inspect the compact editor content size: {error}")
    })?;
    Ok(AppliedPlacement {
        outer_metrics: get_overlay_metrics(HWND(hwnd.0 as *mut _)),
        inner_width: inner_size.width as i32,
        inner_height: inner_size.height as i32,
    })
}

pub fn position_compact_window_for_target(
    window: &tauri::WebviewWindow,
    target: &TargetWindowInfo,
) -> Result<OverlayMetrics, String> {
    let target_hwnd = reconstruct_hwnd(target.hwnd_val)
        .ok_or_else(|| "The original target application is no longer available.".to_string())?;
    let target_bounds = get_window_bounds(target_hwnd).ok_or_else(|| {
        "Windows could not read the target application's current bounds.".to_string()
    })?;
    let work_area = monitor_work_area_for_window(target_hwnd)?;
    let (dpi, _) = get_window_dpi(target_hwnd);
    let placement = calculate_compact_window_placement(&work_area, &target_bounds, dpi)?;

    let first = apply_placement(window, &placement, NativeNoteSurface::Note)?;
    if actual_matches_placement(&first, &placement) {
        return Ok(first.outer_metrics);
    }

    // A per-monitor DPI transition can resize the HWND after its first move. Apply the same
    // target-monitor physical rectangle once more after Windows has processed that transition.
    let second = apply_placement(window, &placement, NativeNoteSurface::Note)?;
    if actual_matches_placement(&second, &placement) {
        return Ok(second.outer_metrics);
    }

    Err(format!(
        "Windows did not keep the compact editor inside the selected work area. Expected ({}, {}) {}×{}; received ({}, {}) {}×{}.",
        placement.x,
        placement.y,
        placement.width,
        placement.height,
        second.outer_metrics.overlay_physical_x,
        second.outer_metrics.overlay_physical_y,
        second.inner_width,
        second.inner_height
    ))
}

pub fn position_note_window_for_target(
    window: &tauri::WebviewWindow,
    target: &TargetWindowInfo,
    note: &SkribNote,
    collapsed: bool,
) -> Result<OverlayMetrics, String> {
    let target_hwnd = reconstruct_hwnd(target.hwnd_val)
        .ok_or_else(|| "The original target application is no longer available.".to_string())?;
    let target_bounds = get_window_bounds(target_hwnd).ok_or_else(|| {
        "Windows could not read the target application's current bounds.".to_string()
    })?;
    let work_area = monitor_work_area_for_window(target_hwnd)?;
    let (dpi, _) = get_window_dpi(target_hwnd);
    let placement =
        calculate_saved_note_window_placement(&work_area, &target_bounds, note, dpi, collapsed)?;

    window
        .set_min_size(Some(PhysicalSize::new(
            placement.width as u32,
            placement.height as u32,
        )))
        .map_err(|error| format!("Skribli could not prepare the note window size: {error}"))?;
    let surface = if collapsed {
        NativeNoteSurface::Dot
    } else {
        NativeNoteSurface::Note
    };
    let applied = apply_placement(window, &placement, surface)?;
    if actual_matches_placement(&applied, &placement) {
        return Ok(applied.outer_metrics);
    }

    let reapplied = apply_placement(window, &placement, surface)?;
    if actual_matches_placement(&reapplied, &placement) {
        return Ok(reapplied.outer_metrics);
    }

    Err("Windows did not keep this Skrib inside the selected display work area.".into())
}

pub fn position_note_workspace_for_target(
    window: &tauri::WebviewWindow,
    target: &TargetWindowInfo,
    note: &SkribNote,
) -> Result<OverlayMetrics, String> {
    let target_hwnd = reconstruct_hwnd(target.hwnd_val)
        .ok_or_else(|| "The original target application is no longer available.".to_string())?;
    let target_bounds = get_window_bounds(target_hwnd).ok_or_else(|| {
        "Windows could not read the target application's current bounds.".to_string()
    })?;
    let work_area = monitor_work_area_for_window(target_hwnd)?;
    let (dpi, _) = get_window_dpi(target_hwnd);
    let placement = calculate_note_workspace_placement(&work_area, &target_bounds, note, dpi)?;
    window
        .set_min_size(Some(PhysicalSize::new(
            logical_to_physical(480, placement.scale_factor) as u32,
            logical_to_physical(360, placement.scale_factor) as u32,
        )))
        .map_err(|error| format!("Skribli could not prepare the writing workspace: {error}"))?;
    let applied = apply_placement(window, &placement, NativeNoteSurface::Note)?;
    if actual_matches_placement(&applied, &placement) {
        Ok(applied.outer_metrics)
    } else {
        Err("Windows did not keep the writing workspace inside the selected display.".into())
    }
}

/// Opens the real note beside the rail without activating or modifying its saved target.
pub fn position_detached_note_window(
    window: &tauri::WebviewWindow,
    rail: &tauri::WebviewWindow,
    note: &SkribNote,
) -> Result<OverlayMetrics, String> {
    let hwnd = rail
        .hwnd()
        .map_err(|error| format!("Skribli could not locate the rail: {error}"))?;
    let hwnd = HWND(hwnd.0 as *mut _);
    let bounds = get_window_bounds(hwnd)
        .ok_or_else(|| "Skribli could not read the rail position.".to_string())?;
    let work_area = monitor_work_area_for_window(hwnd)?;
    let (dpi, _) = get_window_dpi(hwnd);
    let scale = normalized_dpi(dpi) as f64 / 96.0;
    let mut detached_note = note.clone();
    let width = note.width.clamp(
        COMPACT_WINDOW_LOGICAL_WIDTH as f64,
        WORKSPACE_LOGICAL_WIDTH as f64,
    );
    detached_note.width = width;
    detached_note.height = note.height.clamp(
        COMPACT_WINDOW_LOGICAL_HEIGHT as f64,
        WORKSPACE_LOGICAL_HEIGHT as f64,
    );
    let rail_is_on_right = bounds.x > work_area.x + work_area.width / 2;
    detached_note.rel_x = if rail_is_on_right {
        -width - 12.0
    } else {
        bounds.width as f64 / scale + 12.0
    };
    detached_note.rel_y = 0.0;
    let placement =
        calculate_saved_note_window_placement(&work_area, &bounds, &detached_note, dpi, false)?;
    window
        .set_min_size(Some(LogicalSize::new(
            COMPACT_WINDOW_MIN_LOGICAL_WIDTH,
            COMPACT_WINDOW_MIN_LOGICAL_HEIGHT,
        )))
        .map_err(|error| format!("Skribli could not prepare the note size: {error}"))?;
    let applied = apply_placement(window, &placement, NativeNoteSurface::Note)?;
    if actual_matches_placement(&applied, &placement) {
        Ok(applied.outer_metrics)
    } else {
        let reapplied = apply_placement(window, &placement, NativeNoteSurface::Note)?;
        if actual_matches_placement(&reapplied, &placement) {
            Ok(reapplied.outer_metrics)
        } else {
            Err("Windows could not place this note beside the rail.".into())
        }
    }
}

pub fn initialize_compact_window(window: &tauri::WebviewWindow) -> Result<OverlayMetrics, String> {
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("Failed to acquire compact editor HWND: {error}"))?;
    Ok(get_overlay_metrics(HWND(hwnd.0 as *mut _)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(x: i32, y: i32, width: i32, height: i32) -> WindowRect {
        WindowRect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn places_the_editor_near_the_target_at_100_percent() {
        let placement = calculate_compact_window_placement(
            &rect(0, 0, 1920, 1040),
            &rect(100, 100, 800, 600),
            96,
        )
        .expect("placement");

        assert_eq!((placement.width, placement.height), (420, 360));
        assert_eq!((placement.x, placement.y), (456, 148));
        assert!(rect_is_within_work_area(
            &rect(placement.x, placement.y, placement.width, placement.height),
            &placement.work_area
        ));
    }

    #[test]
    fn restores_saved_note_position_and_switches_between_editor_and_dot_sizes() {
        let note = SkribNote {
            id: "saved-note".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document.txt - Notepad".into(),
            rel_x: 125.0,
            rel_y: 80.0,
            width: 400.0,
            height: 340.0,
            text: "Saved".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };
        let work_area = rect(0, 0, 1920, 1040);
        let target = rect(100, 120, 1000, 700);

        let editor = calculate_saved_note_window_placement(&work_area, &target, &note, 96, false)
            .expect("editor placement");
        let dot = calculate_saved_note_window_placement(&work_area, &target, &note, 96, true)
            .expect("dot placement");

        assert_eq!((editor.x, editor.y), (225, 200));
        assert_eq!((editor.width, editor.height), (400, 340));
        assert_eq!((dot.x, dot.y), (225, 200));
        assert_eq!((dot.width, dot.height), (44, 44));
    }

    #[test]
    fn native_regions_hug_the_rounded_note_and_collapsed_dot() {
        let note = calculate_native_surface_region(420, 360, 1.0, NativeNoteSurface::Note)
            .expect("note region");
        assert_eq!(
            (
                note.primary.left,
                note.primary.top,
                note.primary.right,
                note.primary.bottom,
            ),
            (0, 0, 420, 360)
        );
        assert_eq!((note.ellipse_width, note.ellipse_height), (36, 36));
        assert!(!note.circular);
        assert!(note.badge.is_none());

        let dot = calculate_native_surface_region(44, 44, 1.0, NativeNoteSurface::Dot)
            .expect("dot region");
        assert_eq!(
            (
                dot.primary.left,
                dot.primary.top,
                dot.primary.right,
                dot.primary.bottom,
            ),
            (0, 4, 40, 44)
        );
        let badge = dot.badge.as_ref().expect("dot badge region");
        assert_eq!(
            (badge.left, badge.top, badge.right, badge.bottom),
            (26, 0, 44, 18)
        );
        assert!(dot.circular);
        for point in [(4.0, 24.0), (20.0, 8.0), (36.0, 24.0), (20.0, 40.0)] {
            assert!(native_dot_region_contains(&dot, point.0, point.1));
        }
        for point in [(28.0, 9.0), (35.0, 3.0), (40.0, 9.0), (35.0, 15.0)] {
            assert!(native_dot_region_contains(&dot, point.0, point.1));
        }
        for point in [(0.0, 0.0), (0.0, 44.0), (44.0, 44.0)] {
            assert!(!native_dot_region_contains(&dot, point.0, point.1));
        }

        let scaled_dot = calculate_native_surface_region(55, 55, 1.25, NativeNoteSurface::Dot)
            .expect("scaled dot region");
        assert_eq!(
            (
                scaled_dot.primary.left,
                scaled_dot.primary.top,
                scaled_dot.primary.right,
                scaled_dot.primary.bottom,
            ),
            (0, 5, 50, 55)
        );
        let scaled_badge = scaled_dot.badge.expect("scaled badge region");
        assert_eq!(
            (
                scaled_badge.left,
                scaled_badge.top,
                scaled_badge.right,
                scaled_badge.bottom,
            ),
            (33, 0, 55, 23)
        );
    }

    #[test]
    fn recovery_surface_restores_compact_logical_dimensions_after_a_dot() {
        assert_eq!(standard_compact_surface_logical_size(), (420, 360));
        assert!(standard_compact_surface_logical_size().0 > COLLAPSED_NOTE_LOGICAL_SIZE as u32);
        assert!(standard_compact_surface_logical_size().1 > COLLAPSED_NOTE_LOGICAL_SIZE as u32);
    }

    #[test]
    fn clamps_saved_positions_to_the_monitor_work_area() {
        let note = SkribNote {
            id: "offscreen-note".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document.txt - Notepad".into(),
            rel_x: 50_000.0,
            rel_y: -50_000.0,
            width: 400.0,
            height: 340.0,
            text: String::new(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };
        let placement = calculate_saved_note_window_placement(
            &rect(1920, 0, 1920, 1040),
            &rect(2100, 100, 900, 700),
            &note,
            96,
            false,
        )
        .expect("clamped placement");
        assert!(rect_is_within_work_area(
            &rect(placement.x, placement.y, placement.width, placement.height),
            &placement.work_area
        ));
    }

    #[test]
    fn expands_to_a_moderate_workspace_without_leaving_the_monitor() {
        let note = SkribNote {
            id: "workspace-note".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document.txt - Notepad".into(),
            rel_x: 900.0,
            rel_y: 500.0,
            width: 420.0,
            height: 360.0,
            text: String::new(),
            color: "mint".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 1,
            deleted_at: None,
        };
        let placement = calculate_note_workspace_placement(
            &rect(0, 0, 1920, 1040),
            &rect(100, 100, 1200, 800),
            &note,
            96,
        )
        .expect("workspace placement");
        assert_eq!((placement.width, placement.height), (820, 760));
        assert!(rect_is_within_work_area(
            &rect(placement.x, placement.y, placement.width, placement.height),
            &placement.work_area
        ));

        let mut large_note = note.clone();
        large_note.width = 820.0;
        large_note.height = 760.0;
        let laptop = calculate_saved_note_window_placement(
            &rect(0, 0, 1366, 728),
            &rect(0, 0, 1366, 728),
            &large_note,
            120,
            false,
        )
        .expect("large note adapts to a scaled laptop display");
        assert_eq!(laptop.height, 682);
        assert!(rect_is_within_work_area(
            &rect(laptop.x, laptop.y, laptop.width, laptop.height),
            &laptop.work_area,
        ));
    }

    #[test]
    fn converts_logical_dimensions_at_common_windows_scaling_values() {
        for (dpi, expected) in [(120, (525, 450)), (144, (630, 540)), (192, (840, 720))] {
            let placement = calculate_compact_window_placement(
                &rect(1920, 0, 2560, 1440),
                &rect(2200, 100, 1200, 900),
                dpi,
            )
            .expect("scaled placement");
            assert_eq!((placement.width, placement.height), expected);
        }
    }

    #[test]
    fn supports_monitors_left_of_and_above_the_primary_display() {
        let left = calculate_compact_window_placement(
            &rect(-1920, 0, 1920, 1040),
            &rect(-1800, 100, 1000, 700),
            96,
        )
        .expect("left monitor placement");
        assert_eq!((left.x, left.y), (-1244, 148));

        let above = calculate_compact_window_placement(
            &rect(0, -1200, 1920, 1160),
            &rect(200, -1120, 1000, 800),
            96,
        )
        .expect("above monitor placement");
        assert!(above.y < 0);
        assert!(rect_is_within_work_area(
            &rect(above.x, above.y, above.width, above.height),
            &above.work_area
        ));
    }

    #[test]
    fn stays_inside_portrait_and_taskbar_reduced_work_areas() {
        let portrait = calculate_compact_window_placement(
            &rect(0, 0, 1080, 1880),
            &rect(0, 50, 1080, 1700),
            192,
        )
        .expect("portrait placement");
        assert_eq!((portrait.width, portrait.height), (840, 720));
        assert!(rect_is_within_work_area(
            &rect(portrait.x, portrait.y, portrait.width, portrait.height),
            &portrait.work_area
        ));

        let taskbar_right = calculate_compact_window_placement(
            &rect(0, 0, 1872, 1080),
            &rect(1200, 100, 700, 700),
            96,
        )
        .expect("taskbar placement");
        assert!(taskbar_right.x + taskbar_right.width <= 1872 - 18);
    }

    #[test]
    fn never_uses_a_virtual_desktop_gap() {
        let placement = calculate_compact_window_placement(
            &rect(2560, 300, 1920, 1040),
            &rect(2700, 360, 900, 700),
            96,
        )
        .expect("secondary display placement");
        assert!(placement.x >= 2578);
        assert!(placement.y >= 318);
    }

    #[test]
    fn clamps_spanning_targets_to_the_selected_work_area() {
        let placement = calculate_compact_window_placement(
            &rect(1920, 0, 1920, 1040),
            &rect(1600, 80, 1200, 800),
            144,
        )
        .expect("spanning target placement");
        assert!(rect_is_within_work_area(
            &rect(placement.x, placement.y, placement.width, placement.height),
            &placement.work_area
        ));
    }

    #[test]
    fn shrinks_to_a_usable_size_when_the_work_area_is_constrained() {
        let placement =
            calculate_compact_window_placement(&rect(0, 0, 800, 600), &rect(0, 0, 800, 600), 192)
                .expect("constrained placement");
        assert_eq!((placement.width, placement.height), (728, 528));
        assert_eq!((placement.x, placement.y), (36, 36));
    }

    #[test]
    fn fails_closed_when_the_work_area_cannot_fit_a_readable_editor() {
        let error =
            calculate_compact_window_placement(&rect(0, 0, 500, 400), &rect(0, 0, 500, 400), 192)
                .expect_err("undersized work areas must fail");
        assert!(error.contains("too small"));
    }

    #[test]
    fn validates_requested_content_size_instead_of_decorated_outer_size() {
        let placement = calculate_compact_window_placement(
            &rect(0, 0, 1920, 1040),
            &rect(100, 100, 1600, 800),
            120,
        )
        .expect("placement");
        let actual = AppliedPlacement {
            outer_metrics: OverlayMetrics {
                overlay_physical_x: placement.x,
                overlay_physical_y: placement.y,
                overlay_physical_width: placement.width + 18,
                overlay_physical_height: placement.height + 10,
                dpi: placement.dpi,
                scale_factor: placement.scale_factor,
            },
            inner_width: placement.width,
            inner_height: placement.height,
        };

        assert!(actual_matches_placement(&actual, &placement));
    }
}
