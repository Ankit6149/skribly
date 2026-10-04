# Native reliability repairs — 3 October 2026

Scope: audit BE-01 through BE-09; GitHub #261–268 and account consent #258. Implementation evidence is not installed Windows or live backend acceptance.

## Native transaction ownership

The operation gate never blocks a native UI callback. A contended transaction returns a retry error or retains the previous native state. Docking debounce and shortcut placement queue native work on the event loop; workers do not own a gate while awaiting that work. Superseded docking generations remain cancelled. The gate still serializes physical commits; contention does not authorize an unlocked commit.

Native shortcut, Quit and OS editor-close first request a durable frontend save. The worker waits at most five seconds, without owning a native gate, for the exact request acknowledgement from `main`. A stale acknowledgement, changed active note, failure or timeout cancels the transition. Request-scoped input quiescence remains until the native `native-transition-finished` outcome; a transferable ticket owns the transition until commit, and the active note plus five-second deadline are revalidated under the native gate before any queued action can commit. Quit retains the editor on failure. The composer must flush text, rich text and ink through this contract; forced termination and Windows end-session cannot promise a JavaScript save.

## Protected local persistence

Licence status/activation/deactivation and protected account vault reads/mutations serialize the complete load/modify/commit transaction. A one-minute licence clock watermark remains below the existing five-minute rollback tolerance; repeated unchanged status checks do not rotate generations.

Account protection remains Windows user-scoped DPAPI. Licence signature/device validation is unchanged. Durable writes use synced staged bytes and Windows replacement without removing the primary first. Recovery validates the primary, backup, then staged generation; damaged primary bytes are preserved before restoration. Unsupported format versions block writes and recovery rather than resetting account/licence state. An explicit credential removal also replaces its recovery backup with the committed redacted vault/state, so restart recovery cannot restore a removed credential.

No persistent schema change was introduced. Backup filenames match existing `.tmp`/`.bak` files. Nothing reads or changes the owner's personal files during tests.

## Import and responsiveness

Import preview collection and storage revision now use one authoritative mutation-lock snapshot. The preview cannot bind older records to a newer optimistic revision.

Icon extraction runs on a blocking worker. Text/colour/position writes, local account vault operations, licence application, and principal library lifecycle commands execute asynchronously instead of blocking the native event loop. Startup, native placement transactions and some less frequent storage paths remain synchronous; installed latency/idle CPU measurements are still required. No speculative performance percentage is claimed.

The final source pass also moves library export/import preview/import apply and licence status/activation event listeners onto Tauri blocking workers. The listener copies the owned event payload and handle, then returns; request identifiers, validation, authoritative import snapshot locking, durable backup/commit, and result events are preserved. A bridge mutex keeps licence read/mutation and response emission together so these workers cannot publish an earlier status after a newer activation response. Preference saves, storage-health reads (which can wait for a concurrent storage lock), note-library cloning/sorting, the data-only collapsed flag mutation, target application launch, and the account device claim now use asynchronous command dispatch. Clearing an account entitlement awaits its protected durable write on a blocking worker, then explicitly queues the existing editor-hide transaction on the native main thread. A failed queue reports that account clearing succeeded but hiding did not. These workers only serve existing explicit requests; no timer, polling loop, telemetry or new idle task was added.

BE-09 remains a Windows performance acceptance item. Initial startup storage/DPAPI setup, shortcut note creation/reopening, and placement/collapse/resize/position commits that currently couple native UI state to durable note mutations still execute synchronously. Moving those transactions safely requires retaining event-loop ownership, rollback and stale-action checks across separate phases; a blanket worker annotation would weaken that contract. Installed p95/p99 latency and idle CPU/memory evidence are still required before claiming this audit outcome complete. Dirty ink currently cancels a native transition safely rather than being flushed by the native layer; the composer owns ink flushing and must remain paired with the request-scoped acknowledgement contract.

## Backend deployment boundary

The Edge Function applies its request cap while reading, returns 400 for malformed/non-object JSON, and treats omitted/null consent as unchanged. Explicit boolean choices remain supported. A new, unapplied migration compares accepted versions without integer overflow or prerelease/build parsing failure and returns persisted consent. Existing deployed migrations were preserved.

