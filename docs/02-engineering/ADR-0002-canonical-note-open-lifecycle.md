# ADR-0002: Canonical shortcut-open lifecycle

- **Status:** Accepted for the Windows MVP
- **Date:** 2026-08-04
- **Parent:** #20
- **Implementation slice:** #123

## Context

The native shortcut path can create or return contextual notes, but the React host previously inferred which note to open by comparing note arrays and selecting either a newly observed ID or the latest updated item. That coupled user-visible behavior to collection timing and unordered native storage. With legacy duplicate notes, two equivalent payloads could open different notes.

The Windows MVP needs one predictable answer when the user presses `Ctrl+Shift+Space`.

## Decision

The current MVP uses one active text note per captured application context.

The native shortcut path owns the opening decision and emits a privacy-safe `OpenNoteRequest` only after capture, placement, and any required note creation have succeeded.

```text
focus supported application
        |
Ctrl+Shift+Space
        |
clear old runtime target
        |
capture + revalidate exact HWND/process
        |
position compact editor safely
        |
find matching notes
   /          |             \
zero          one          legacy many
 |             |                |
create       reopen       deterministic select
 |             |                |
   emit OverlayStatePayload
              |
   emit OpenNoteRequest
              |
frontend waits until requested ID exists
              |
open exact requested note
              |
type/edit -> durable save -> Done/Esc/Ctrl+Enter/close -> hide
              |
untouched empty note -> durable delete -> hide
```

### Request contract

```text
OpenNoteRequest {
  action: created | reopened,
  noteId: string,
  matchingNoteCount: non-negative integer
}
```

The request intentionally excludes application titles, process names, paths, note text, geometry, and other user content.

### Zero, one, and many matches

- **Zero:** create one empty note, persist it, then emit `created` with the new ID and `matchingNoteCount = 0`.
- **One:** emit `reopened` with that ID and `matchingNoteCount = 1`.
- **Legacy many:** choose by `updated_at` descending, then `created_at` descending, then ID ascending. Emit `reopened` and the original match count.

The many-match path is compatibility behavior, not approval for creating multiple notes per context in the current MVP. Library cleanup and duplicate-resolution UX remain parent work.

## User-visible behavior

- The editor says **NEW SKRIB FOR** when native code created the current typed Skrib record.
- The editor says **REOPENED SKRIB FOR** when an existing typed Skrib record was selected.
- No floating dot, attached tab, or permanent overlay remains after the editor hides.
- Failed capture, placement, validation, or persistence emits no open request.
- The frontend never opens a note merely because an array changed.

## Consequences

### Positive

- Native behavior is deterministic and independently testable.
- Frontend event ordering is safe: the request may arrive before or after the state payload because it remains pending until the exact ID exists.
- Legacy duplicate data no longer produces random openings.
- User-facing copy states whether the shortcut created or reopened a note.

### Trade-offs

- One shortcut does not create a second note for the same context in this MVP.
- Duplicate cleanup, titles, archive/trash, and the All Skribs recovery surface remain separate work.
- Application/document identity is still constrained by the context work tracked in #18.

## Rejected alternatives

- **React array-difference detection:** timing-dependent and unable to distinguish unrelated context changes.
- **Use the first native collection item:** map iteration order is not a product contract.
- **Always create a note:** creates duplicates and makes retrieval unclear.
- **Send titles or text in the request:** unnecessary and expands the privacy surface.

## Verification

- Native zero/one/many/tie tests.
- Frontend shape-validation and exact-ID selection tests.
- Product-truth validation rejecting the old `knownNoteIds`/latest-array heuristic.
- Complete CI matrix before merge.

## Remaining parent scope

Issue #20 remains open for full lifecycle consistency across the library, reversible trash/undo, site and FAQ alignment, broader context identity, representative usability evidence, and exact release-binary validation.
