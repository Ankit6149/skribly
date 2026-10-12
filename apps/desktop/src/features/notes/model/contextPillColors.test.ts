import { describe, expect, it } from 'vitest';
import { NOTE_PALETTE } from './noteColors';
import { chooseContextPillColor } from './contextPillColors';

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/giu)!.map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}
function hue(hex: string) {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/giu)!.map((part) => parseInt(part, 16)) as [number, number, number];
  const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low;
  if (!delta) return null;
  const saturation = delta / (255 - Math.abs(high + low - 255));
  if (saturation < .2) return null;
  return ((high === r ? (g - b) / delta : high === g ? 2 + (b - r) / delta : 4 + (r - g) / delta) * 60 + 360) % 360;
}
function contrast(a: string, b: string) {
  const pair = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (pair[1]! + .05) / (pair[0]! + .05);
}

describe('random light note app pill', () => {
  it.each(NOTE_PALETTE)('offers distinct readable pills on $id notes without repeating the previous choice', (note) => {
    const choices = new Set<string>();
    for (let step = 0; step < 40; step++) {
      const pill = chooseContextPillColor(note.id, undefined, () => step / 40);
      choices.add(pill.id);
      expect(pill.id).not.toBe(note.id);
      expect(['black', 'charcoal']).not.toContain(pill.id);
      expect(luminance(pill.background)).toBeGreaterThanOrEqual(.45);
      expect(pill.background).not.toBe(note.background);
      const paperHue = hue(note.background), pillHue = hue(pill.background);
      if (paperHue !== null && pillHue !== null) {
        const distance = Math.abs(paperHue - pillHue);
        expect(Math.min(distance, 360 - distance)).toBeGreaterThanOrEqual(60);
      }
      expect(pill.iconFilter).toBe('brightness(0) invert(.34)');
      expect(contrast(pill.background, pill.foreground)).toBeGreaterThanOrEqual(3);
      expect(chooseContextPillColor(note.id, pill.id, () => step / 40).id).not.toBe(pill.id);
    }
    expect(choices.size).toBeGreaterThan(1);
  });
  it('excludes similar blue and purple shades on an indigo note', () => {
    for (let step = 0; step < 40; step++) {
      const pill = chooseContextPillColor('indigo', undefined, () => step / 40);
      expect(['cobalt', 'sky', 'azure', 'periwinkle', 'lavender', 'orchid']).not.toContain(pill.id);
    }
  });
});
