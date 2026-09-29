# Reopen flow — 18 September 2026

Status: implemented and automatically checked in the Desktop checkout; uncommitted, unpushed and unreleased. Baseline `43c298b`, product version v0.1.26 unchanged. No claim of physical Windows acceptance.

## Findings and corrections

1. **Open Here used the wrong rail.** The native command always selected the global rail, even when invoked by the app-context list. It now uses the native calling window identity to choose the initiating rail; other callers retain the existing global fallback. The saved note's application, title and relative anchor are not rewritten.
2. **Tool sizing could move a detached note back to the rail.** Detached size transitions now use the note window's current position, monitor work area and DPI. They preserve its top-left position when there is room and clamp only when growth would exceed usable screen bounds. A manually moved note no longer deliberately re-docks on tool open/close.
3. **Small saved notes were enlarged on reopen.** The detached placement calculator now respects the existing 320 × 260 minimum rather than forcing the default 420 × 360 size. It chooses the side of a central rail with more usable room.
4. **Delayed actions could affect a newer app context.** Open Here carries the initiating arrival revision across its draft-save handoff. A hidden or changed context rejects that action with an actionable message instead of opening in an unrelated position. Expand/collapse also carries its captured revision and ignores requests from older arrivals; existing callers without a revision remain supported.
5. **Draft handoff coverage was incomplete.** Added checks for request identity, timeout disposal, context revision forwarding and native rejection. Existing final-save-before-switch behavior is retained rather than bypassed.

## Evidence

- `npm run typecheck`: passed.
- `npm test`: 32 files, 184 tests passed.
- Native tests: 159 library + 3 executable + 37 migration/integration = 199 passed.
- Native geometry regressions cover manually moved notes at 100/125/150/200% DPI, negative monitor origins, constrained work areas, central rails and small saved dimensions.
- `npm run build`: passed, including React runtime, theme and compact-surface validators. Existing large-bundle warning remains.
- Product-truth, note lifecycle, library, Trash, migration fixture, portable import, governance and site validators: passed.
- Rust formatting and whitespace checks: passed.
- The existing Graphify map helped locate the placement/lifecycle code; the current source was checked directly because the map predates these local passes.
- The Desktop checkout now has its npm dependencies installed. No private environment settings, production credentials or owner note data were copied into it.

## Runtime acceptance still required

Use an isolated owner-test candidate and non-sensitive fixtures, with exact binary identity recorded:

1. Save a note in a supported application. Confirm the quiet presence appears after Done, reveals the count briefly and settles.
2. Open its context list, then Open Here. Confirm the real note opens beside that list, including on a second display; the list remains accessible.
3. Move the note, open and close Reminder/Draw, and resize it. Confirm it stays at the moved position except for necessary work-area clamping and retains the saved context anchor.
4. Repeat from the global rail at both edges and at mixed DPI.
5. Delay saving while switching the foreground app. Confirm the stale click does not open the old note beside the new context; no draft is lost.
6. Switch between relevant apps, Home, minimized/closed targets and detached reads. Confirm the contextual presence never leaves an invisible blocking area or an unrelated-app overlay.
7. Test failed writes, rapid requests from both lists, suspend/resume and compositor/background recovery before release acceptance.

No app was launched or installed in this pass. Native unit tests and compilation do not verify live HWND interaction, focus, animation smoothness, rendering artifacts or every cross-window race. Broader site-level matching, note-default preferences, tool-size crash recovery and remaining refinement acceptance are still open.

## Scope and recovery

Theme, website, account/session, note storage schema, licensing, installer and release configuration are unchanged by this pass. There is no migration or new background polling. All changes are in `C:/Users/ANKIT BHARDWAJ/Desktop/skribli-desktop`; the older working checkout is no longer the latest editable copy. Restore only the reviewed changes from this pass if rolling back; do not reset the whole dirty checkout, which also contains the two earlier refinement passes.
