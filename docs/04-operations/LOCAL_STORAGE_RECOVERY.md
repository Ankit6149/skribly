# Local storage recovery and support runbook

**Applies to:** Skribli Windows typed-note MVP  
**Storage implementation:** schema-v2 integrity-checked JSON envelope  
**Related issue:** [#14](https://github.com/Ankit6149/skribly/issues/14)  
**Architecture decision:** [`ADR-0001-hardened-json-storage.md`](../02-engineering/ADR-0001-hardened-json-storage.md)

## 1. User-data contract

Skribli keeps note data in the operating-system application-data directory resolved for the application identifier `app.skribly.desktop`.

The exact recovery folder is shown inside the compact editor whenever Skribli recovers data or blocks writes. Do not infer the directory from a username, installer location, or development checkout.

Normal note use requires neither a cloud account nor a network connection. The Rust process owns the authoritative text-note store; the frontend does not maintain a second durable copy.

## 2. Storage files

The storage service may create these files in the recovery folder:

| File | Purpose |
| --- | --- |
| `skribs.json` | Current committed primary generation |
| `skribs.json.tmp` | Fully written and flushed candidate awaiting primary replacement |
| `skribs.json.bak.1` | Previous verified primary generation |
| `skribs.json.bak.2` | Older verified primary generation |
| `skribs.json.bak` | Legacy backup name retained for migration/recovery compatibility |
| `skribs.json.corrupt.*` and equivalent backup names | Damaged generations preserved in quarantine after another verified recovery source exists |
| `skribli-storage-diagnostics-*.json` | User-requested metadata-only support report |

Stage and recovery-temporary files may briefly exist during rotation or restoration. They are never accepted as the committed source without structural and integrity verification.

## 3. Envelope and integrity

Schema v2 contains:

- `schema_version`;
- monotonic `revision`;
- `written_at_ms`;
- `integrity`;
- `skribs`.

The integrity value detects accidental corruption, incomplete writes, and externally modified JSON. It is not a cryptographic authenticity guarantee and does not protect against software running with the same user permissions.

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
- Valid candidates are ordered by revision, source priority, and write time.
- The best verified candidate is restored to the primary location when necessary.
- Invalid candidates are quarantined only when another valid candidate exists.
- If files exist but no valid generation is available, damaged files remain in place and writes are blocked.
- Repeated launches preserve the same blocked recovery state; they never reinterpret a missing or damaged primary as a new empty database.
- Unsupported future schemas remain untouched and block writes.
- When a future-schema generation exists beside an older verified generation, Skribli displays the verified notes read-only rather than hiding them or overwriting the newer file.

After successful recovery, Skribli reports the selected source and recovery directory.

## 6. User-facing failure behavior

When storage cannot commit a note:

- the compact editor displays **Not saved**;
- the editor remains open while the current draft is not durable;
- **Done**, Close, Delete, and `Esc` cannot hide or remove the only visible unsaved draft;
- local draft text is not replaced by the previous persisted value after native rollback;
- the storage error remains distinct from unrelated hotkey or window errors;
- the recovery directory and metadata-only diagnostics action remain available;
- retry remains possible for transient failures when the native service is still writable.

A licence-only read-only state may close an unchanged note because that mode cannot create an editable draft.

## 7. Safe diagnostics export

The **Save safe diagnostics** action writes a JSON report to the recovery folder.

The report includes only:

- report generation time;
- supported schema and in-memory revision;
- writable or blocked state;
- blocked reason expressed through storage file names rather than note content;
- candidate source and file name;
- existence, size, modification time, status, revision, schema, and structural/integrity errors.

The report must never include:

- note text;
- target window titles;
- target process values from note records;
- customer data;
- licence tokens or signing material;
- arbitrary storage-file contents.

Both Rust tests and the Windows acceptance gate save distinctive private fixture values, export diagnostics, and verify those values are absent.

## 8. User recovery procedure

When Skribli reports a storage problem:

1. Keep the editor open if it contains unsaved text.
2. Copy critical unsaved text to a separate local file before changing recovery files.
3. Use **Save safe diagnostics**.
4. Record the displayed recovery folder and diagnostics output path.
5. Quit Skribli explicitly before copying or moving recovery files.
6. Copy the complete recovery folder to another safe location; do not copy only `skribs.json`.
7. Do not rename, delete, or edit the original files until a recovery copy exists.
8. Share only the metadata report by default. Share note files only through an explicit, informed support decision.

Skribli does not provide a destructive “reset database” button. Reset or replacement must remain an explicit recovery operation until the library, backup, and trash work defines a safer product flow.

## 9. Maintainer recovery procedure

1. Obtain the exact application version or commit and the diagnostics report.
2. Confirm the complete recovery directory has been copied.
3. Do not request note files until metadata-only diagnostics are insufficient and the user understands that content may be exposed.
4. Reproduce against copies, never the only originals.
5. Verify every candidate independently.
6. Prefer the highest verified revision; do not assume the primary is newest.
7. Preserve unsupported schemas for a build that understands them.
8. Write manual restoration output to a new location and verify it before replacement.
9. Record the selected source, revision, integrity result, and every changed file.
10. Preserve a rollback copy and provide explicit restoration instructions.

## 10. Automated unit and integration evidence

The Rust and frontend suites cover:

- empty first launch and schema-v2 round trip;
- schema-v1 migration;
- missing-primary recovery;
- corrupt-primary recovery and quarantine;
- corrupt-only repeated launches without silent empty state;
- interruption after temporary sync, backup rotation, before replacement, and after replacement;
- two known-good backup generations;
- damaged old-backup quarantine;
- unsupported primary and backup protection;
- verified older notes opening read-only beside a newer unsupported generation;
- integrity mismatch fallback;
- read-only verified recovery;
- metadata-only diagnostics privacy;
- native coordinator rollback after persistence failure;
- frontend rollback, recovery notice, blocked mutation, and zero-note recovery-surface behavior;
- user-visible disk-full, permission, sharing-lock, antivirus/indexer, and atomic-replacement errors.

Compilation and unit tests alone do not prove Windows replacement, sharing, ACL, or process-termination behavior. Those semantics are covered by the release-mode gate below.

## 11. Release-mode Windows storage acceptance gate

`.github/workflows/storage-acceptance.yml` is required whenever the storage implementation, acceptance harness, frontend failure tests, or this runbook changes.

The workflow:

1. runs on a clean hosted Windows machine;
2. builds `storage_acceptance.exe` in release mode;
3. compiles the same `models.rs`, `license.rs`, and `storage.rs` source used by the application rather than a copied storage algorithm;
4. writes under `%APPDATA%\app.skribly.desktop\storage-acceptance\<commit>`;
5. records the exact tested commit, runner, Windows version, release binary path, and SHA-256;
6. uploads `storage-acceptance-evidence.json` as a retained workflow artifact;
7. fails when any scenario fails or the evidence artifact is missing.

The destructive matrix covers:

- forced process termination after temporary sync;
- forced process termination after backup rotation;
- forced process termination immediately before primary replacement;
- forced process termination immediately after primary replacement;
- process termination with a partially written temporary generation;
- primary and backup-1 corruption with backup-2 recovery;
- repeated corrupt-only launches;
- future-schema preservation and blocked downgrade writes;
- temporary-generation creation denial;
- data-directory permission denial;
- primary replacement sharing lock;
- backup rotation sharing lock;
- read-only primary replacement failure;
- metadata-only diagnostics privacy;
- real application-data-root semantics.

The test driver uses explicit `.NET ProcessStartInfo`, argument passing, captured output and exit codes, Windows ACLs, sharing modes, and forced child-process termination. Expected filesystem failures are treated as successful evidence only when the previous committed generation remains recoverable and the failure is surfaced.

The workflow evidence is storage-subsystem acceptance. It does not replace:

- #15 lifecycle validation for one-instance startup, shutdown, restart, suspend/resume, tray ownership, and installer upgrade;
- #16 end-user pending-draft ordering and final editor-save protocol;
- #24 exact signed-installer validation across the supported Windows matrix.

## 12. Closure gate for issue #14

Issue #14 may close only when:

- the final PR head passes the complete `CI` workflow;
- the same head passes `Storage acceptance` and publishes its evidence artifact;
- the PR is merged without weakening the storage or evidence paths;
- the resulting `main` commit passes both workflows again;
- the issue receives a completion comment linking the PR, merge commit, workflow runs, artifact, scenario count, and remaining adjacent issue boundaries.

No check may be treated as passing because the code compiled or because a manual spot check appeared successful.

## 13. Rollback

If schema v2 must be rolled back:

- preserve `skribs.json`, temporary, backup, quarantine, and diagnostics files;
- do not launch an older writable build until downgrade handling is proven;
- use a read-only recovery/export tool or explicit migration build;
- never overwrite schema-v2 data with schema-v1 output;
- record the source revision and integrity result used for restoration.
