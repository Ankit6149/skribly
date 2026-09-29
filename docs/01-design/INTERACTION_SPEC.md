# Current Windows interaction specification

> **Status:** canonical Founder Alpha interaction contract. This document describes the compact Windows contextual-note product that exists today. Full-screen overlays, multiple simultaneous native note windows, browser DOM anchoring, and macOS behavior remain deferred.

## Application lifecycle

- Skribli runs as one background process, one tray icon, one global shortcut registration, and one Windows event-hook set per user session.
- Launching Skribli again restores the shared Home workspace; it does not create another note.
- Done, Escape, `Ctrl + Enter`, or closing the active editor flushes its latest typed draft and hides the editor. One quiet contextual indicator represents that app's notes, not a dot per note. Closing All Skribs hides the shared workspace. **Quit Skribli** in the tray exits the process.
- The first successful launch shows a three-step guide. **Quick guide** in the tray reopens it without creating a sample note.

## Open or create a contextual note

1. Focus a supported Windows application.
2. Press **Ctrl + Shift + Space**.
3. Skribli captures the foreground window once, clears any previous runtime target, and revalidates the HWND and process identity before note access.
4. Zero active matches creates one note. By default, existing matches reopen the oldest active note deterministically without removing duplicates. Settings can enable a fresh note on every shortcut. Native apps match by process; browser contexts currently use exact captured page titles, not verified origins.
5. The compact editor opens inside the target monitor's usable work area and identifies the flow as **NEW SKRIB FOR** or **REOPENED SKRIB FOR**.

If capture, identity, placement, native validation, or persistence fails, Skribli opens no note and presents one privacy-safe recovery message. It never falls back to a stale target.

## Compose, colour, and save

- Typing updates a local draft immediately.
- Native writes are serialized per active note; rapid edits coalesce into the latest pending draft.
- The editor reports **Unsaved**, **Saving**, **Saved**, or **Save failed** truthfully.
- A failed save keeps the exact draft visible and provides **Retry saving**.
- The current typed-note limit is 20,000 Unicode characters.
- The editor exposes **Type**, **Draw**, **Files**, and **Reminder** tools. Draw, Files, and Reminder request a bounded larger workspace; returning to Type restores the compact editor size.
- Every new note rotates through yellow, peach, mint, sky, lavender, rose, aqua and sand. The colour control selects these theme pastels.
- **Done**, **Escape**, **Ctrl + Enter**, and Close flush the latest draft before hiding the active editor.
- The contextual indicator unfolds a horizontal note shelf. Hover or keyboard focus reveals a preview; an explicit click opens the actual note here, while a separate action returns to its app.
- Moving the contextual editor persists its target-relative position and clamps restoration to the target monitor's work area. Detached reading does not rewrite that saved anchor.
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
- The contextual editor returns to the persistent My Skribs rail when done; it never becomes a desktop-sized overlay.
- **Reposition** recalculates a safe placement when the user needs it.
- Unsupported geometry fails closed instead of placing an unreachable window.
- The editor uses one reusable native WebView window. Saved Skribs remain accessible through the rail instead of becoming independent desktop dots.

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

- **All Skribs** in the tray selects the library inside the same normal, non-floating Home workspace. Sidebar navigation owns Notes, Calendar, Archive and Trash; account and note preferences live in Settings.
- Search is Unicode-normalized and case-insensitive across note text and stored context fields.
- Results use deterministic updated/created/ID ordering.
- Notes and Trash remain readable and exportable in read-only storage or licence states.
- Export supports one selected native note record or one complete versioned native JSON backup without overwriting an existing file.
- Closing the window hides the same instance instead of quitting Skribli.

## Note ribbons and inline files — v0.1.30 candidate

- A small pastel place label sits at the upper right. Its colour varies by note ID, remains stable when reopened, and never matches the note paper. More and Done remain separate at the left of the paper margin; Done saves and hides, rather than completing the task.
- Add and More reveal bounded horizontal icon ribbons. Hover and keyboard focus reveal action labels. Only one primary ribbon is open. Paper colour reveals a second horizontal swatch ribbon on hover, click or Arrow Down. Escape dismisses the colour ribbon, then the primary ribbon, before affecting the note.
- New files and pasted images are inserted at the saved writing cursor. A file reference moves within the document via its drag handle or earlier/later paragraph buttons. Inserting a reference never replaces a text selection or copies the binary attachment.
- The bottom attachment tray stays collapsed until requested and collects every attachment. Older attachments remain there until explicitly placed in the note. Removing a reference from text does not delete the file; deleting the file in the tray still requires confirmation.
- Inline placement is represented by local attachment IDs in the existing formatted HTML document. Blob/object URLs and preview controls are not persisted into that HTML. External pasted HTML cannot introduce attachment IDs or remote preview URLs.
- This adds no IndexedDB store/version and performs no bulk migration of existing records. Downgrade to a build without reference support may discard inline placement on editing; files remain in the tray. Portable native JSON still excludes rich content.
- DOM tests cover placement, serialization/reopening, read-only guards, focus and dismissal. Real WebView drag/drop, rendered spacing and Windows acceptance remain owner testing.

## Floating entry behaviour

- The global edge widget uses three horizontal pastel bands, inward-rounded corners on either dock edge and no exterior shadow.
- Its expanded collection and the contextual shelf have separate native state identities and ordered revisions. Expanding either collapses the other list, not its launcher.
- Native drag release and resizing are serialized. A stale docking callback must not overwrite a newer size or foreground-context transition.
- The contextual shelf is bounded to 460 by 250 logical pixels. It scrolls horizontally instead of squeezing each note into a truncated vertical row. Preview never launches an app; read-here and return-to-app remain explicit actions.
- Physical mixed-DPI, edge-dragging and compositor acceptance remains pending. These are implemented candidate behaviors, not signed-release verification.

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

The following require separately approved architecture and acceptance work: customizable hotkeys, context re-anchor/rules, multiple simultaneous native note windows, persistent full-screen annotations, shapes/arrows, cloud-delivered reminders, portable export/import of IndexedDB ink/attachments/reminders, browser URL/DOM anchoring, macOS, cloud sync, payments, collaboration, AI, and mobile clients.

No deferred interaction may restore a screen-blocking overlay or appear in current product claims merely because historical prototypes or planning documents mention it.
