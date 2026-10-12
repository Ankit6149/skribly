import { useSyncExternalStore } from 'react';

export const NOTE_FONTS = [
  { id: 'kalam', label: 'Kalam · handwriting', family: '"Kalam", "Segoe Print", cursive' },
  { id: 'dm-sans', label: 'DM Sans · clean', family: '"DM Sans", sans-serif' },
  { id: 'manrope', label: 'Manrope · modern', family: '"Manrope", sans-serif' },
  { id: 'system', label: 'System · familiar', family: '"Segoe UI", system-ui, sans-serif' },
  { id: 'serif', label: 'Georgia · classic', family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Consolas · monospace', family: 'Consolas, "Courier New", monospace' },
  { id: 'print', label: 'Segoe Print · handwriting', family: '"Segoe Print", "Kalam", cursive' },
] as const;
export type NoteFontId = (typeof NOTE_FONTS)[number]['id'];
const KEY = 'skribli.note-font.v1';
const EVENT = 'skribli-note-font-changed';
export function readNoteFont(): NoteFontId {
  try { const value = localStorage.getItem(KEY); return NOTE_FONTS.find((font) => font.id === value)?.id ?? 'kalam'; }
  catch { return 'kalam'; }
}
export function saveNoteFont(value: NoteFontId): void {
  if (!NOTE_FONTS.some((font) => font.id === value)) throw new Error('Unknown note font.');
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener); window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(EVENT, listener); };
}
export function useNoteFont() {
  const id = useSyncExternalStore(subscribe, readNoteFont, () => 'kalam');
  return NOTE_FONTS.find((font) => font.id === id)!;
}