Deployment remains a separate owner-reviewed action: apply and verify the migration before deploying clients that omit consent. Run the supplied SQL assertions on an isolated PostgreSQL/Supabase fixture, then the account/concurrency/advisor matrix. No live schema, account, signing key or service configuration was changed.

## Verification and remaining acceptance

Automated regression coverage includes nonblocking gate contention and successful retry, stale transition acknowledgement rejection, DPAPI round-trip and sign-out recovery, 128 concurrent licence status reads, validated missing/corrupt-generation recovery, future-format refusal, and a barrier-controlled import snapshot. Synthetic Edge tests cover invalid/null JSON, streaming cancellation and consent request/response compatibility.

Exact commands/results are recorded in the execution report. Existing dead-code compiler warnings remain unrelated. Required Windows acceptance: repeated shortcut/close/Quit during debounce, failed disk save and rich/ink saves; drag/open/close on both edges; mixed DPI/monitors; antivirus/file locks; force interruption of protected generation commits; startup/recovery; idle resource and UI latency measurements. These tests use a synthetic profile, never the founder's account/note profile.

Integration verification on 3 October: the complete Cargo manifest suite passed 223 tests (181 library, 3 application, 39 embedded migration/recovery tests), with `cargo fmt --check` passing. The migration harness now imports the durable generation module used by the embedded account/licence sources.

All four account migrations and the supplied SQL assertions also executed successfully against an isolated in-memory PostgreSQL 18.3 engine through PGlite 0.5.8, with synthetic auth tables/roles. This checks SQL execution, version precedence, preserved/explicit consent and trial snapshots. It does not establish hosted Supabase compatibility, cross-connection contention, or production deployment acceptance.

## Rollback/recovery

Source rollback restores the previous implementation without a data-format migration; retain protected recovery generations and avoid manually deleting primary files. An older implementation will not provide the new interruption guarantees. If storage becomes unreadable, preserve all generations and use validated recovery; do not reset trial/account metadata to make an error disappear.

Backend rollback requires an owner-reviewed replacement function/migration preserving existing consent and trial rows; do not delete production metadata. If frontend/native save acknowledgement contracts are mismatched, native transitions time out safely and the previous editor remains available. Ship the native and composer contract together.
# Windows long-path atomic replacement follow-up — 3 October 2026

The owner storage matrix found a runtime failure outside the shorter unit-test directories. The existing release `storage_acceptance.exe` seeded a new synthetic 106-character path successfully (revision 3, writable), but the same seed on a new 367-character path failed with the protected-state atomic-replacement error. No real application data was read or copied.

Both protected account/licence/health generation replacement and note generation replacement passed raw paths to `MoveFileExW`. [Microsoft documents its default MAX_PATH limit and extended-length namespace](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw). Both sites now share a helper that canonicalizes the existing parent directory, appends the original filename, and encodes the resulting Windows extended-length path. [Rust documents that canonicalize uses extended-length Windows syntax](https://doc.rust-lang.org/std/fs/fn.canonicalize.html). Resolving the parent supports a destination that does not yet exist and avoids following a file symlink. Existing replace/write-through flags and privacy-safe protected-state errors remain unchanged; no registry or global long-path setting was changed.

Three new Windows regressions verify long-path save/backup/redaction/recovery, unchanged new-destination names with explicit extended paths, and delete-denying handles/read-only destinations preserving prior bytes. All four durable-state tests passed. The updated library test executable then passed **184 tests**, zero failures, directly without another compile. Its SHA-256 was `9C6244B190757833CBF04B29D091A26A8C4C988CFD0FC5CA3EBB9F7E28A72639`.

The initial unfiltered Cargo test command hit disk exhaustion while creating a non-test static archive; the `--lib` test executable had already built and passed. This is a build-environment gap, not evidence of successful installer packaging. The release storage acceptance executable must be rebuilt from this change and the full synthetic long-path matrix rerun before the new owner candidate is accepted. Actual network-share operation was not tested; UNC namespace handling follows Rust canonicalization, with no SMB runtime claim.
