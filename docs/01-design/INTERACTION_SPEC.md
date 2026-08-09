# Current Windows interaction specification

> **Status:** canonical Founder Alpha interaction contract. This document describes the compact Windows typed-note product that exists today. Full-screen overlays, persistent dots/tabs, drawing tools, browser DOM anchoring, and macOS behavior are deferred and are not release requirements.

## Application lifecycle

- Skribli runs as one background process, one tray icon, one global shortcut registration, and one Windows event-hook set per user session.
- Launching Skribli again signals the existing process through the same note-opening path.
- Closing the compact editor or All Skribs hides that window. **Quit Skribli** in the tray exits the process.
- The first successful launch shows a three-step guide. **Quick guide** in the tray reopens it without creating a sample note.

## Open or create a contextual note

1. Focus a supported Windows application.
2. Press **Ctrl + Shift + Space**.
3. Skribli captures the foreground window once, clears any previous runtime target, and revalidates the HWND and process identity before note access.
4. Zero active matches creates one note; one match reopens it; legacy duplicate matches select the most recently updated note deterministically.
5. The compact editor opens inside the target monitor's usable work area and identifies the flow as **NEW SKRIB FOR** or **REOPENED SKRIB FOR**.

If capture, identity, placement, native validation, or persistence fails, Skribli opens no note and presents one privacy-safe recovery message. It never falls back to a stale target.

## Type and save

- Typing updates a local draft immediately.
- Native writes are serialized per active note; rapid edits coalesce into the latest pending draft.
- The editor reports **Unsaved**, **Saving**, **Saved**, or **Save failed** truthfully.
- A failed save keeps the exact draft visible and provides **Retry saving**.
- The current typed-note limit is 20,000 Unicode characters.
- **Done**, **Escape**, **Ctrl + Enter**, Close, and editor blur flush the latest draft before the compact window hides.
- The editor remains visible when the final save is not durable.

## Reposition

- Skribli calculates placement from the target monitor's work area and DPI before every show.
- The compact editor does not follow an application as a persistent overlay after it hides.
- **Reposition** recalculates a safe placement when the user needs it.
- Unsupported geometry fails closed instead of placing an unreachable window.

## Delete and Trash

- Closing an untouched whitespace-empty note discards that empty record.
- **Move to Trash** is the ordinary delete action for a saved note and requires confirmation.
- A trashed note keeps its ID, text, context, lifecycle metadata, and export representation.
- Trashed notes do not reopen through the global shortcut and cannot be edited or re-anchored.
- All Skribs can restore the same record from Trash.
- Permanent deletion is available only inside Trash after note-specific confirmation and successful durable persistence.
- The interface explains a 30-day recovery period; the current build does not silently auto-purge expired items.

## All Skribs

- **All Skribs** in the tray opens one normal, non-floating library window.
- Search is Unicode-normalized and case-insensitive across note text and stored context fields.
- Results use deterministic updated/created/ID ordering.
- Notes and Trash remain readable and exportable in read-only storage or licence states.
- Export supports one selected note or one complete versioned JSON backup without overwriting an existing file.
- Closing the window hides the same instance instead of quitting Skribli.

## Portable import

1. Choose **Import JSON** in All Skribs.
2. Skribli strictly validates the current portable schema without mutating local data.
3. Preview reports active/Trash counts, new records, exact duplicates, stable-ID conflicts, and bounded details.
4. **Skip conflicts** is the safe default; replacing the same IDs is explicit.
5. Apply is rejected if the selected file fingerprint or local storage revision changed after preview.
6. Before mutation, Skribli writes and verifies a complete rollback backup.
7. Import applies through one coordinator/storage transaction and restores the prior in-memory state if persistence fails.

Import never opens an external application, guesses a new context, uploads data, or claims to restore unsupported attachments/future annotation types.

## Keyboard and accessibility contract

- Every primary action is keyboard reachable with a visible focus indicator.
- Save, recovery, loading, error, and result-count changes use appropriate live/status semantics.
- Compact-editor, onboarding, All Skribs, Trash, and import surfaces provide high-contrast, forced-colour, reduced-motion, large-text, and responsive states where implemented.
- Physical Windows screen-reader, text-scaling, high-contrast, and full keyboard evidence remains release-blocking under #31 and #24.

## Explicitly deferred interactions

The following require separately approved architecture and acceptance work: customizable hotkeys, archive, context re-anchor/rules, persistent full-screen annotations, ink/highlighter, shapes/arrows/checklists, reminders, attachments, browser URL/DOM anchoring, macOS, cloud sync, collaboration, AI, and mobile clients.

No deferred interaction may restore a screen-blocking overlay or appear in current product claims merely because historical prototypes or planning documents mention it.
