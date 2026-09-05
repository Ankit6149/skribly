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
- Rust formatting and all 143 native library tests pass (existing dead-code warnings remain informational).
- Windows build [33959140835](https://github.com/Ankit6149/skribly/actions/runs/33959140835) passed against `b321e7bcbbbff49cdf9b1c37ff89dbbcd7586ad0`.
- Owner installer: `Skribli_0.1.17_x64-setup.exe`, 3,476,596 bytes; SHA-256 `e54ec5efebeedb8cb21a81ff29e23b8dc73671c76a7114b2f2774f6f15a082ce`.
- Package identity, icon matching, installer target, manifest, and checksum checks passed. GitHub's noninteractive Windows session could not provide visual acceptance; the installed experience remains the owner's acceptance step.
