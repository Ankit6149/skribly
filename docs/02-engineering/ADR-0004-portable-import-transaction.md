# ADR-0004: Portable JSON import with preview and rollback

- **Status:** Accepted for the Windows release candidate
- **Date:** 2026-08-06
- **Child issue:** #133
- **Parent:** #21

## Context

Skribli can export selected notes and a complete local backup as versioned JSON. Without a validated import path, that export is useful for inspection but not sufficient for ownership, migration, or recovery into another installation.

Import is a high-risk mutation because the file may be malformed, from a future schema, contain duplicate IDs, conflict with newer local records, or become stale between preview and apply. A local-first application must not silently overwrite records or depend on a cloud-side restore.

## Decision

### Supported portable format

This release imports schema version `1`, the same envelope produced by All Skribs:

```text
LibraryExportEnvelope {
  schemaVersion,
  exportedAtMs,
  scope,
  noteCount,
  notes
}
```

The native importer uses a strict record codec with unknown-field rejection. It validates IDs, text length, process/title bounds, supported colours, finite geometry, dimensions, lifecycle timestamps, envelope counts, duplicate IDs, file size, and note count before it produces a preview.

Unknown future schemas fail closed and do not mutate storage.

### File selection and privacy

The user chooses one local `.json` file through the library WebView file picker. The frontend reads that exact file and sends its text only through the local Tauri event bridge. Skribli does not scan directories, upload the file, or send its contents to the public website.

### Mandatory preview

Preview always precedes apply and is read-only. Native code parses and validates the complete file, compares it with the current authoritative collection, and returns:

- source schema and scope;
- total, active, and Trash counts;
- new records;
- exact duplicates;
- stable-ID conflicts;
- bounded conflict summaries;
- warnings;
- exact-file fingerprint;
- current storage revision.

The preview response intentionally excludes note text and context titles from conflict summaries.

### Duplicate and conflict rules

- **New:** imported ID does not exist locally.
- **Exact duplicate:** same ID and the complete record is equal. Always skipped.
- **ID conflict:** same ID but any record or lifecycle field differs.

The safe default is **Skip conflicts**. **Replace the same IDs** is an explicit user choice and replaces only those stable IDs. Skribli never matches imports by application title, process name, note text, timestamps, or similarity, and it never re-anchors an imported context.

### Preview/apply consistency

The native preview computes a deterministic CRC32-and-length fingerprint over the exact JSON bytes. Apply re-parses and re-validates the complete file and rejects it if the fingerprint differs.

Apply also requires the storage revision returned by preview. Every local mutation uses the same mutation lock, so a revision mismatch means the user must refresh and preview again.

The fingerprint is a consistency marker, not a security signature. Strict parsing, revision locking, durable storage, and local file selection provide the safety boundary.

### Atomic apply and rollback backup

Apply executes under the native mutation lock:

1. re-parse and validate the exact file;
2. verify fingerprint and expected storage revision;
3. build the deterministic import plan;
4. if no records would change, return a no-op summary;
5. write and durably verify a complete pre-import backup in `import-backups`;
6. construct the merged collection according to the chosen conflict mode;
7. replace the in-memory coordinator collection;
8. save the complete collection through the existing crash-safe storage service;
9. on save failure, restore the complete prior coordinator snapshot and report the error;
10. on success, report counts, new storage revision, and rollback-backup path.

The backup uses create-new semantics and never overwrites note storage or another backup.

### Lifecycle and read-only behavior

Imported active and Trash records preserve their complete lifecycle metadata. Complete backup/export after import continues to include both.

Storage recovery mode and licence-expired mode allow file selection and preview but disable apply. Existing Notes, Trash, and export remain available.

## Limits

- Maximum raw JSON size: 10 MB.
- Maximum records: 50,000.
- Maximum note text: 20,000 Unicode characters.
- Maximum conflict summaries returned to the UI: 50.
- Supported colours and geometry limits match native note validation.

## Consequences

### Positive

- Export becomes a genuine portable recovery path.
- Preview cannot mutate storage.
- Exact duplicates never create extra records.
- Conflicts require an explicit policy.
- Local changes between preview and apply cannot be overwritten accidentally.
- Every real mutation has a durable pre-import rollback backup.
- Imported Trash state remains recoverable and exportable.

### Trade-offs

- CRC32 is intentionally only a consistency fingerprint, not an authenticity proof.
- The current UI reads the selected file into memory, bounded by the 10 MB limit.
- Unknown future annotation variants are rejected instead of partially imported.
- Automatic rollback execution remains manual; this slice creates the verified backup and reports its path.

## Rejected alternatives

- **Import without preview:** too easy to overwrite data accidentally.
- **Frontend-only validation:** native apply must distrust and revalidate the payload.
- **Match by title or process:** ambiguous and unsafe for context identity.
- **Always replace conflicts:** destroys newer local records silently.
- **Always skip without choice:** prevents deliberate restoration of a stable record.
- **Apply after any local revision change:** preview is no longer authoritative.
- **Backup after mutation:** cannot protect the original collection.
- **Partial best-effort parsing:** hides corrupt or unsupported records.

## Verification

Issue #133 may close only when the exact revision passes:

- strict schema, unknown-field, size, count, duplicate-ID, colour, geometry, and lifecycle validation tests;
- deterministic new/identical/conflict planning tests;
- skip and replace mode tests;
- exact-file fingerprint and revision-change rejection tests;
- durable rollback-backup and save-failure rollback tests;
- active/Trash round-trip import tests;
- read-only preview/apply tests;
- frontend request/result and file-selection tests;
- complete frontend, Windows, restricted-build, storage, governance, product-truth, and site gates;
- physical Windows acceptance tied to the exact candidate.

Issue #21 remains open for attachment portability, archive, scheduled backups, unknown future annotation variants, context-safe reopen/re-anchor, and exact physical release-candidate evidence.
