import { describe, expect, it } from 'vitest';
import type { SkribNote } from '../../lib/geometry';
import {
  filterNotesForLifecycle,
  isTrashedNote,
  trashRetentionInfo,
  trashRetentionLabel,
  TRASH_RETENTION_SECONDS,
} from './trashLifecycle';

function note(id: string, deletedAt: number | null | undefined): SkribNote {
  const activeNote: SkribNote = {
    id,
    target_process_name: 'notepad.exe',
    target_title: 'Project — Notepad',
    rel_x: 0,
    rel_y: 0,
    width: 400,
    height: 340,
    text: id,
    color: 'yellow',
    collapsed: false,
    created_at: 1,
    updated_at: 2,
  };

  return deletedAt === undefined
    ? activeNote
    : { ...activeNote, deleted_at: deletedAt };
}

describe('trash lifecycle filtering', () => {
  const notes = [note('active-missing', undefined), note('active-null', null), note('trashed', 100)];

  it('separates active and trashed notes without mutating input', () => {
    expect(filterNotesForLifecycle(notes, 'notes').map((item) => item.id)).toEqual([
      'active-missing',
      'active-null',
    ]);
    expect(filterNotesForLifecycle(notes, 'trash').map((item) => item.id)).toEqual([
      'trashed',
    ]);
    expect(notes).toHaveLength(3);
  });

  it('treats any present deletion marker as trash for fail-safe visibility', () => {
    expect(isTrashedNote(note('zero', 0))).toBe(true);
    expect(isTrashedNote(note('future', 9_999_999_999))).toBe(true);
    expect(isTrashedNote(note('active', null))).toBe(false);
  });
});

describe('trash retention', () => {
  it('reports the full period at deletion time', () => {
    const info = trashRetentionInfo(1_000, 1_000);
    expect(info).toEqual({
      state: 'retained',
      deletedAt: 1_000,
      expiresAt: 1_000 + TRASH_RETENTION_SECONDS,
      daysRemaining: 30,
    });
    expect(trashRetentionLabel(info)).toBe('30 days remaining in Trash');
  });

  it('rounds a partial final day up for user-facing recovery time', () => {
    const expiresAt = 1_000 + TRASH_RETENTION_SECONDS;
    const info = trashRetentionInfo(1_000, expiresAt - 1);
    expect(info.daysRemaining).toBe(1);
    expect(trashRetentionLabel(info)).toBe('1 day remaining in Trash');
  });

  it('marks retention ended without automatically deleting anything', () => {
    const info = trashRetentionInfo(1_000, 1_000 + TRASH_RETENTION_SECONDS);
    expect(info.state).toBe('expired');
    expect(info.daysRemaining).toBe(0);
    expect(trashRetentionLabel(info)).toMatch(/review before permanent deletion/i);
  });

  it('handles future timestamps without negative ages', () => {
    const info = trashRetentionInfo(5_000, 1_000);
    expect(info.state).toBe('retained');
    expect(info.daysRemaining).toBeGreaterThan(30);
  });

  it('keeps invalid timestamps visible for manual review', () => {
    for (const invalid of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      const info = trashRetentionInfo(invalid, 1_000);
      expect(info.state).toBe('invalid');
      expect(info.expiresAt).toBeNull();
      expect(trashRetentionLabel(info)).toMatch(/kept until reviewed/i);
    }
  });
});
