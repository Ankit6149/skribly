# UX principle review evidence — 16 October 2026

This is source-review evidence, not installed acceptance. See the [full review](../../UX_PRINCIPLES_REVIEW_2026-10-16.md).

Baseline captures use synthetic local browser data and production components:

- `01-ready-before.png`: 1536 × 694; existing Ready hierarchy and shortcut.
- `02-widget-before.png`: 1536 × 694; expanded six-column ticket grid and search.
- `03-note-before.png`: 1536 × 694; wine note. DOM measurement: Type/Draw 24 px high, southeast resize 16 × 16, header buttons 32 × 32, Done 76 × 36. Note logo 32 px in a 48 px circle, already borderless in source.
- `04-android-before.png`: 390 × 844; empty library.
- `05-android-editor-before.png`: 390 × 844; empty yellow note. Existing main mobile actions measured at least 44 × 44 px.

Chrome review used isolated development origins on ports 1422 and 1423. Attempted final review timed out in browser controls twice, including reconnecting the existing tab. No successful after-state screenshot was captured. Do not use these before images to claim the final layout passed. Browser viewport override cleanup was also unavailable after the connection failed; no system display setting was changed.

Impeccable's static detector returned `[]` on the changed widget controls/styles, note styles, appearance settings and Android UI/styles. This checks source patterns, not rendered accessibility or WCAG conformance.

The read-only preview bridge is guarded to development localhost, refuses an existing native bridge and rejects mutation/import/window commands. Its test verifies those boundaries. Production entrypoints do not import the fixture. No native installer, Android package, backend, website or account release action was performed.
