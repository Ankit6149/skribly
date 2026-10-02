# Notes feature

This directory is the canonical home for the note editor and note-specific frontend domain logic.

Current ownership:

- `SkribComposer.tsx` — note lifecycle/state coordinator for the active editor;
- `components/` — composer sub-surfaces, rich text, ink, attachments, confirmations, collapsed note surface, and window controls;
- `lifecycle/` — save/delete/open lifecycle state and rules;
- `model/` — canonical Skrib note types plus context, ink, inline-attachment and temporary-surface models;
- `persistence/` — note-specific frontend persistence coordination and rich-content IndexedDB storage;
- `state/` — note/runtime Zustand state and note-window UI state;
- `styles/` — note-owned desktop styles.

The former `features/skribs/` compatibility namespace has been removed. New note/editor code belongs here.
