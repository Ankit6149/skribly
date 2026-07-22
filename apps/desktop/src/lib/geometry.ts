export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayMetrics {
  overlay_physical_x: number;
  overlay_physical_y: number;
  overlay_physical_width: number;
  overlay_physical_height: number;
  dpi: number;
  scale_factor: number;
}

export type OverlayInitializationStatus =
  | { type: 'Initializing' }
  | { type: 'Ready'; payload: OverlayMetrics }
  | { type: 'Failed'; payload: string };

export interface TargetWindowInfo {
  hwnd_val: number;
  title: string;
  process_name: string;
  class_name: string;
  bounds: WindowRect;
  is_minimized: boolean;
  is_focused: boolean;
  dpi: number;
  scale_factor: number;
}

export interface SkribNote {
  id: string;
  target_process_name: string;
  target_title: string;
  rel_x: number;
  rel_y: number;
  width: number;
  height: number;
  text: string;
  color: 'yellow' | 'peach' | 'mint' | 'sky' | 'lavender';
  collapsed: boolean;
  created_at: number;
  updated_at: number;
}

/**
  * Calculate note position in Client Logical DIPs relative to overlay WebView top-left (0, 0).
  * Formula:
  * targetLogicalX = (targetPhysicalX - overlayPhysicalX) / scaleFactor
  * clientLogicalX = targetLogicalX + noteRelLogicalX
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

/**
  * Calculate relative note offset in Client Logical DIPs during drag/resize operations.
  */
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

export function matchesContext(
  targetProcessName: string,
  targetTitle: string,
  noteProcessName: string,
  noteTitle: string
): boolean {
  const sameProcess =
    targetProcessName.toLowerCase() === noteProcessName.toLowerCase();
  if (!sameProcess) return false;

  if (!noteTitle || !targetTitle) return true;

  const t1 = targetTitle.toLowerCase().trim();
  const t2 = noteTitle.toLowerCase().trim();
  return t1.includes(t2) || t2.includes(t1);
}

