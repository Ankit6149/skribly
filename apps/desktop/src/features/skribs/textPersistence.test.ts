import { describe, expect, it } from 'vitest';
import { SkribNote } from '../../lib/geometry';
import { mergePersistedTextResult } from './textPersistence';

function note(id: string, text: string): SkribNote {
  return {
    id,
    target_process_name: 'notepad.exe',
    target_title: `${id} - Notepad`,
    rel_x: 0,
    rel_y: 0,
    width: 400,
    height: 340,
    text,
    color: 'yellow',
    collapsed: false,
    created_at: 1,
    updated_at: 1,
  };
}

describe('mergePersistedTextResult', () => {
  it('updates only the persisted note without reordering unrelated notes', () => {
    const first = note('first', 'one');
    const edited = note('edited', 'old');
    const last = note('last', 'three');
    const persisted = { ...edited, text: 'saved', updated_at: 2 };

    const result = mergePersistedTextResult([first, edited, last], persisted);

    expect(result.map((entry) => entry.id)).toEqual(['first', 'edited', 'last']);
    expect(result[0]).toBe(first);
    expect(result[2]).toBe(last);
    expect(result[1]).toEqual(persisted);
  });

  it('preserves a newer pending draft over an older persistence response', () => {
    const edited = note('edited', 'local');
    const persisted = { ...edited, text: 'older response', updated_at: 2 };

    const result = mergePersistedTextResult([edited], persisted, 'newest draft');

    expect(result[0].text).toBe('newest draft');
    expect(result[0].updated_at).toBe(2);
  });
});
