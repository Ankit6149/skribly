# Note ribbons and inline attachments — 20 September 2026

## Request and implementation

Owner requested Direction A refinements: a contrasting pastel context tag at upper right, Add/More icon ribbons, labels on hover, a horizontal colour sub-ribbon, movable inline attachments and a separate collapsible tray. The final refinement replaces fixed rose with UUID-derived pastel variation: stable across reopening, always different from the current paper, without new stored data.

Implemented in the existing local Desktop checkout; website and mock pages are unchanged. Original logo, pastel note colours and Kalam body remain. Source is the existing combined local v0.1.29 candidate plus this change, not a pushed/merged PR or public release.

Attachments use an additive ID reference inside existing formatted HTML. Previews resolve only against that note's own local attachments. Live blob URLs, image markup and button labels are excluded from saved HTML/plain text. Clipboard HTML cannot inject references. Moving an attachment keeps its file identity and typed text; removing it from text keeps the tray copy. Old files are not automatically inserted or reordered.

The tray now shows all files in a bounded grid with Place in note, Save copy and confirmed Remove. Newly added files appear inline without automatically opening the tray or enlarging the note. Drawing mode blocks file placement/removal until back in writing mode.

## Verification and limits

- 216 frontend tests across 38 files passed. New DOM tests cover inserting at a saved caret, formatted HTML/reference serialization, reopening, reference-only removal, read-only insertion, text extraction, safe same-note drag payloads, paragraph movement, Add/More actions, colour reveal and layered Escape/focus. Colour selection tests cover all paper colours, stable reopening and variation across notes.
- Repository persistence test proves HTML positions and files survive repository reopening and reference-only removal retains the attachment.
- TypeScript, production build, product/lifecycle/Trash/import and governance/theme/compact validators passed. Known bundle-size and native dead-code warnings are not fixed by this pass.
- jsdom is a development-only dependency for actual DOM interaction regression tests; it is not bundled with the app.
- No native interaction implementation changed in this follow-up. All 208 native tests passed (168 + 3 + 37). Installer/static branding evidence is recorded after packaging below.
- No installation, live browser/app launch or visual QA was run, following the owner's test boundary. DOM tests do not prove WebView pointer dragging, hover timing, screenshot fidelity, mixed DPI or compositor behaviour.

## Owner acceptance

Test the tag/ribbons at minimum and medium note sizes, keyboard focus, hover palette and Escape; add image/video/document in text, drag the handle to another text location, reopen and verify its position; try paragraph movement buttons; remove from text only and place it again from the tray; expand/collapse the all-files tray; confirm file deletion; retry after a save error; use drawing and reminders with existing content. Keep acceptance open until these pass.

Rollback: no database migration occurs. Older builds can still list files but may strip inline ID placement when editing formatted text. Do not downgrade if retaining new inline placements is important. Existing native JSON export does not back up attachments/rich HTML.

## Local package

Built 20 September 2026 from the local working copy into NSIS EXE and MSI; copied to `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.30`. Static Windows branding verified against the original icon in `artifacts/private-test-v0.1.30/branding-evidence.json`. The installed payload was not launched or visually inspected. The NSIS installer has no Authenticode signature; Windows SmartScreen may warn.

- EXE SHA-256: `CC6011B79C643BD1147FFC7E8B18333930B48E9BA594F2CE367B6737A7439269`
- MSI SHA-256: `755632C0E1DA43EE005E60806ED52EC06D7245A0F71117A6DDAFD6C436D13315`
- Source remains in the local dirty checkout; this follow-up is not yet committed or merged on GitHub.
