# Local storage recovery and support runbook

**Applies to:** Skribli Windows MVP  
**Storage implementation:** schema-v2 integrity-checked JSON envelope  
**Related issue:** [#14](https://github.com/Ankit6149/skribly/issues/14)  
**Architecture decision:** [`ADR-0001-hardened-json-storage.md`](../02-engineering/ADR-0001-hardened-json-storage.md)

## 1. User-data contract

Skribli keeps note data in the operating system application-data directory resolved by Tauri for the application identifier `app.skribly.desktop`.

The exact recovery folder is shown inside the compact editor whenever Skribli recovers data or blocks writes. Do not guess the directory from a username, installer location, or development checkout.

Normal note use does not require a cloud account or network connection. The authoritative note store is owned by the Rust process. The frontend does not maintain a second durable copy of text notes.

## 2. Storage files

The storage service may create these files in the recovery folder:

| File | Purpose |
| --- | --- |
| `skribs.json` | Current committed primary generation |
| `skribs.json.tmp` | Fully written and flushed candidate awaiting primary replacement |
| `skribs.json.bak.1` | Previous verified primary generation |
| `skribs.json.bak.2` | Older verified primary generation |
| `skribs.json.bak` | Legacy backup name retained for migration/recovery compatibility |
| `skribs.json.corrupt.*` and equivalent backup names | Damaged generations preserved in quarantine after a verified recovery source exists |
| `skribli-storage-diagnostics-*.json` | User-requested metadata-only support report |

Stage and recovery-temporary files may briefly exist during backup rotation or recovery. They are never treated as the only committed copy without integrity verification.

## 3. Envelope and integrity

Schema v2 contains:

- `schema_version`;
- monotonic `revision`;
- `written_at_ms`;
- `integrity`;
- `skribs`.

The integrity value detects accidental corruption and incomplete or externally modified JSON. It is not a cryptographic authenticity guarantee and does not protect against software running with the same user permissions.

Schema v1 (`version: 1`) is migrated explicitly. An unknown future schema is preserved and blocks writes so an older build cannot overwrite newer data.

## 4. Commit sequence

For each save, Skribli:

1. serializes the complete schema-v2 envelope with the next revision;
2. writes the same-directory temporary generation;
3. flushes the temporary file;
4. reopens and verifies its structure and integrity;
5. rotates verified backup generations;
6. replaces the primary atomically with write-through semantics on Windows;
7. verifies the committed primary again;
8. advances the in-memory revision only after verification succeeds.

The last known-good primary is never deleted before a verified replacement is ready.

Native note mutations are serialized. If persistence fails, the Rust coordinator is restored to its previous snapshot and the frontend receives an error instead of a success payload.

## 5. Startup recovery order

At startup, Skribli inspects the primary, temporary, current backup, legacy backup, and older backup.

- Missing files are ignored.
- Valid candidates are ordered by revision, then source priority, then write time.
- The best verified candidate is restored to the primary location when necessary.
- Invalid candidates are quarantined only when another valid candidate exists.
- If files exist but no valid generation is available, the damaged files remain in place and writes are blocked.
- A second launch must produce the same blocked recovery state; it must never reinterpret the quarantined/missing primary as a new empty database.
- Any unsupported future schema blocks writes and remains untouched.

After successful recovery, Skribli shows what source was used and where the recovery files are stored.

## 6. User-facing failure behavior

When storage cannot commit a note:

- the compact editor displays **Not saved**;
- the editor remains open when the current draft is not durable;
- **Done**, the close button, and `Esc` do not hide the only visible draft while storage is blocked;
- local draft text is not replaced by the last persisted prop value after rollback;
- delete is rejected rather than removing the only copy from the UI;
- a recovery-folder path and safe diagnostics action are available;
- retry remains possible for transient failures when the native service is still writable.

A licence-only read-only state may still close an unchanged note because no editable draft can be created in that state.

## 7. Safe diagnostics export

The **Save safe diagnostics** action writes a JSON report to the recovery folder.

The report includes only:

- report generation time;
- current supported schema version and in-memory revision;
- writable/blocked state;
- blocked reason using storage file names rather than note content;
- candidate source and file name;
- existence, file size, modification time, status, revision, and schema version;
- structural/integrity errors.

The report must never include:

- note text;
- target window titles;
- target process data from note records;
- customer data;
- licence tokens or signing material;
- arbitrary file contents.

A regression test saves distinctive private note text and target-title text, exports diagnostics, and verifies both strings are absent.

## 8. User recovery procedure

When Skribli reports a storage problem:

1. Keep the editor open if it contains unsaved text.
2. Copy critical unsaved text to a separate local file before experimenting with storage files.
3. Use **Save safe diagnostics**.
4. Record the displayed recovery folder and diagnostics output path.
5. Quit Skribli explicitly before copying or moving recovery files.
6. Copy the entire recovery folder to a separate safe location. Do not copy only `skribs.json`.
7. Do not rename, delete, or edit the original files until a recovery copy exists.
8. Share only the metadata diagnostics report by default. Share note data only through an explicit, informed support decision.

Skribli currently does not provide a destructive “reset database” button. Resetting or replacing local data must remain an explicit recovery action until the note library/trash work defines a safer workflow.

## 9. Maintainer recovery procedure

1. Obtain the exact app version/commit and diagnostics report.
2. Confirm the user has copied the complete recovery folder.
3. Do not ask for note files until metadata-only diagnostics are insufficient and the user understands that note content may be exposed.
4. Reproduce with copies, never with the user's only originals.
5. Verify every candidate independently.
6. Prefer the highest verified revision; do not assume the primary is newest.
7. Preserve unsupported schemas for the build that understands them.
8. If a manual restoration is required, write to a new location first and verify before replacing anything.
9. Record which candidate was selected, its revision, and every file changed.
10. Provide a rollback copy and clear user instructions.

## 10. Automated evidence

The storage unit and integration suites cover:

- empty first launch;
- schema-v2 round trip;
- schema-v1 migration;
- missing primary with valid backup;
- corrupt primary with verified-backup recovery and quarantine;
- corrupt-only repeated launches without silent empty state;
- interruption after temporary-file sync;
- interruption after backup rotation;
- two known-good backup generations;
- damaged old backup quarantine without blocking a valid new save;
- unsupported future schema preservation and blocked writes;
- integrity mismatch fallback;
- metadata-only diagnostics privacy;
- coordinator rollback after native persistence failure;
- frontend storage read-only mutation blocking and recovery-notice dismissal.

CI compilation and unit tests do not prove Windows power-loss, antivirus, or filesystem semantics by themselves.

## 11. Required manual Windows evidence before issue #14 closes

Use the exact release-mode binary and record its hash and commit.

### Real app-data path

- Confirm the production binary writes to the Tauri application-data directory, not a temporary/development path.
- Confirm recovery-folder and diagnostics paths displayed in the UI match the actual files.

### Forced termination matrix

For each injected or externally controlled stage, terminate the exact process and restart:

- before temporary write;
- during temporary write;
- after temporary flush;
- during backup rotation;
- immediately before primary replacement;
- immediately after replacement;
- while the editor has a pending draft.

Record the selected recovery source, resulting revision, user message, and whether the exact expected text survives.

### Filesystem failures

Validate and capture UI behavior for:

- disk-full or quota exhaustion;
- data-directory permission denial;
- primary-file read-only state;
- temporary-file creation denial;
- backup-file lock;
- primary replacement lock;
- simulated antivirus/indexer interference;
- path disappearance or removable-profile interruption where applicable.

The editor must remain open with the unsaved draft when the commit fails.

### Recovery generations

- Corrupt the primary and verify automatic recovery from backup 1.
- Corrupt primary and backup 1 and verify backup 2 recovery.
- Remove the primary while keeping a valid temporary generation and verify latest-revision recovery.
- Leave only corrupt candidates, launch twice, and verify neither launch creates an empty writable database.
- Place a future-schema primary and verify the old build never rewrites it.

### Installer and restart

- Restart Windows with a pending edit.
- Test normal Quit and forced Task Manager termination.
- Test installer upgrade while Skribli is running after issue #15 defines lifecycle ownership.

## 12. Rollback

If the schema-v2 implementation must be rolled back:

- preserve `skribs.json`, temporary, backups, quarantine files, and diagnostics;
- do not launch an older build that can write until downgrade handling is proven;
- use a read-only recovery tool or migration build to export verified notes;
- never overwrite schema-v2 data with schema-v1 output;
- record the source revision and integrity result used for restoration.

Issue #14 must remain open until the manual Windows matrix is complete and attached to the issue with the exact binary identity.
