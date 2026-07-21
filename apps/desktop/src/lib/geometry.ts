export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TargetWindowInfo {
  hwnd_id: string;
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

export function calculateAbsolutePosition(
  targetBounds: WindowRect,
  relX: number,
  relY: number
): { x: number; y: number } {
  return {
    x: Math.round(targetBounds.x + relX),
    y: Math.round(targetBounds.y + relY),
  };
}

export function calculateRelativeOffset(
  targetBounds: WindowRect,
  absoluteX: number,
  absoluteY: number
): { rel_x: number; rel_y: number } {
  return {
    rel_x: Math.round(absoluteX - targetBounds.x),
    rel_y: Math.round(absoluteY - targetBounds.y),
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
