import nativeColors from '../../../../src-tauri/src/core/note_colors.rs?raw';
import { describe, expect, it } from 'vitest';
import { NOTE_PALETTE, NOTE_COLORS, isNoteColor } from './noteColors';
function luminance(hex: string) {
  const rgb = hex.match(/[0-9a-f]{2}/giu)!.map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
}
describe('desktop palette persistence contract', () => {
  it('uses exactly the colour IDs accepted by native writes and imports', () => {
    const native = [...nativeColors.matchAll(/"([a-z]+)"/gu)].map((match) => match[1]);
    expect(native).toEqual(NOTE_COLORS);
    expect(new Set(NOTE_COLORS).size).toBe(32);
    expect(isNoteColor('url(https://example.com)')).toBe(false);
    expect(isNoteColor(null)).toBe(false);
  });
  it.each(NOTE_PALETTE)('keeps readable text on $id paper', ({ background, foreground }) => {
    const pair = [luminance(background), luminance(foreground)].sort((a, b) => a - b);
    expect((pair[1]! + .05) / (pair[0]! + .05)).toBeGreaterThanOrEqual(4.5);
  });
});

