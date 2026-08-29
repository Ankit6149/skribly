import type { SkribNote, TargetWindowInfo } from '../../lib/geometry';

export interface NoteGroup {
  key: string;
  label: string;
  notes: SkribNote[];
}

export function applicationLabel(processName: string): string {
  const base = processName.replace(/\.exe$/iu, '').replace(/[-_]+/gu, ' ').trim();
  if (!base) return 'Application';
  return base.replace(/\b\p{L}/gu, (character) => character.toUpperCase());
}

export function contextMatchScore(note: SkribNote, target: TargetWindowInfo): number {
  if (note.target_process_name.toLowerCase() !== target.process_name.toLowerCase()) return 0;
  const noteTitle = note.target_title.trim().toLowerCase();
  const targetTitle = target.title.trim().toLowerCase();
  if (!noteTitle || !targetTitle) return 50;
  if (noteTitle === targetTitle) return 100;
  if (noteTitle.includes(targetTitle) || targetTitle.includes(noteTitle)) return 75;
  return 0;
}

export function groupNotesForRail(notes: SkribNote[]): NoteGroup[] {
  const groups = new Map<string, SkribNote[]>();
  for (const note of notes.filter((item) => item.deleted_at == null)) {
    const key = note.target_process_name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), note]);
  }
  return [...groups.entries()]
    .map(([key, grouped]) => ({
      key,
      label: applicationLabel(grouped[0]?.target_process_name ?? key),
      notes: grouped.sort((left, right) => right.updated_at - left.updated_at),
    }))
    .sort((left, right) => right.notes[0]!.updated_at - left.notes[0]!.updated_at);
}
