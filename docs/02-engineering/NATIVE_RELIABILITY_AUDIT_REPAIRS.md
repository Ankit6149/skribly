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

## Backend deployment boundary

The Edge Function applies its request cap while reading, returns 400 for malformed/non-object JSON, and treats omitted/null consent as unchanged. Explicit boolean choices remain supported. A new, unapplied migration compares accepted versions without integer overflow or prerelease/build parsing failure and returns persisted consent. Existing deployed migrations were preserved.

Deployment remains a separate owner-reviewed action: apply and verify the migration before deploying clients that omit consent. Run the supplied SQL assertions on an isolated PostgreSQL/Supabase fixture, then the account/concurrency/advisor matrix. No live schema, account, signing key or service configuration was changed.

## Verification and remaining acceptance

Automated regression coverage includes nonblocking gate contention and successful retry, stale transition acknowledgement rejection, DPAPI round-trip and sign-out recovery, 128 concurrent licence status reads, validated missing/corrupt-generation recovery, future-format refusal, and a barrier-controlled import snapshot. Synthetic Edge tests cover invalid/null JSON, streaming cancellation and consent request/response compatibility.

Exact commands/results are recorded in the execution report. Existing dead-code compiler warnings remain unrelated. Required Windows acceptance: repeated shortcut/close/Quit during debounce, failed disk save and rich/ink saves; drag/open/close on both edges; mixed DPI/monitors; antivirus/file locks; force interruption of protected generation commits; startup/recovery; idle resource and UI latency measurements. These tests use a synthetic profile, never the founder's account/note profile.

## Rollback/recovery

Source rollback restores the previous implementation without a data-format migration; retain protected recovery generations and avoid manually deleting primary files. An older implementation will not provide the new interruption guarantees. If storage becomes unreadable, preserve all generations and use validated recovery; do not reset trial/account metadata to make an error disappear.

Backend rollback requires an owner-reviewed replacement function/migration preserving existing consent and trial rows; do not delete production metadata. If frontend/native save acknowledgement contracts are mismatched, native transitions time out safely and the previous editor remains available. Ship the native and composer contract together.
