import type { CSSProperties } from 'react';
import { readableMutedInk } from '../../../ui/colorContrast';

export const NOTE_PALETTE = [
  { id: 'yellow', background: '#f9df5b', foreground: '#171b18' },
  { id: 'peach', background: '#ffb792', foreground: '#171b18' },
  { id: 'mint', background: '#a9dfb6', foreground: '#171b18' },
  { id: 'sky', background: '#a8c7f4', foreground: '#171b18' },
  { id: 'lavender', background: '#c6acf0', foreground: '#171b18' },
  { id: 'rose', background: '#f5a9bf', foreground: '#171b18' },
  { id: 'aqua', background: '#96ddd2', foreground: '#171b18' },
  { id: 'sand', background: '#e6c18e', foreground: '#171b18' },
  { id: 'green', background: '#1cac43', foreground: '#101b11' },
  { id: 'orange', background: '#fa6c2b', foreground: '#191910' },
  { id: 'lime', background: '#d8f64a', foreground: '#161c12' },
  { id: 'olive', background: '#96a75c', foreground: '#11180d' },
  { id: 'charcoal', background: '#292c25', foreground: '#edf4be' },
  { id: 'cobalt', background: '#637fea', foreground: '#111928' },
  { id: 'cream', background: '#e7e4b3', foreground: '#171b18' },
  { id: 'red', background: '#ee3033', foreground: '#17100f' },
  { id: 'stone', background: '#d3d0bf', foreground: '#171b18' },
  { id: 'wine', background: '#8c2937', foreground: '#fff0d8' },
  { id: 'black', background: '#20211f', foreground: '#e9ebd6' },
  { id: 'coral', background: '#ff836c', foreground: '#171b18' },
  { id: 'lemon', background: '#ffe750', foreground: '#171b18' },
  { id: 'amber', background: '#ffbf53', foreground: '#171b18' },
  { id: 'apricot', background: '#ffb46b', foreground: '#171b18' },
  { id: 'sage', background: '#bbcd80', foreground: '#171b18' },
  { id: 'teal', background: '#49c5ba', foreground: '#102321' },
  { id: 'turquoise', background: '#53dcd7', foreground: '#102321' },
  { id: 'azure', background: '#79b6f2', foreground: '#111b2a' },
  { id: 'periwinkle', background: '#a0a1f3', foreground: '#17172c' },
  { id: 'orchid', background: '#d29be6', foreground: '#211626' },
  { id: 'pink', background: '#ff95cf', foreground: '#211620' },
  { id: 'ruby', background: '#a52c51', foreground: '#fff0d8' },
  { id: 'indigo', background: '#3c4192', foreground: '#f4f1df' },
] as const;

export type NoteColor = (typeof NOTE_PALETTE)[number]['id'];
export const NOTE_COLORS = NOTE_PALETTE.map(({ id }) => id);
// Put the selected ticket palette first without changing persisted colour IDs.
const FEATURED_NOTE_COLORS: readonly NoteColor[] = [
  'green', 'orange', 'lime', 'olive', 'charcoal', 'cobalt',
  'cream', 'red', 'stone', 'wine', 'black',
  'coral', 'lemon', 'amber', 'teal', 'turquoise', 'ruby', 'indigo',
];
export const NOTE_COLOR_GROUPS = [
  { label: 'Vivid', colors: FEATURED_NOTE_COLORS },
  { label: 'Pastel', colors: NOTE_COLORS.filter((color) => !FEATURED_NOTE_COLORS.includes(color)) },
];
export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && NOTE_COLORS.some((color) => color === value);
}

const NOTE_HINTS = new Map(NOTE_PALETTE.map((paper) => [paper.id, readableMutedInk(paper.background, paper.foreground)]));

export function noteColorStyle(color: NoteColor): CSSProperties {
  const paper = NOTE_PALETTE.find(({ id }) => id === color) ?? NOTE_PALETTE[0];
  return {
    '--note-paper': paper.background,
    '--note-foreground': paper.foreground,
    '--note-placeholder': NOTE_HINTS.get(paper.id),
    '--skribli-paper': paper.background,
    '--skribli-ink': paper.foreground,
    '--skribli-muted': `color-mix(in srgb, ${paper.foreground} 85%, ${paper.background})`,
    '--ribbon-tint': paper.background,
  } as CSSProperties;
}
