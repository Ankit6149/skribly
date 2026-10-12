// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readNoteFont, saveNoteFont } from './noteFonts';
beforeEach(() => localStorage.clear());
describe('note font preferences', () => {
  it('defaults to Kalam and retains a normal font across reads', () => {
    expect(readNoteFont()).toBe('kalam');
    saveNoteFont('system'); expect(readNoteFont()).toBe('system');
  });
  it('ignores invalid preferences without rewriting storage', () => {
    localStorage.setItem('skribli.note-font.v1','unexpected');
    expect(readNoteFont()).toBe('kalam');
    expect(localStorage.getItem('skribli.note-font.v1')).toBe('unexpected');
  });
});
