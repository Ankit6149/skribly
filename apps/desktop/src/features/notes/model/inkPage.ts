import type { InkStroke } from './inkModel';

// A logical coordinate range, not a million-pixel bitmap. Only the viewport is painted.
export const INK_PAGE_HEIGHT = 1_000_000;
export interface InkViewport { width: number; height: number; top: number }
export function strokeInViewport(stroke: InkStroke, view: InkViewport): InkStroke {
  const space = stroke.coordinateSpace ?? view;
  return { ...stroke, points: stroke.points.map((point) => ({ ...point,
    x: point.x * space.width / Math.max(1, view.width),
    y: (point.y * space.height - view.top) / Math.max(1, view.height),
  })) };
}
export function inkPageExtent(strokes: InkStroke[]): number {
  return strokes.reduce((height, stroke) => stroke.coordinateSpace
    ? stroke.points.reduce((extent, point) => Math.max(extent, point.y * stroke.coordinateSpace!.height + 80), height) : height, 0);
}
