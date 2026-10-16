import { NOTE_PALETTE, type NoteColor } from './noteColors';
import { colorContrast, mixHexColors as mix } from '../../../ui/colorContrast';
export { colorContrast } from '../../../ui/colorContrast';

export const HIGHLIGHT_TONES = ['yellow', 'peach', 'mint', 'sky', 'lavender'] as const;
export type HighlightTone = (typeof HIGHLIGHT_TONES)[number];
export const LEGACY_HIGHLIGHT_COLORS = ['#f8df78', '#ffd7c4', '#cfe5d7', '#d5e5f5', '#e4d9f0'] as const;
const bases = ['#f5cd37', '#ef9670', '#70b992', '#73a8db', '#af88d1'];
export function noteHighlightPalette(color: NoteColor) {
  const paper = NOTE_PALETTE.find((entry) => entry.id === color)!.background;
  return HIGHLIGHT_TONES.map((tone, index) => {
    const base = mix(bases[index]!, paper, .18);
    for (let step = 0; step <= 100; step++) {
      for (const endpoint of ['#ffffff', '#151917']) {
        const fill = mix(base, endpoint, step / 100);
        const ink = colorContrast(fill, '#262923') >= colorContrast(fill, '#ffffff') ? '#262923' : '#ffffff';
        const textContrast = colorContrast(fill, ink);
        if (colorContrast(fill, paper) >= 3 && textContrast >= 4.5) return { tone, fill, ink, textContrast };
      }
    }
    throw new Error('No readable highlight pair for note paper.');
  });
}
