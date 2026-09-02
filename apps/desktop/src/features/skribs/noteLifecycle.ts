import type { SkribNote } from '../../lib/geometry';

export type OpenNoteAction = 'created' | 'reopened' | 'detached';

export interface OpenNoteRequest {
  action: OpenNoteAction;
  noteId: string;
  matchingNoteCount: number;
}

const OPEN_NOTE_REQUEST_KEYS = new Set(['action', 'noteId', 'matchingNoteCount']);

export function isOpenNoteRequest(value: unknown): value is OpenNoteRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !OPEN_NOTE_REQUEST_KEYS.has(key))) return false;

  return (
    (record.action === 'created' || record.action === 'reopened' || record.action === 'detached') &&
    typeof record.noteId === 'string' &&
    record.noteId.length > 0 &&
    Number.isInteger(record.matchingNoteCount) &&
    (record.matchingNoteCount as number) >= 0
  );
}

export function selectRequestedNote(
  request: OpenNoteRequest | null,
  notes: SkribNote[]
): SkribNote | null {
  if (!request) return null;
  return notes.find((note) => note.id === request.noteId) ?? null;
}
