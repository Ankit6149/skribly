# ADR-0003: Reversible note deletion and Trash lifecycle

- **Status:** Accepted for the Windows release candidate
- **Date:** 2026-08-06
- **Child issue:** #131
- **Parents:** #20 and #21

## Context

Skribli previously used one permanent delete command from the compact editor. That made an ordinary user action destroy the only authoritative local record immediately. A local-first product cannot depend on a remote support restore, so the application needs a durable and understandable recovery boundary before public installation or payment can be enabled.

The existing storage format was schema version 2. It protected generations with a CRC over the exact serialized note shape. Adding lifecycle metadata changes that shape, so authentic schema-v2 integrity must be verified using the original schema-v2 record, not by inserting a new field before verification.

## Decision

### Authoritative record

Storage schema version 3 adds one optional field to `SkribNote`:

```text
deleted_at: Option<u64> // UTC epoch seconds
```

- `None` means active.
- `Some(timestamp)` means Trash.
- Note ID, text, context, geometry, colour, creation time, and the rest of the record remain unchanged.
- Restore clears `deleted_at` and updates `updated_at` while preserving the same note ID.

### State machine

```text
new empty note
   | Done/close while still empty
   v
constrained discard (record removed; never exposed as ordinary Delete)

active note
   | explicit Move to Trash
   v
trashed note ----------------------+
   | Restore                       |
   +----------------> active note  |
   |                               |
   | explicit note-specific        |
   | permanent-delete confirmation |
   v                               |
record removed <-------------------+
```

A trashed record cannot be edited, context-matched, reopened by the global shortcut, collapsed, recoloured, or repositioned. It remains readable and exportable from All Skribs.

### Retention

- The user-facing retention period is 30 days from `deleted_at`.
- This child does **not** run an automatic background purge.
- A record beyond 30 days is visibly marked as having ended its retention period, but remains available for explicit review, restore, export, or permanent deletion.
- Missing, invalid, or future deletion timestamps fail safe: the record remains visible in Trash and is never purged automatically.

Automatic purge requires separate physical runtime evidence and remains parent work.

### Commands

The native command boundary is explicit:

- `trash_skrib_note` — active to Trash.
- `restore_skrib_note` — Trash to active.
- `permanently_delete_skrib_note` — removes only a trashed record.
- `discard_empty_skrib_note` — removes only an active whitespace-empty note created for the compact editor.

Every command uses the existing persisted-mutation transaction. If storage fails, the coordinator snapshot is restored and the visible record remains available with an actionable error.

### Library behavior

All Skribs provides two deliberate views:

- **Notes** — active records only.
- **Trash** — records with lifecycle metadata only.

Both views use deterministic ordering and the same Unicode-normalized search over text, process name, and stored context title. Trash actions never launch, focus, guess, or re-anchor an external application.

Complete backup exports include active and trashed records. Selected exports preserve lifecycle metadata.

### Read-only behavior

Storage recovery mode and licence-expired mode preserve read and export access for both Notes and Trash. They disable Trash, Restore, and permanent-delete mutations.

## Schema migration

### Schema 1

Schema-v1 data has no integrity envelope. Existing safe migration remains and assigns `deleted_at = None`.

### Schema 2

Schema-v2 records are decoded into an exact legacy note struct without `deleted_at`. Their CRC is verified over that original shape. Only after verification are records converted to schema v3 with `deleted_at = None`, then written through the existing durable restore path.

### Schema 3

Schema-v3 integrity includes lifecycle metadata. Primary, temporary, and backup recovery generations therefore preserve Trash state exactly.

### Future schemas

Unsupported future schema generations remain preserved and writes remain blocked, matching the existing downgrade-safety policy.

## Consequences

### Positive

- Ordinary deletion is recoverable.
- Shortcut matching cannot revive a trashed note.
- Existing databases migrate without false corruption failures.
- Backup recovery retains lifecycle state.
- Read-only users keep access to their data.
- Permanent deletion is separated from ordinary work and requires note-specific confirmation.

### Trade-offs

- Expired Trash remains on disk until explicitly handled or a separately validated retention service ships.
- Storage schema 3 is a one-way migration for older binaries; downgrade protection is therefore essential.
- Attachment cleanup, import conflict handling, and automatic purge are not solved by this child.

## Rejected alternatives

- **Immediate permanent delete:** unacceptable data-loss risk.
- **Frontend-only undo timer:** not durable across restart or crash.
- **Separate unversioned trash file:** creates split-brain recovery and export behavior.
- **Verify schema-v2 data after adding `deleted_at: null`:** changes the CRC input and incorrectly rejects authentic existing files.
- **Silent purge on startup:** can surprise users and lacks physical interruption evidence.
- **Restore by creating a new ID:** breaks identity, exports, and auditability.

## Verification

Issue #131 may close only when the exact revision passes:

- authentic schema-v2 migration fixtures;
- schema-v3 Trash round-trip and backup-recovery fixtures;
- native state-transition and wrong-state tests;
- persisted-mutation rollback coverage;
- frontend retention, filtering, store, confirmation, and read-only tests;
- complete frontend and Windows CI;
- storage acceptance and restricted configuration;
- governance, product-truth, and public-site validation.

Issues #20 and #21 remain open for import, archive, attachment cleanup, context-safe reopening/re-anchor, automatic purge, performance, and exact physical release-candidate evidence.
