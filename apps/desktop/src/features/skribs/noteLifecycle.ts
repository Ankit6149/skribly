import type { SkribNote } from '../../lib/geometry';

export type OpenNoteAction = 'created' | 'reopened';

export interface OpenNoteRequest {
  action: OpenNoteAction;
  noteId: string;
  matchingNoteCount: number;
}

export function isOpenNoteRequest(value: unknown): value is OpenNoteRequest {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<OpenNoteRequest>;
  return (
    (candidate.action === 'created' || candidate.action === 'reopened') &&
    typeof candidate.noteId === 'string' &&
    candidate.noteId.length > 0 &&
    Number.isInteger(candidate.matchingNoteCount) &&
    (candidate.matchingNoteCount ?? -1) >= 0
  );
}

export function selectRequestedNote(
  request: OpenNoteRequest | null,
  notes: SkribNote[]
): SkribNote | null {
  if (!request) return null;
  return notes.find((note) => note.id === request.noteId) ?? null;
}
