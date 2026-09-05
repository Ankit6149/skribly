import { describe, expect, it } from 'vitest';
import {
  countInkPoints,
  createInkStroke,
  findTopInkStroke,
  MAX_INK_POINTS,
  normalizeInkPoint,
  validateInkStrokes,
} from './inkModel';

describe('inkModel', () => {
  it('normalizes pointer coordinates and pressure', () => {
    expect(
      normalizeInkPoint(60, 45, { left: 10, top: 5, width: 100, height: 80 }, 0.7)
    ).toEqual({ x: 0.5, y: 0.5, pressure: 0.7 });
  });

  it('clamps points to the drawing surface', () => {
    expect(
      normalizeInkPoint(-20, 500, { left: 0, top: 0, width: 100, height: 100 }, 0)
    ).toEqual({ x: 0, y: 1, pressure: 0.5 });
  });

  it('creates a valid editable stroke', () => {
    const stroke = createInkStroke('stroke-1', 'pen', '#262923', 3, {
      x: 0.2,
      y: 0.3,
      pressure: 0.5,
    });
    expect(countInkPoints([stroke])).toBe(1);
    expect(() => validateInkStrokes([stroke])).not.toThrow();
  });

  it('selects a stroke along the line, not only on a sampled point', () => {
    const stroke = {
      ...createInkStroke('stroke-1', 'pen', '#262923', 3, {
        x: 0.1,
        y: 0.1,
        pressure: 0.5,
      }),
      points: [
        { x: 0.1, y: 0.1, pressure: 0.5 },
        { x: 0.9, y: 0.9, pressure: 0.5 },
      ],
    };
    expect(findTopInkStroke([stroke], 0.5, 0.5, 0.02)?.id).toBe('stroke-1');
    expect(findTopInkStroke([stroke], 0.5, 0.7, 0.02)).toBeUndefined();
  });

  it('rejects duplicate identifiers and unbounded point collections', () => {
    const stroke = createInkStroke('same', 'pen', '#262923', 3, {
      x: 0.2,
      y: 0.3,
      pressure: 0.5,
    });
    expect(() => validateInkStrokes([stroke, stroke])).toThrow('duplicate');

    const tooManyPoints = {
      ...stroke,
      id: 'large',
      points: Array.from({ length: MAX_INK_POINTS + 1 }, () => ({
        x: 0.5,
        y: 0.5,
        pressure: 0.5,
      })),
    };
    expect(() => validateInkStrokes([tooManyPoints])).toThrow('ink points');
  });
});
