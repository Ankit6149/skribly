import { NOTE_PALETTE, type NoteColor } from './noteColors';

// Light shared-palette accents; darkness belongs to the mark, never the circle.
const CONTEXT_PILL_PALETTE = NOTE_PALETTE.filter(({ background }) => luminance(background) >= .45);
type ContextPillColor = (typeof CONTEXT_PILL_PALETTE)[number]['id'];

function rgb(hex: string) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return r! * .2126 + g! * .7152 + b! * .0722;
}

function hueAndSaturation(hex: string) {
  const [r, g, b] = rgb(hex) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  if (!delta) return { hue: 0, saturation: 0 };
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { hue: (hue * 60 + 360) % 360, saturation: delta / (1 - Math.abs(max + min - 1)) };
}

export function chooseContextPillColor(noteColor: NoteColor, previous?: ContextPillColor, random = Math.random) {
  const paper = NOTE_PALETTE.find(({ id }) => id === noteColor)!;
  const noteHue = hueAndSaturation(paper.background);
  const candidates = CONTEXT_PILL_PALETTE.filter((candidate) => {
    if (candidate.id === noteColor || candidate.id === previous) return false;
    const candidateHue = hueAndSaturation(candidate.background);
    const hueDistance = Math.abs(noteHue.hue - candidateHue.hue);
    const differentHue = noteHue.saturation < .2 || candidateHue.saturation < .2 || Math.min(hueDistance, 360 - hueDistance) >= 60;
    return differentHue;
  });
  // Every paper has multiple light, distinct-hue choices (covered by palette tests).
  const chosen = candidates[Math.floor(random() * candidates.length)] ?? candidates[0]!;
  return { ...chosen, iconFilter: 'brightness(0) invert(.26)' };
}

// Transient appearance only; never modify a saved note's selected paper colour.
const lastPillByNote = new Map<string, ContextPillColor>();
export function previousContextPillColor(noteId: string) {
  return lastPillByNote.get(noteId);
}
export function rememberContextPillColor(noteId: string, color: ContextPillColor) {
  lastPillByNote.delete(noteId);
  lastPillByNote.set(noteId, color);
  if (lastPillByNote.size > 100) lastPillByNote.delete(lastPillByNote.keys().next().value!);
}
