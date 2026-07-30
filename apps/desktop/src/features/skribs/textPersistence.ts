import { invoke } from '@tauri-apps/api/core';
import { SkribNote } from '../../lib/geometry';
import { useSkribStore, OverlayStatePayload } from '../../stores/skribStore';
import { MAX_NOTE_CHARACTERS, countNoteCharacters } from './draftSaveController';

const pendingDrafts = new Map<string, string>();

function updateNoteInPlace(
  notes: SkribNote[],
  id: string,
  update: (note: SkribNote) => SkribNote
): SkribNote[] {
  let found = false;
  const next = notes.map((note) => {
    if (note.id !== id) return note;
    found = true;
    return update(note);
  });
  return found ? next : notes;
}

export function mergePersistedTextResult(
  notes: SkribNote[],
  persisted: SkribNote,
  pendingDraft?: string
): SkribNote[] {
  return updateNoteInPlace(notes, persisted.id, () => ({
    ...persisted,
    text: pendingDraft ?? persisted.text,
  }));
}

export function stageSkribDraft(id: string, text: string): void {
  pendingDrafts.set(id, text);
  const updatedAt = Math.floor(Date.now() / 1000);
  useSkribStore.setState((state) => ({
    skribs: updateNoteInPlace(state.skribs, id, (note) => ({ ...note, text, updated_at: updatedAt })),
    allSkribs: updateNoteInPlace(state.allSkribs, id, (note) => ({ ...note, text, updated_at: updatedAt })),
  }));
}

export function discardSkribDraft(id: string): void {
  pendingDrafts.delete(id);
}

export async function persistSkribText(id: string, text: string): Promise<boolean> {
  if (countNoteCharacters(text) > MAX_NOTE_CHARACTERS) {
    useSkribStore.setState({
      storageErrorMessage: `This note is longer than the ${MAX_NOTE_CHARACTERS.toLocaleString()} character limit.`,
    });
    return false;
  }

  const store = useSkribStore.getState();
  if (!store.isTauriAvailable) {
    if (pendingDrafts.get(id) === text) pendingDrafts.delete(id);
    return true;
  }

  try {
    const payload = await invoke<OverlayStatePayload>('update_skrib_text', { id, text });
    const persisted = payload.skribs.find((note) => note.id === id);
    if (!persisted) throw new Error('The saved note was missing from the native response.');

    const latestDraft = pendingDrafts.get(id);
    if (latestDraft === text) pendingDrafts.delete(id);
    const draftToPreserve = latestDraft !== undefined && latestDraft !== text ? latestDraft : undefined;

    useSkribStore.setState((state) => ({
      skribs: mergePersistedTextResult(state.skribs, persisted, draftToPreserve),
      allSkribs: mergePersistedTextResult(state.allSkribs, persisted, draftToPreserve),
      overlayMetrics: payload.overlay_metrics || state.overlayMetrics,
      initStatus: payload.init_status || state.initStatus,
      errorMessage: null,
      storageErrorMessage: null,
    }));
    void useSkribStore.getState().refreshStorageHealth();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    useSkribStore.setState({
      errorMessage: `Failed to save text: ${message}`,
      storageErrorMessage: `Failed to save text: ${message}`,
    });
    await useSkribStore.getState().refreshStorageHealth();
    return false;
  }
}
