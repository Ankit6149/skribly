import { create } from 'zustand';

export type SkribComposerMode = 'type' | 'write';

interface SkribUiState {
  composerNoteId: string | null;
  composerMode: SkribComposerMode;

  openComposer: (noteId: string, mode?: SkribComposerMode) => void;
  closeComposer: () => void;
  setComposerMode: (mode: SkribComposerMode) => void;
}

export const useSkribUiStore = create<SkribUiState>((set) => ({
  composerNoteId: null,
  composerMode: 'type',

  openComposer: (noteId, mode = 'type') =>
    set({ composerNoteId: noteId, composerMode: mode }),
  closeComposer: () => set({ composerNoteId: null }),
  setComposerMode: (mode) => set({ composerMode: mode }),
}));
