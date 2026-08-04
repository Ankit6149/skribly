import { describe, expect, it } from 'vitest';
import type { SkribNote } from '../../lib/geometry';
import {
  filterLibraryNotes,
  noteContextLabel,
  noteDisplayTitle,
  notePreview,
  sortLibraryNotes,
} from './libraryModel';

function note(
  id: string,
  options: Partial<SkribNote> = {}
): SkribNote {
  return {
    id,
    target_process_name: 'notepad.exe',
    target_title: 'Project brief — Notepad',
    rel_x: 0,
    rel_y: 0,
    width: 400,
    height: 340,
    text: id,
    color: 'yellow',
    collapsed: false,
    created_at: 1,
    updated_at: 1,
    ...options,
  };
}

describe('sortLibraryNotes', () => {
  it('orders by updated time, created time, then stable ID', () => {
    const notes = [
      note('z-last-id', { created_at: 20, updated_at: 30 }),
      note('newest', { created_at: 1, updated_at: 40 }),
      note('a-first-id', { created_at: 20, updated_at: 30 }),
      note('older-created', { created_at: 10, updated_at: 30 }),
    ];

    expect(sortLibraryNotes(notes).map((item) => item.id)).toEqual([
      'newest',
      'a-first-id',
      'z-last-id',
      'older-created',
    ]);
    expect(notes.map((item) => item.id)).toEqual([
      'z-last-id',
      'newest',
      'a-first-id',
      'older-created',
    ]);
  });
});

describe('filterLibraryNotes', () => {
  const notes = [
    note('roadmap', {
      text: 'Review launch roadmap',
      target_process_name: 'notepad.exe',
      target_title: 'Product plan — Notepad',
      updated_at: 20,
    }),
    note('browser', {
      text: 'Send final wording',
      target_process_name: 'chrome.exe',
      target_title: 'Client Portal',
      updated_at: 30,
    }),
  ];

  it('returns deterministic ordering for an empty query', () => {
    expect(filterLibraryNotes(notes, '  ').map((item) => item.id)).toEqual([
      'browser',
      'roadmap',
    ]);
  });

  it('searches note text, process, and context title case-insensitively', () => {
    expect(filterLibraryNotes(notes, 'ROADMAP').map((item) => item.id)).toEqual(['roadmap']);
    expect(filterLibraryNotes(notes, 'CHROME.EXE').map((item) => item.id)).toEqual(['browser']);
    expect(filterLibraryNotes(notes, 'client portal').map((item) => item.id)).toEqual(['browser']);
  });

  it('normalizes equivalent unicode forms', () => {
    const composed = note('unicode', { text: 'Café review' });
    expect(filterLibraryNotes([composed], 'Cafe\u0301').map((item) => item.id)).toEqual([
      'unicode',
    ]);
  });
});

describe('library display helpers', () => {
  it('uses the first meaningful line as the title', () => {
    expect(
      noteDisplayTitle(
        note('multiline', { text: '\n  First useful line  \nSecond line' })
      )
    ).toBe('First useful line');
  });

  it('falls back safely when note text is empty', () => {
    const empty = note('empty', { text: '', target_title: '', target_process_name: '' });
    expect(noteDisplayTitle(empty)).toBe('Untitled note');
    expect(noteContextLabel(empty)).toBe('Context unavailable');
    expect(notePreview(empty)).toBe('This note has no saved text.');
  });

  it('caps long titles and previews without exposing unbounded content', () => {
    const long = note('long', { text: 'word '.repeat(100) });
    expect(noteDisplayTitle(long).length).toBeLessThanOrEqual(80);
    expect(noteDisplayTitle(long).endsWith('…')).toBe(true);
    expect(notePreview(long).length).toBeLessThanOrEqual(180);
    expect(notePreview(long).endsWith('…')).toBe(true);
  });
});
