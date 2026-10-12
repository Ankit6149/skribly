import { NOTE_PALETTE, type NoteColor } from './noteColors';

export const HIGHLIGHT_TONES = ['yellow', 'peach', 'mint', 'sky', 'lavender'] as const;
export type HighlightTone = (typeof HIGHLIGHT_TONES)[number];
export const LEGACY_HIGHLIGHT_COLORS = ['#f8df78', '#ffd7c4', '#cfe5d7', '#d5e5f5', '#e4d9f0'] as const;
const bases = ['#f5cd37', '#ef9670', '#70b992', '#73a8db', '#af88d1'];
const rgb = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
function mix(a: string, b: string, amount: number): string {
  const other = rgb(b);
  return '#' + rgb(a).map((value, index) => Math.round(value * (1 - amount) + other[index]! * amount).toString(16).padStart(2, '0')).join('');
}
export function colorContrast(a: string, b: string): number {
  const luminance = (hex: string) => rgb(hex).reduce((sum, value, index) => {
    const channel = value / 255;
    return sum + (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4) * [ .2126, .7152, .0722 ][index]!;
  }, 0);
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
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
