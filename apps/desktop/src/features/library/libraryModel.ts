import type { SkribNote } from '../../lib/geometry';

const MAX_DISPLAY_TITLE_CHARACTERS = 80;

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

export function sortLibraryNotes(notes: SkribNote[]): SkribNote[] {
  return [...notes].sort((left, right) => {
    if (right.updated_at !== left.updated_at) return right.updated_at - left.updated_at;
    if (right.created_at !== left.created_at) return right.created_at - left.created_at;
    return left.id.localeCompare(right.id);
  });
}

export function filterLibraryNotes(notes: SkribNote[], query: string): SkribNote[] {
  const ordered = sortLibraryNotes(notes);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return ordered;

  return ordered.filter((note) =>
    [note.text, note.target_process_name, note.target_title]
      .map(normalize)
      .some((value) => value.includes(normalizedQuery))
  );
}

export function noteDisplayTitle(note: SkribNote): string {
  const firstMeaningfulLine = note.text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  const fallback = note.target_title.trim() || note.target_process_name.trim() || 'Untitled note';
  const title = firstMeaningfulLine || fallback;

  if (title.length <= MAX_DISPLAY_TITLE_CHARACTERS) return title;
  return `${title.slice(0, MAX_DISPLAY_TITLE_CHARACTERS - 1).trimEnd()}…`;
}

export function noteContextLabel(note: SkribNote): string {
  return note.target_title.trim() || note.target_process_name.trim() || 'Context unavailable';
}

export function notePreview(note: SkribNote): string {
  const compact = note.text.replace(/\s+/gu, ' ').trim();
  if (!compact) return 'This note has no saved text.';
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 179).trimEnd()}…`;
}
