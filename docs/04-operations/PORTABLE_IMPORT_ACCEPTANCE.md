# Portable JSON import acceptance contract

This document defines the implemented scope and required evidence for issue #133. It is a release-critical child of #21; it does not close that parent outcome.

## Product contract

- All Skribs imports legacy schema-version-1 note-record JSON and current schema-version-2 selected/all-record JSON. Schema 2 must explicitly declare that drawings, attachments, and reminders are excluded.
- The user deliberately chooses one local `.json` file. Skribli does not scan folders or upload it.
- Preview is mandatory and never mutates storage.
- Native code validates the complete file for both preview and apply.
- Exact duplicates are always skipped.
- Stable-ID conflicts default to **Skip conflicts**.
- **Replace the same IDs** is an explicit user choice and never matches by title, process, text, or similarity.
- Apply is rejected when the exact file fingerprint or local storage revision differs from preview.
- A complete durable rollback backup is created before any real mutation.
- Apply is one mutation-locked, crash-safe save transaction.
- Any save failure restores the complete prior in-memory collection and reports the backup path or error truthfully.
- Imported active and Trash records preserve their lifecycle fields.
- Read-only users may select and preview a file, but cannot apply it.

## Strict native validation

The importer rejects the entire file without mutation when any of these are invalid:

- JSON syntax;
- unknown envelope or note fields;
- future/unsupported schema;
- mismatched `noteCount`;
- more than 50,000 records;
- raw file larger than 10 MB;
- duplicate IDs inside the file;
- missing, whitespace/control-containing, or oversized IDs;
- oversized process name, context title, or note text;
- unsupported colour;
- non-finite, non-positive, or excessive geometry;
- zero-valued Trash timestamp;
- malformed request or response correlation data.

## Preview contract

Preview reports only bounded planning information:

- source schema and export scope;
- total, active, and Trash record counts;
- new, exact-duplicate, and conflict counts;
- at most 50 conflict summaries containing stable ID, timestamps, and active/Trash state;
- warnings;
- exact-file CRC32-and-length fingerprint;
- current local storage revision.

Preview does not return note text or context titles in conflict details.

## Apply contract

Apply must:

1. parse and validate the exact JSON again;
2. verify the exact preview fingerprint;
3. acquire the native mutation lock;
4. verify the preview storage revision;
5. rebuild the import plan against the current authoritative collection;
6. return a no-op success without backup when nothing would change;
7. otherwise write a complete versioned backup to `import-backups` using create-new and durable sync semantics;
8. merge only new records and the explicitly selected conflict replacements;
9. persist the complete active-and-Trash collection through schema-v3 storage;
10. restore the complete prior coordinator snapshot on save failure;
11. return imported/replaced/skipped counts, active/Trash totals, new revision, and rollback path.

## Conflict modes

### Skip conflicts

- Safe default.
- Existing same-ID records remain byte-for-byte unchanged.
- New records are added.
- Exact duplicates are skipped.

### Replace the same IDs

- Explicit radio choice after preview.
- Replaces only IDs listed as conflicts in the exact previewed file.
- Preserves unrelated local records.
- Imported active/Trash lifecycle state replaces the same record ID.
- Does not open, focus, guess, or re-anchor an application.

## Automated evidence

The exact PR revision must pass:

- strict parser tests for schema, unknown fields, size, count, duplicate IDs, colour, geometry, text, and lifecycle timestamps;
- deterministic new/identical/conflict planning tests;
- bounded privacy-conscious preview tests;
- fingerprint change and revision-change rejection tests;
- skip and replace merge tests;
- no-op apply tests;
- durable rollback-backup tests;
- injected save-failure rollback tests;
- active/Trash round-trip tests from the current export format;
- read-only preview/apply tests;
- frontend request/result, file metadata, timeout, and conflict-mode tests;
- frontend type-check, tests, and production build;
- Rust formatting, Windows cargo check, complete Rust tests, and restricted configuration;
- release-mode storage acceptance;
- governance, import product-truth, site, and public-copy validation.

## Physical Windows acceptance matrix

Tie all evidence to the exact candidate executable, exact source file hash, and exact local storage revision.

| Scenario | Required result |
| --- | --- |
| Choose a valid all-record export | Native preview shows correct total, active, Trash, new, duplicate, and conflict counts; it warns that rich local content is excluded; no local revision changes. |
| Choose a valid selected-note export | Preview warns that the file contains selected note records only and plans only those records. |
| Choose a non-JSON or empty file | Actionable error; no preview and no local mutation. |
| Choose a file larger than 10 MB | Rejected before native apply; no mutation. |
| File has unknown field/future schema/duplicate ID | Entire preview fails; no partial records appear. |
| File includes active and Trash records | Preview counts both and apply preserves lifecycle state. |
| Exact duplicates only | Apply reports no-op, creates no rollback backup, and does not increment storage revision. |
| New records only | Complete rollback backup exists before records appear; counts and revision update correctly. |
| Conflicts with default Skip mode | Existing conflicting records remain unchanged; new records import; skipped count is correct. |
| Explicit Replace mode | Only same-ID conflicts are replaced; unrelated records remain unchanged. |
| Local note changes after preview | Apply rejects and requires a new preview. |
| File content changes after preview | Fingerprint mismatch rejects apply. |
| Backup creation fails | No coordinator or storage mutation occurs. |
| Storage save fails after in-memory merge | Prior collection is restored and an actionable error remains visible. |
| Restart after successful apply | Imported active and Trash records remain present exactly once. |
| Export note records after import | All current active and Trash text/metadata records are present in the new export; IndexedDB ink, attachments, and reminders are not yet portable. |
| Read-only storage or expired licence | File can be selected and previewed; Apply button is disabled. |
| Close and reopen import panel | Pending state is cleared; no hidden apply occurs. |
| Preview/apply native response is missing | Visible timeout appears and controls recover safely. |
| Keyboard-only operation | Open, choose file, conflict radios, apply, close, warnings, details, and success path are reachable. |
| 200% text scaling/minimum library window | Preview counts, warnings, conflict options, errors, and rollback path remain readable and operable. |
| High contrast/reduced motion | Focus, progress, conflict mode, success, and error states remain perceivable without colour or motion dependence. |
| Original target application closed | Import remains fully usable and never launches or focuses the target. |

## Parent status

Issue #133 may close only after this exact slice is merged with complete automated evidence. Issue #21 remains open for attachment portability, archive, automatic backup scheduling, user-selected backup destinations, future annotation variants, context-safe reopen/re-anchor, and exact physical release-candidate validation.
