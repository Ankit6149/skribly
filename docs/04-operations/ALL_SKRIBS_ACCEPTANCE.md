# All Skribs acceptance contract

This document defines the implemented scope and required evidence for issue #126. It is a release-critical child of #21, #49, and #53; it does not close those parent outcomes.

## Product contract

Skribli has one shared desktop workspace plus its contextual overlay:

1. `main` — the transient compact contextual editor. It is borderless, topmost, taskbar-hidden, and shown only for onboarding, recovery, capture errors, or an explicit shortcut-open note request.
2. `home` — the decorated, resizable, taskbar-visible, non-topmost workspace. Home, All Skribs, Calendar, and the guide navigate inside this same window. The separate `library` HWND has been retired.

The library never becomes a floating widget, attached tab, dot, toolbar, or full-screen overlay.

## Entry and lifecycle

- The tray contains **All Skribs**, **Quick guide**, and **Quit Skribli**.
- **All Skribs** selects the library view inside the shared `home` window and brings that window forward.
- Repeated activation never creates another library window.
- Closing the workspace hides it to the tray. It must not open Home or any other window as a side effect.
- Hiding or closing the library does not quit Skribli, mutate a note, or alter the compact editor's active target.
- Focusing the library refreshes its data from the native `get_all_skribs` command.

## Read and search behavior

- The library loads every storage-backed note, independent of the compact editor's active target.
- Results are ordered by `updated_at` descending, then `created_at` descending, then note ID ascending.
- Search is Unicode-normalized, case-insensitive, and checks saved text, process name, and stored context title.
- Empty query results retain deterministic ordering.
- The result list and selected detail remain keyboard accessible.
- The detail view is intentionally read-only and remains available when the original application is closed, missing, elevated, or ambiguous.
- The library never silently launches, focuses, guesses, or re-anchors an external application.

## Export behavior

- **Export this note** sends one selected ID.
- **Export note records** sends `noteIds: null` and includes every current native text/metadata record, including an empty collection; it does not claim to export IndexedDB rich data.
- Export is a native operation and does not require note-write or licence-write access.
- The request accepts only a bounded request ID and optional note IDs.
- The native result contains only the request ID, output path, or error; it never echoes note content.
- Exports use schema version `1` and deterministic note ordering.
- Files are written under the application data `exports` directory with `create_new` semantics.
- An export can never overwrite `skribs.json`, recovery generations, or another export.
- Serialization, flush, or durability failures remove the incomplete file and return an actionable error.

## Explicit non-goals for this child

The following remain open in parent #21 or related issues:

- editing from the library;
- open-in-context, focus-target, detach, move, or re-anchor actions;
- archive, reversible trash, retention, restore, and permanent-delete cleanup;
- import preview, duplicate detection, migration, and rollback;
- attachment export/import portability;
- advanced filters and a scalable full-text index;
- opening the export folder in Explorer;
- final large-dataset and physical release evidence.

## Automated evidence

The exact PR revision must pass:

- deterministic frontend search/display tests;
- export request/result contract tests;
- native selected/all export, missing-ID, round-trip, and create-new tests;
- tray action classification tests;
- frontend type-check, tests, and production build;
- Rust formatting, Windows cargo check, complete Rust tests, and restricted configuration;
- repository governance and product-truth validation;
- site validation and applicable storage acceptance.

## Physical Windows acceptance matrix

Tie all evidence to the exact candidate executable and record screenshots or video where useful.

| Scenario | Required result |
| --- | --- |
| Start Skribli with no notes | Tray opens one empty normal library window with a clear first-note instruction. |
| Reopen from tray repeatedly | The same window is shown/focused; no duplicate process or library window appears. |
| Close with the title-bar X | Library hides, process remains, tray reopens it. |
| Create/edit a compact note, then return to library | Focusing or refreshing the library shows the latest durable text. |
| Original target application closed | Note remains readable; no application is launched or guessed. |
| Search text/process/context with mixed case and Unicode | Results are correct and deterministically ordered. |
| Keyboard-only use | Search, result navigation, detail reading, refresh, selected record export, all-record export, dismiss, and hide are reachable. |
| 200% text scaling and minimum window size | Controls, search, list, detail, and export feedback remain visible and operable. |
| High contrast and reduced motion | Focus and selection remain perceivable; no required information depends on motion or colour alone. |
| Read-only or expired mode | Every note remains readable and exportable; no mutation action is offered. |
| Selected export | Versioned JSON contains exactly the selected note and reports the path. |
| All-record export with zero/many notes | Versioned JSON succeeds, accurately records `noteCount`, and clearly states that drawings, attachments, and reminders are excluded. |
| Repeated export in the same millisecond | A new filename is created; existing files are unchanged. |
| Export write/serialization failure | An error is shown and no incomplete file is presented as successful. |
| Compact editor open while library is visible | Neither window replaces the other; library remains non-topmost and the editor lifecycle stays intact. |

## Parent status

Issue #126 may close only after this exact slice is merged with complete automated evidence. Issues #21, #49, and #53 remain open until their broader recovery, navigation, tray-state, data lifecycle, accessibility, performance, and physical release requirements are complete.
