import { describe, expect, it } from 'vitest';
import type { SkribNote } from '../../lib/geometry';
import { isOpenNoteRequest, selectRequestedNote } from './noteLifecycle';

function note(id: string): SkribNote {
  return {
    id,
    target_process_name: 'notepad.exe',
    target_title: 'Document.txt - Notepad',
    rel_x: 0,
    rel_y: 0,
    width: 400,
    height: 340,
    text: id,
    color: 'yellow',
    collapsed: false,
    created_at: 1,
    updated_at: 1,
  };
}

describe('open-note request validation', () => {
  it('accepts created and reopened requests', () => {
    expect(
      isOpenNoteRequest({ action: 'created', noteId: 'note-a', matchingNoteCount: 0 })
    ).toBe(true);
    expect(
      isOpenNoteRequest({ action: 'reopened', noteId: 'note-a', matchingNoteCount: 2 })
    ).toBe(true);
  });

  it('rejects malformed or privacy-unsafe payloads', () => {
    expect(isOpenNoteRequest(null)).toBe(false);
    expect(isOpenNoteRequest({ action: 'open', noteId: 'note-a', matchingNoteCount: 1 })).toBe(
      false
    );
    expect(isOpenNoteRequest({ action: 'created', noteId: '', matchingNoteCount: 0 })).toBe(false);
    expect(
      isOpenNoteRequest({
        action: 'reopened',
        noteId: 'note-a',
        matchingNoteCount: -1,
        targetTitle: 'private title',
      })
    ).toBe(false);
  });
});

describe('requested note selection', () => {
  it('opens only the exact native-requested note', () => {
    const notes = [note('older'), note('requested'), note('newer')];
    const selected = selectRequestedNote(
      { action: 'reopened', noteId: 'requested', matchingNoteCount: 3 },
      notes
    );

    expect(selected?.id).toBe('requested');
  });

  it('waits when the state payload has not arrived yet', () => {
    expect(
      selectRequestedNote(
        { action: 'created', noteId: 'new-note', matchingNoteCount: 0 },
        [note('existing')]
      )
    ).toBeNull();
  });

  it('does nothing without an explicit request', () => {
    expect(selectRequestedNote(null, [note('note-a')])).toBeNull();
  });
});
