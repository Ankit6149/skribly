import { describe, expect, it } from 'vitest';
import {
  calculateAbsolutePosition,
  calculateRelativeOffset,
  clampToWindowBounds,
  matchesContext,
  WindowRect,
} from './geometry';

describe('geometry utilities', () => {
  const targetBounds: WindowRect = {
    x: 200,
    y: 150,
    width: 1000,
    height: 700,
  };

  it('calculates absolute screen position from relative offset', () => {
    const pos = calculateAbsolutePosition(targetBounds, 40, 50);
    expect(pos).toEqual({ x: 240, y: 200 });
  });

  it('calculates relative offset from absolute screen coordinates', () => {
    const offset = calculateRelativeOffset(targetBounds, 350, 400);
    expect(offset).toEqual({ rel_x: 150, rel_y: 250 });
  });

  it('clamps note within window boundaries', () => {
    const noteRect = { x: 50, y: 50, width: 250, height: 180 };
    const clamped = clampToWindowBounds(noteRect, targetBounds);
    expect(clamped.x).toBeGreaterThanOrEqual(targetBounds.x - noteRect.width + 40);
    expect(clamped.y).toBeGreaterThanOrEqual(targetBounds.y);
  });

  it('matches window context correctly', () => {
    expect(matchesContext('notepad.exe', 'Doc.txt - Notepad', 'notepad.exe', 'Doc.txt')).toBe(true);
    expect(matchesContext('notepad.exe', 'Doc.txt', 'chrome.exe', 'Doc.txt')).toBe(false);
    expect(matchesContext('code.exe', 'skribly - Visual Studio Code', 'code.exe', '')).toBe(true);
  });
});
