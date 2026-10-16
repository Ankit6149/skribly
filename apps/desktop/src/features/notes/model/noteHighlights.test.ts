import { describe, expect, it } from 'vitest';
import { NOTE_PALETTE } from './noteColors';
import { colorContrast, noteHighlightPalette } from './noteHighlights';
import { readableMutedInk } from '../../../ui/colorContrast';

describe('paper-aware highlights', () => {
  it('keeps faded empty-note hints readable on all saturated and pastel papers', () => {
    for (const paper of NOTE_PALETTE) {
      expect(colorContrast(readableMutedInk(paper.background, paper.foreground), paper.background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(readableMutedInk('#f9df5b', '#171b18')).not.toBe('#171b18');
    expect(readableMutedInk('#8c2937', '#fff0d8')).not.toBe('#fff0d8');
  });
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
