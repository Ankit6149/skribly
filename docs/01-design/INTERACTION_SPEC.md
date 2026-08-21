# Current Windows interaction specification

> **Status:** canonical Founder Alpha interaction contract. This document describes the compact Windows contextual-note product that exists today. Full-screen overlays, multiple simultaneous native note windows, browser DOM anchoring, and macOS behavior remain deferred.

## Application lifecycle

- Skribli runs as one background process, one tray icon, one global shortcut registration, and one Windows event-hook set per user session.
- Launching Skribli again signals the existing process through the same note-opening path.
- Done, Escape, `Ctrl + Enter`, or closing the active editor saves its latest typed draft and collapses it to one movable dot. Closing All Skribs hides that window. **Quit Skribli** in the tray exits the process.
- The first successful launch shows a three-step guide. **Quick guide** in the tray reopens it without creating a sample note.

## Open or create a contextual note

1. Focus a supported Windows application.
2. Press **Ctrl + Shift + Space**.
3. Skribli captures the foreground window once, clears any previous runtime target, and revalidates the HWND and process identity before note access.
4. Zero active matches creates one note; one match reopens it; legacy duplicate matches select the most recently updated note deterministically.
5. The compact editor opens inside the target monitor's usable work area and identifies the flow as **NEW SKRIB FOR** or **REOPENED SKRIB FOR**.

If capture, identity, placement, native validation, or persistence fails, Skribli opens no note and presents one privacy-safe recovery message. It never falls back to a stale target.

## Compose, colour, and save

- Typing updates a local draft immediately.
- Native writes are serialized per active note; rapid edits coalesce into the latest pending draft.
- The editor reports **Unsaved**, **Saving**, **Saved**, or **Save failed** truthfully.
- A failed save keeps the exact draft visible and provides **Retry saving**.
- The current typed-note limit is 20,000 Unicode characters.
- The editor exposes **Type**, **Draw**, **Files**, and **Reminder** tools. Draw, Files, and Reminder request a bounded larger workspace; returning to Type restores the compact editor size.
- Every new note rotates through yellow, peach, mint, sky, and lavender. The colour control can change the active note to any of those exact website pastels.
- **Done**, **Escape**, **Ctrl + Enter**, and Close flush the latest draft before the active editor collapses to a movable dot.
- Clicking the dot or using the shortcut restores the same note at its saved target-relative position.
- Moving either the editor or dot persists its target-relative position and clamps restoration to the target monitor's work area.
- The editor remains visible when the final save is not durable.

An empty typed draft is discarded only when the Skrib also has no saved drawing, attachment, or reminder content.

## Draw

- Draw provides pen, highlighter, and eraser tools in a moderate editor workspace; it does not become a desktop-sized canvas.
- Mouse, touchpad, touch, and pen pointer input produces bounded normalized editable strokes.
- The user can choose drawing colour and width, undo the latest stroke, or confirm a two-step clear.
- Stroke changes are serialized into the note's local rich-content record so a slower write cannot replace a newer drawing.

## Files

- A Skrib can keep approved local images, videos, and documents in local IndexedDB.
- The chooser accepts bounded safe file types and validates MIME type, extension, file name, per-file size, per-note size, and per-note count before saving.
- Images and supported videos receive local previews. Documents remain an explicit local reference/download action; Skribli does not silently launch an external application.
- Removing a file requires an explicit confirmation.

## Reminder and calendar

- Each Skrib can schedule or reschedule a one-time local reminder with an optional bounded title.
- Reminder state is upcoming, overdue, completed, or dismissed. The editor can complete, dismiss, or remove the reminder.
- All Skribs includes a local-time-zone month calendar and agenda. Selecting **Open Skrib** returns to the linked library note.
- While Skribli is running, its reminder monitor claims due and missed reminders once and sends a privacy-safe Windows notification when operating-system notification permission is available. A denied or unavailable notification permission does not prevent the reminder from being saved or shown in the calendar.
- Recurrence and cloud-delivered reminders are not current behavior.

## Reposition

- Skribli calculates placement from the target monitor's work area and DPI before every show.
- The current contextual note can remain visible as one compact dot; it never becomes a desktop-sized overlay.
- **Reposition** recalculates a safe placement when the user needs it.
- Unsupported geometry fails closed instead of placing an unreachable window.
- The editor and collapsed dot share one native WebView window, so multiple Skribs cannot remain as simultaneous independent desktop dots in this release.

## Delete and Trash

- Closing an untouched whitespace-empty note discards that empty record.
- **Move to Trash** is the ordinary delete action for a saved note and requires confirmation.
- A trashed note keeps its ID, text, context, lifecycle metadata, and export representation.
- Moving a note to Trash dismisses its active local reminder on a best-effort basis. Confirmed permanent deletion also removes its local rich content and reminders; native note persistence and WebView IndexedDB cleanup are separate operations rather than one cross-store transaction.
- Trashed notes do not reopen through the global shortcut and cannot be edited or re-anchored.
- All Skribs can restore the same record from Trash.
- Permanent deletion is available only inside Trash after note-specific confirmation and successful durable persistence.
- The interface explains a 30-day recovery period; the current build does not silently auto-purge expired items.

## All Skribs

- **All Skribs** in the tray opens one normal, non-floating library window.
- Search is Unicode-normalized and case-insensitive across note text and stored context fields.
- Results use deterministic updated/created/ID ordering.
- Notes and Trash remain readable and exportable in read-only storage or licence states.
- Export supports one selected native note record or one complete versioned native JSON backup without overwriting an existing file.
- Closing the window hides the same instance instead of quitting Skribli.

## Portable import

1. Choose **Import JSON** in All Skribs.
2. Skribli strictly validates the current portable schema without mutating local data.
3. Preview reports active/Trash counts, new records, exact duplicates, stable-ID conflicts, and bounded details.
4. **Skip conflicts** is the safe default; replacing the same IDs is explicit.
5. Apply is rejected if the selected file fingerprint or local storage revision changed after preview.
6. Before mutation, Skribli writes and verifies a complete rollback backup.
7. Import applies through one coordinator/storage transaction and restores the prior in-memory state if persistence fails.

Import never opens an external application, guesses a new context, or uploads data. The native portable format currently excludes IndexedDB drawing strokes, attachment blobs, and reminder state, so export/import does not claim to back up or restore that rich content yet.

## Keyboard and accessibility contract

- Every primary action is keyboard reachable with a visible focus indicator.
- Save, recovery, loading, error, and result-count changes use appropriate live/status semantics.
- Compact-editor, drawing, files, reminder, calendar, onboarding, All Skribs, Trash, and import surfaces provide high-contrast, forced-colour, reduced-motion, large-text, and responsive states where implemented.
- Desktop surfaces use the website's five pastel tokens and its UI/display/font roles. Kalam is reserved for handwritten note content rather than every label or control, and every scrollable desktop surface uses the themed scrollbar tokens.
- Physical Windows screen-reader, text-scaling, high-contrast, and full keyboard evidence remains release-blocking under #31 and #24.

## Explicitly deferred interactions

The following require separately approved architecture and acceptance work: customizable hotkeys, archive, context re-anchor/rules, multiple simultaneous native note/dot windows, persistent full-screen annotations, shapes/arrows/checklists, recurring reminders, cloud-delivered reminders, portable export/import of IndexedDB ink/attachments/reminders, browser URL/DOM anchoring, macOS, cloud sync, payments, collaboration, AI, and mobile clients.

No deferred interaction may restore a screen-blocking overlay or appear in current product claims merely because historical prototypes or planning documents mention it.
