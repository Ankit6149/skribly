# ADR-0002: Canonical shortcut-open lifecycle

- **Status:** Accepted, amended for current Windows v0 behavior
- **Original date:** 2026-08-04
- **Amended:** 2026-10-02

## Context

Skribli previously inferred which note to open by comparing frontend note arrays. That made user-visible behavior depend on event timing and unordered collection state.

The native runtime now owns the decision and emits an explicit privacy-safe `OpenNoteRequest`.

The product also has a device preference, `multipleNotesPerContext`, that changes whether the shortcut reuses one stable contextual note or creates another note in the same context.

## Decision

For a supported captured target, `Ctrl+Shift+Space` follows this rule:

1. capture and revalidate the exact target;
2. load the note preference;
3. when `multipleNotesPerContext = false` (the default), find a stable active primary note for that context;
4. reopen that note when one exists;
5. otherwise create a fresh contextual note;
6. when `multipleNotesPerContext = true`, skip primary-note reuse and create a fresh note;
7. emit an explicit `OpenNoteRequest` for the exact note that was selected or created.

The stable primary is the oldest active contextual note by `created_at`, then ID. Toggling the preference does not merge or delete existing notes.

Native applications currently group by process. Browser contexts additionally require the exact captured title until stronger URL/tab identity exists.

```text
focus supported application
        |
Ctrl+Shift+Space
        |
capture + revalidate exact HWND/process
        |
load note preference
        |
multiple notes enabled?
   | yes                  | no
   v                      v
create fresh       stable active primary?
                         | yes       | no
                         v           v
                      reopen      create fresh
                         \         /
                          OpenNoteRequest
                                |
                     frontend opens exact ID
```

### Request contract

```text
OpenNoteRequest {
  action: created | reopened | detached,
  noteId: string,
  matchingNoteCount: non-negative integer
}
```

The request intentionally excludes application titles, process names, paths, note text, geometry, and other user content.

### Explicit saved-note actions

Opening a saved note from My Skribs or All Skribs uses an explicit saved-note path. When compatibility code must choose among several legacy matches, it uses a deterministic ordering of `updated_at` descending, then `created_at` descending, then ID ascending.

That compatibility selector is distinct from the shortcut primary-note rule.

## User-visible behavior

- The editor identifies whether the native request was **created** or **reopened**.
- A default shortcut press reuses the stable active contextual note when one exists.
- With **multiple notes per context** enabled, shortcut presses create additional notes instead.
- No matching active note creates a new note.
- Archived or trashed notes are never shortcut primaries.
- Failed capture, placement, validation, or persistence emits no usable open request.
- The frontend never chooses a note merely because an array changed.

## Consequences

### Positive

- Native behavior is deterministic and independently testable.
- Frontend event ordering is safe because the request identifies the exact note.
- Existing contextual notes do not multiply by default.
- Users can deliberately opt into multiple notes per context.
- Legacy duplicate data remains discoverable without nondeterministic opening.

### Trade-offs

- Browser title identity remains weaker than URL/tab identity.
- Existing duplicate notes are preserved rather than silently merged.
- Product copy and tests must distinguish shortcut-primary selection from legacy many-match compatibility selection.

## Rejected alternatives

- **React array-difference detection:** timing-dependent and unable to distinguish unrelated context changes.
- **Use the first native collection item:** map iteration order is not a product contract.
- **Always create from the shortcut:** conflicts with the current default one-primary-note-per-context preference.
- **Always reopen regardless of preference:** removes the explicit multiple-notes option.
- **Send titles or note text in the request:** unnecessary and expands the privacy surface.

## Verification

- preference tests for stable primary selection, archive/trash exclusion, and multiple-note opt-in;
- native lifecycle tests for created/reopened request shapes and deterministic compatibility selection;
- frontend shape-validation and exact-ID selection tests;
- product-truth and lifecycle validators rejecting the retired array-change heuristic;
- installed Windows acceptance for the exact release candidate.
