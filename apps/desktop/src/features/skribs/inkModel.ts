import {
  MAX_INK_POINTS_PER_NOTE,
  MAX_INK_POINTS_PER_STROKE,
  MAX_INK_STROKES,
  type InkPoint,
  type InkStroke,
  type InkTool,
} from '../../lib/richContentStore';

export type { InkPoint, InkStroke, InkTool } from '../../lib/richContentStore';
export { MAX_INK_STROKES } from '../../lib/richContentStore';
export const MAX_INK_POINTS = MAX_INK_POINTS_PER_NOTE;
export const MAX_INK_STROKE_POINTS = MAX_INK_POINTS_PER_STROKE;

function finiteBetween(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function normalizeInkPoint(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  pressure = 0.5
): InkPoint {
  const width = bounds.width > 0 ? bounds.width : 1;
  const height = bounds.height > 0 ? bounds.height : 1;
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / width)),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / height)),
    pressure: Math.max(0.1, Math.min(1, Number.isFinite(pressure) && pressure > 0 ? pressure : 0.5)),
  };
}

export function countInkPoints(strokes: InkStroke[]): number {
  return strokes.reduce((total, stroke) => total + stroke.points.length, 0);
}

export function validateInkStrokes(strokes: InkStroke[]): void {
  if (strokes.length > MAX_INK_STROKES) {
    throw new Error(`A Skrib can contain at most ${MAX_INK_STROKES.toLocaleString()} ink strokes.`);
  }
  if (countInkPoints(strokes) > MAX_INK_POINTS) {
    throw new Error(`A Skrib can contain at most ${MAX_INK_POINTS.toLocaleString()} ink points.`);
  }

  const ids = new Set<string>();
  for (const stroke of strokes) {
    if (!stroke.id || stroke.id.length > 128 || ids.has(stroke.id)) {
      throw new Error('The drawing contains an invalid or duplicate stroke identifier.');
    }
    ids.add(stroke.id);
    if (!['pen', 'highlighter', 'eraser'].includes(stroke.tool)) {
      throw new Error('The drawing contains an unsupported tool.');
    }
    if (
      !finiteBetween(stroke.width, 1, 64) ||
      stroke.points.length === 0 ||
      stroke.points.length > MAX_INK_POINTS_PER_STROKE
    ) {
      throw new Error('The drawing contains an invalid stroke.');
    }
    if (
      stroke.points.some(
        (point) =>
          !finiteBetween(point.x, 0, 1) ||
          !finiteBetween(point.y, 0, 1) ||
          !finiteBetween(point.pressure, 0.1, 1)
      )
    ) {
      throw new Error('The drawing contains an invalid pointer point.');
    }
  }
}

export function createInkStroke(
  id: string,
  tool: InkTool,
  color: string,
  width: number,
  point: InkPoint
): InkStroke {
  const stroke: InkStroke = { id, tool, color, width, points: [point] };
  validateInkStrokes([stroke]);
  return stroke;
}
