# v0.1.17 — expressive notes and desktop context

## Owner feedback completed

- Medium notes retain the core writing tools without opening separate tabs.
- One expand/restore control replaces the three-state size menu; every corner supports direct native resizing and the chosen geometry is saved.
- Typed content supports bold, persistent highlighting, bullets, numbered lists, and checklists.
- Images copied to the clipboard become local attachments; formatted and plain text paste directly into the note.
- The in-note attachment affordance is subtle, while saved images, video, and documents use the approved visual-object treatment from Interface Lab.
- Drawing remains over the typed note and now gives the highlighter its own restrained pastel palette.
- The note paper palette includes rose, aqua, and sand in addition to the original five website pastels.
- The collapsed My Skribs rail supports both drag and double-click-and-hold pickup, then uses the existing native edge magnet on release.
- Hover copy now uses Skribli's product voice and explains open, move, return-to-context, refresh, and collapse actions.
- The Windows desktop (`Progman`/`WorkerW` owned by Explorer) is accepted as a real Skrib context while taskbar and system surfaces remain blocked.

## Safety and compatibility

- Canonical plain note text still powers search, export, limits, recovery, and the native library.
- Rich formatting and attachments remain local in IndexedDB and are serialized per note to avoid concurrent-write loss.
- Invalid imported colors remain rejected; the accepted color allowlist is shared by TypeScript, Rust, theme validation, and import validation.
- No rejected Interface Lab navigation or layout experiments were copied into the production app.

## Verification record

- TypeScript typecheck passes.
- 160 frontend and behavior tests pass.
- Production Vite build and compact/theme contracts pass.
- Rust formatting and native tests pass (existing dead-code warnings remain informational).
- Installed Windows behavior remains an owner acceptance step after the signed/encrypted installer is published.
