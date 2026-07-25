import { create } from 'zustand';

export type SkribComposerMode = 'type' | 'write';

interface SkribUiState {
  previewNoteId: string | null;
  composerNoteId: string | null;
  composerMode: SkribComposerMode;
  isNotesWidgetOpen: boolean;
  widgetNoteId: string | null;

  openPreview: (noteId: string) => void;
  closePreview: () => void;
  openComposer: (noteId: string, mode?: SkribComposerMode) => void;
  closeComposer: () => void;
  setComposerMode: (mode: SkribComposerMode) => void;
  toggleNotesWidget: () => void;
  openNotesWidget: (noteId?: string | null) => void;
  closeNotesWidget: () => void;
  selectWidgetNote: (noteId: string | null) => void;
}

export const useSkribUiStore = create<SkribUiState>((set) => ({
  previewNoteId: null,
  composerNoteId: null,
  composerMode: 'type',
  isNotesWidgetOpen: false,
  widgetNoteId: null,

  openPreview: (noteId) =>
    set({ previewNoteId: noteId, composerNoteId: null }),
  closePreview: () => set({ previewNoteId: null }),
  openComposer: (noteId, mode = 'type') =>
    set({ composerNoteId: noteId, previewNoteId: null, composerMode: mode }),
  closeComposer: () => set({ composerNoteId: null }),
  setComposerMode: (mode) => set({ composerMode: mode }),
  toggleNotesWidget: () =>
    set((state) => ({ isNotesWidgetOpen: !state.isNotesWidgetOpen })),
  openNotesWidget: (noteId = null) =>
    set({ isNotesWidgetOpen: true, widgetNoteId: noteId }),
  closeNotesWidget: () => set({ isNotesWidgetOpen: false }),
  selectWidgetNote: (noteId) => set({ widgetNoteId: noteId }),
}));
