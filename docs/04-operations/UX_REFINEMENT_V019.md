# v0.1.19 — coherent workspace, contextual opening, and reliable inline ink

Issue: #184

## Product changes

- Home, All Skribs, Calendar, Trash, the guide, rail access, and account status now live inside one persistent desktop workspace. Navigation retains the current destination and no longer swaps between unrelated full-page structures.
- The shell follows the accepted website-derived type, cream base, restrained pastel accents, circular icon controls, and local-first product voice. Kalam remains reserved for note content.
- Opening a note at its saved context now reports each real stage: protecting the current draft, checking live windows, launching the target application when needed, matching the stored window title, and unfolding the note.
- A matching live target is still required for exact restoration. A closed application can be launched, but Skribli does not claim it can recreate a closed browser tab, editor folder, or File Explorer path that was never stored.

## Inline Draw changes

- The drawing canvas is resized at device pixel density whenever the note changes size, eliminating fixed-bitmap stretching and improving mouse, touchpad, touch, and pen rendering.
- Pointer coalescing produces smoother strokes. Selection now hit-tests full line segments instead of only sampled points.
- Selected strokes can be dragged or removed. Undo and redo cover drawing, movement, deletion, and clear actions; Ctrl+Z, Ctrl+Shift+Z, Delete, and Backspace work when the canvas has focus.
- Drawing remains layered over typed content. Its compact toolbar reserves writing space and scrolls horizontally on small note widths rather than covering the note.
- Inline ink is stored with the note. The overlay no longer offers a second “save preview” attachment action.

## Verification contract

- Frontend typecheck, production build, tests, theme validation, compact-surface validation, repository validation, and Rust checks must pass on the exact release candidate.
- The private installer workflow must build the exact committed candidate before the encrypted owner-download asset is updated.
- Visual installed-app acceptance remains with the owner, per the request not to drive or test the installed application in this pass.
