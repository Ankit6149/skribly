import { describe, expect, it } from 'vitest';
import { NOTE_PALETTE } from './noteColors';
import { colorContrast, noteHighlightPalette } from './noteHighlights';

describe('paper-aware highlights', () => {
  it('offers five distinguishable fills with readable ink on every paper', () => {
    for (const paper of NOTE_PALETTE) {
      const palette = noteHighlightPalette(paper.id);
      expect(new Set(palette.map((entry) => entry.fill)).size).toBe(5);
      for (const entry of palette) {
        expect(colorContrast(entry.fill, paper.background)).toBeGreaterThanOrEqual(3);
        expect(colorContrast(entry.fill, entry.ink)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('retains color identities while adapting the fills to a new paper', () => {
    const first = noteHighlightPalette('mint'), second = noteHighlightPalette('wine');
    expect(first.map((entry) => entry.tone)).toEqual(second.map((entry) => entry.tone));
    first.forEach((entry, index) => expect(entry.fill).not.toBe(second[index]!.fill));
  });
});
