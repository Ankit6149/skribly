# Reversible Trash acceptance contract

This document defines the implemented scope and required evidence for issue #131. It is a release-critical child of #20 and #21; it does not close those parent outcomes.

## Product contract

- Ordinary **Delete** in the compact editor moves a saved note to Trash.
- A newly created note that remains empty can be discarded through a separate constrained internal command.
- Trash retention is presented as 30 days from the deletion timestamp.
- This release does not automatically purge expired Trash.
- Restore returns the exact note ID and content to Notes.
- Permanent deletion is available only inside Trash and requires a note-specific confirmation.
- Notes in Trash never reopen through the global shortcut and cannot be edited or re-anchored.
- Active and trashed records remain readable and exportable in read-only mode.

## Native state rules

| Current state | Operation | Required result |
| --- | --- | --- |
| Active, non-empty | Move to Trash | Set `deleted_at`, update timestamp, persist, remove from active matching. |
| Active, empty | Discard empty | Remove only when text is whitespace-empty and the note is not trashed. |
| Active | Restore | Reject without mutation. |
| Active | Delete permanently | Reject without mutation. |
| Trash | Restore | Clear `deleted_at`, preserve ID/content/context, update timestamp, persist. |
| Trash | Delete permanently | Remove the record only after explicit UI confirmation and successful persistence. |
| Trash | Text/colour/geometry/collapse edit | Reject without mutation. |
| Missing note | Any lifecycle mutation | Reject without mutation. |

Every native lifecycle command is executed through the persisted-mutation transaction. A failed write restores the complete prior coordinator snapshot.

## Storage contract

- Current schema version is 3.
- Schema 1 migrates with `deleted_at = None`.
- Authentic schema 2 is verified using its original note shape without lifecycle metadata.
- Schema 2 converts to schema 3 only after integrity verification succeeds.
- Schema 3 integrity includes `deleted_at`.
- Primary, temporary, and backup recovery generations preserve Trash state.
- Unsupported future schemas remain preserved and writes are blocked.
- Old or invalid deletion timestamps never trigger automatic removal.

## All Skribs behavior

### Notes view

- Contains active records only.
- Uses deterministic updated/created/ID ordering.
- Searches note text, process name, and stored context title.

### Trash view

- Contains records with lifecycle metadata only.
- Uses the same deterministic ordering and search model.
- Displays retained, expired, invalid, and future-timestamp states safely.
- Provides Restore and selected-note export.
- Provides permanent deletion only after the title of the selected note appears in an assertive confirmation.
- Escape cancels permanent-delete confirmation.
- Does not launch, focus, guess, or re-anchor the original application.

### Complete export

An all-record export includes active and trashed note records and explicitly excludes drawings, attachments, and reminders. Selected exports preserve lifecycle metadata. Export remains available when mutations are blocked.

## Automated evidence

The exact PR revision must pass:

- schema-v1 and authentic schema-v2 migration fixtures;
- schema-v3 Trash round-trip and recovery-generation fixtures;
- future-schema downgrade protection;
- native active/Trash transition and wrong-state tests;
- persistence rollback tests;
- shortcut matching tests excluding trashed records;
- frontend retention and filtering tests;
- compact-editor Trash and empty-discard store tests;
- All Skribs read-only, confirmation, restore, permanent-delete, and export contract validation;
- frontend type-check, tests, and production build;
- Rust formatting, Windows cargo check, complete Rust tests, and restricted configuration;
- storage acceptance, repository governance, product-truth, and site validation.

## Physical Windows acceptance matrix

Tie evidence to the exact candidate executable and exact storage revision.

| Scenario | Required result |
| --- | --- |
| Delete a saved compact note | Confirmation says Move to Trash; successful persistence hides editor and note no longer reopens by shortcut. |
| Cancel Move to Trash | Note remains active and editor remains usable. |
| Storage failure during Move to Trash | Editor stays visible; note remains active; actionable error appears. |
| Close untouched empty note | Empty record is discarded without entering Trash. |
| Attempt empty discard after typing meaningful text | Native command rejects; meaningful note remains. |
| Open All Skribs after deletion | Notes count decreases, Trash count increases, exact content and context remain readable. |
| Restore from Trash | Same ID/content returns to Notes; no external application opens or receives focus. |
| Storage failure during restore | Record remains visible in Trash with error. |
| Begin permanent deletion | Confirmation includes selected note title and says the action cannot be undone. |
| Cancel permanent deletion with button or Escape | Record remains in Trash. |
| Confirm permanent deletion | Record disappears only after durable persistence succeeds. |
| Storage failure during permanent deletion | Record remains visible in Trash with error. |
| Restart after Trash/restore/permanent delete | Lifecycle state matches the last durable action. |
| Recover from backup generation containing Trash | Deletion timestamp and note content are preserved. |
| Upgrade a real schema-v2 database | All IDs/text/context/timestamps survive and every note starts active. |
| Open with unsupported future schema present | Verified readable data may open read-only; writes remain blocked and future file is preserved. |
| Expired Trash item | Item is visibly marked for review and is not silently purged. |
| Missing/invalid/future deletion timestamp | Item remains visible in Trash and is not silently purged. |
| Read-only licence or storage recovery mode | Notes and Trash remain readable/exportable; lifecycle buttons are disabled. |
| Keyboard-only use | Tabs, search, results, Restore, export, confirmation, cancel, permanent delete, and hide are reachable. |
| 200% text scaling/minimum window | Counts, warnings, content, and confirmations remain visible and operable. |
| High contrast/reduced motion | Focus and lifecycle state remain perceivable without colour or animation dependence. |

## Parent status

Issue #131 may close only after this slice is merged with complete automated evidence. Issues #20 and #21 remain open for import, archive, attachment cleanup, automatic purge, user-configurable retention, context-safe reopen/re-anchor, scalability, and exact physical release-candidate validation.
