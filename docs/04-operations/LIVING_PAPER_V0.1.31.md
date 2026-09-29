# Living Paper v0.1.31 — local owner candidate

## Design decision

The visual target is **A · Living Paper on `site/interface-directions.html`**, not the separate Living Paper experiment. The resting note keeps its place tag, text, Add gateway and Done action visible; further controls appear only when requested. The tag remains a distinct pastel from the note, and the original Skribli mark and Kalam handwriting are retained.

This pass replaces the top-left circular completion tick with a plainly labelled Done action at lower right, evens the note corners and reduces the lower-right resize-corner curvature. Add has a labelled entry for the complete attachment collection; saved photos/videos/files still appear inline at the writing position. If an inline placement is rejected, the file remains saved and the collection opens so the owner can place it again. The contextual in-app indicator now uses the global widget's yellow/peach/lavender colour sequence rather than a generic dot. Editing has explicit Undo/Redo in More plus Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z for text and inline-object edits. No website/mock page is changed.

## Verification and limits

- Frontend: 219 tests across 39 files; TypeScript and production build pass.
- Compact, theme and React runtime validators pass.
- New tests cover inline-object undo/redo and the saved-file fallback when inline placement fails.
- Actual WebView layout, drag, hover, native positioning, drawing and installer upgrade must still be checked by the owner on the packaged build. Automated tests are not a substitute for that acceptance.
- Attachments and rich formatting are local device data and are not included in portable JSON exports. Avoid downgrading after writing inline attachments because old builds can strip placement metadata.
- The installer is unsigned; Windows SmartScreen can still show an unrecognised-app warning. This pass does not change licensing, payments or code signing.

## Package

The local NSIS installer is `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.31/Skribli_0.1.31_x64-setup.exe` (3,487,632 bytes). SHA-256: `48B7B846E7C16F8FD4BFD43CA26907DED330DD5562209DB004C3566DE0589685`. Authenticode status: `NotSigned`. This is a local owner-testing package, not a website release or a pushed GitHub change.

## Owner acceptance

On the exact v0.1.31 installer: open a new and an existing note; verify all four corners, Done at lower right and the tag on a small/medium note; add an image, video and document, then reopen and check each appears in text and in **All files**; test undo/redo after typing, highlighting, checklist and inline attachment; open/close the colour rail; hover/click the compact in-app indicator and confirm the native window remains inside its owning app. Check existing account and notes survive the upgrade. Do not mark visual/runtime acceptance complete before this check.
