import { describe, expect, it } from 'vitest';
import { contextTagColor } from './contextTagColor';

describe('context tag pastel', () => {
  const colors = ['yellow', 'peach', 'mint', 'sky', 'lavender', 'rose', 'aqua', 'sand'];
  it('never matches the paper, including after a paper colour change', () => {
    for (let index = 0; index < 64; index += 1) {
      for (const paper of colors) {
        const tag = contextTagColor(`note-${index}`, paper);
        expect(colors).toContain(tag);
        expect(tag).not.toBe(paper);
      }
    }
  });
  it('varies between notes but stays stable when reopened', () => {
    const choices = Array.from({ length: 64 }, (_, index) => contextTagColor(`note-${index}`, 'yellow'));
    expect(new Set(choices).size).toBe(7);
    expect(choices).toEqual(Array.from({ length: 64 }, (_, index) => contextTagColor(`note-${index}`, 'yellow')));
  });
});
