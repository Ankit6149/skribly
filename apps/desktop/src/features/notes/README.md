# Notes feature

This directory is the canonical home for note **domain and feature logic** as the legacy `features/skribs/` folder is decomposed.

Current ownership:

- `components/` — presentational note shell pieces such as place metadata, save state, confirmations, and window controls;
- `lifecycle/` — save/delete/open lifecycle state and rules;
- `model/` — canonical Skrib note types plus context, ink, inline-attachment and temporary-surface models;
- `persistence/` — note-specific frontend persistence coordination and rich-content IndexedDB storage;
- `state/` — note/runtime Zustand state and note-window UI state.

The legacy `features/skribs/SkribComposer.tsx` remains the note lifecycle/state coordinator during migration. Presentational shell pieces now live under `features/notes/components/`; compatibility exports remain for older model/persistence paths.
