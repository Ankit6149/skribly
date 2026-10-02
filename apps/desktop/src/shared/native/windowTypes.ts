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
