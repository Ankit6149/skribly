import { describe, expect, it } from 'vitest';
import { borrowedSurfaceAfterResize, roomForNoteTool, sameSurfaceSize, sizeAfterToolClose, temporaryToolResizeRequest } from './toolSurfaceGeometry';

describe('temporary note tool geometry', () => {
  it('gives reminders readable medium-width room, including short manually sized notes', () => {
    expect(roomForNoteTool({ width: 640, height: 300 }, 'reminder')).toEqual({ width: 640, height: 660 });
    expect(roomForNoteTool({ width: 420, height: 360 }, 'draw')).toEqual({ width: 640, height: 600 });
  });
  it('does not shrink an already larger note', () => {
    expect(roomForNoteTool({ width: 810, height: 740 }, 'reminder')).toEqual({ width: 810, height: 740 });
  });
  it('restores the exact manual dimensions rather than a preset', () => {
    const original = { width: 517, height: 413 };
    const expanded = { width: 640, height: 660 };
    expect(sizeAfterToolClose({ original, expanded }, expanded)).toEqual(original);
  });
  it('keeps a manual resize made while the tool was open', () => {
    const borrowed = { original: { width: 420, height: 360 }, expanded: { width: 640, height: 660 } };
    expect(sizeAfterToolClose(borrowed, { width: 700, height: 700 })).toBeNull();
    expect(sizeAfterToolClose(null, borrowed.expanded)).toBeNull();
  });
  it('allows harmless device-pixel rounding but not a material resize', () => {
    expect(sameSurfaceSize({ width: 640, height: 660 }, { width: 641.5, height: 659 })).toBe(true);
    expect(sameSurfaceSize({ width: 640, height: 660 }, { width: 644, height: 660 })).toBe(false);
  });
  it('does not request restoration outside the native size limits', () => {
    const expanded = { width: 640, height: 660 };
    expect(sizeAfterToolClose({ original: { width: 300, height: 240 }, expanded }, expanded)).toBeNull();
    expect(sizeAfterToolClose({ original: { width: Number.NaN, height: 360 }, expanded }, expanded)).toBeNull();
  });
  it('marks both opening and restoration requests as non-persistent native geometry', () => {
    const original = { width: 517, height: 413 };
    const expanded = roomForNoteTool(original, 'reminder');
    const borrowed = borrowedSurfaceAfterResize(null, original, expanded);
    expect(temporaryToolResizeRequest('note-a', expanded)).toEqual({
      noteId: 'note-a', width: 640, height: 660, temporary: true,
    });
    expect(temporaryToolResizeRequest('note-a', sizeAfterToolClose(borrowed, expanded)!)).toEqual({
      noteId: 'note-a', width: 517, height: 413, temporary: true,
    });
  });
  it('retains the original size across Draw to Calendar transitions', () => {
    const original = { width: 420, height: 360 };
    const draw = roomForNoteTool(original, 'draw');
    const reminder = roomForNoteTool(draw, 'reminder');
    const borrowed = borrowedSurfaceAfterResize(borrowedSurfaceAfterResize(null, original, draw), draw, reminder);
    expect(sizeAfterToolClose(borrowed, reminder)).toEqual(original);
  });
  it('uses the newer manual size after an intervening resize', () => {
    const previous = { original: { width: 420, height: 360 }, expanded: { width: 640, height: 600 } };
    const manual = { width: 710, height: 610 };
    const expanded = roomForNoteTool(manual, 'reminder');
    const borrowed = borrowedSurfaceAfterResize(previous, manual, expanded);
    expect(sizeAfterToolClose(borrowed, expanded)).toEqual(manual);
    manual.width = 740;
    expect(borrowed.original.width).toBe(710);
  });
});
