import type { OverlayMetrics, WindowRect } from './windowTypes';

/**
 * Calculate note position in Client Logical DIPs relative to overlay WebView top-left (0, 0).
 */
export function calculateNoteClientLogicalPosition(
  targetBounds: WindowRect,
  overlayMetrics: OverlayMetrics,
  relX: number,
  relY: number
): { x: number; y: number } {
  const scale = overlayMetrics.scale_factor > 0 ? overlayMetrics.scale_factor : 1.0;
  const targetLogicalX = (targetBounds.x - overlayMetrics.overlay_physical_x) / scale;
  const targetLogicalY = (targetBounds.y - overlayMetrics.overlay_physical_y) / scale;

  return {
    x: Math.round(targetLogicalX + relX),
    y: Math.round(targetLogicalY + relY),
  };
}

/** Calculate relative note offset in Client Logical DIPs during drag/resize operations. */
export function calculateRelativeLogicalOffset(
  targetBounds: WindowRect,
  overlayMetrics: OverlayMetrics,
  clientLogicalX: number,
  clientLogicalY: number
): { rel_x: number; rel_y: number } {
  const scale = overlayMetrics.scale_factor > 0 ? overlayMetrics.scale_factor : 1.0;
  const targetLogicalX = (targetBounds.x - overlayMetrics.overlay_physical_x) / scale;
  const targetLogicalY = (targetBounds.y - overlayMetrics.overlay_physical_y) / scale;

  return {
    rel_x: Math.round(clientLogicalX - targetLogicalX),
    rel_y: Math.round(clientLogicalY - targetLogicalY),
  };
}

export function clampToWindowBounds(
  noteRect: { x: number; y: number; width: number; height: number },
  targetBounds: WindowRect
): { x: number; y: number } {
  const minX = targetBounds.x - noteRect.width + 40;
  const maxX = targetBounds.x + targetBounds.width - 40;
  const minY = targetBounds.y;
  const maxY = targetBounds.y + targetBounds.height - 40;

  return {
    x: Math.max(minX, Math.min(maxX, noteRect.x)),
    y: Math.max(minY, Math.min(maxY, noteRect.y)),
  };
}
