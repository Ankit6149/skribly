# Audit repair follow-up — 3 October 2026

## Execution summary

Source follow-up for **Part of ARC-66**, [draft PR #275](https://github.com/Ankit6149/skribly/pull/275).
This supplements the [earlier repair execution snapshot](AUDIT_REPAIR_EXECUTION_2026-10-03.md);
the 43 original audit entries remain distinct from build and installed acceptance.

**Private v0.1.52 candidate status: all build gates passed; encrypted delivery prepared; website update held for backend approval.**
The earlier candidate was held after the synthetic Windows storage matrix exposed a long-path
atomic replacement failure. Repair commit `c05c9411939b07f65f546c1b6def22387eb2cbda` is integrated;
three new Windows regressions and the updated 184-test library suite pass. The coordinator has
finished the complete candidate gates. The preceding `c8796d3` candidate passed all 20 build gates
and all 15 release storage scenarios, but CI then exposed a modal-focus race. The coordinator repaired
that race in `62f031ab8a98018c213a777dfefe8aa2f2eac44a`; the final candidate passed all 20 gates,
including all 15 release storage scenarios. Both NSIS and MSI installers were built and branded.

**Exact final candidate source SHA:** `62f031ab8a98018c213a777dfefe8aa2f2eac44a`.
**NSIS:** 3,756,851 bytes; SHA-256 `bfa590f9c1a5f893a9a56c0ff5e98d01b76a85adc397533853f4346bacebffb8`.
**MSI:** 5,005,312 bytes; SHA-256 `0750275965b57d3fce9669a030d52f7430df97b9683648fde13f8c99c49e880b`.
**Application:** 13,933,056 bytes; SHA-256 `642a2cb2b19eda60df92d00561fc77aa6bcafe45e9868cd015b2f26633b9f978`.
All three are **NotSigned**. The immutable source/toolchain/gate manifest and storage/branding evidence
were retained outside the repository. Local decryption of the staged encrypted NSIS matches its exact
manifest hash using the existing external owner key. The key was not printed, committed or uploaded.
Website publication and downloaded-byte verification remain pending backend approval.
The product website still serves **v0.1.51**. The matching backend migration/Edge deployment remains
awaiting owner approval; no production mutation is claimed.

## What happened and what changed

- Active ink now participates in native shortcut, OS close and Quit preparation. The canvas
  finalizes an active stroke and awaits pending ink persistence alongside text/rich saves within a
  **3.5-second frontend save budget**. Failure or timeout cancels safely and retains the editor;
  the native request identity, gate ownership and bounded deadline remain in place.
- Explicit library export/import and licence event operations run on blocking workers. Preference
  saves, storage-health reads, library cloning/sorting, data-only collapse updates, device claims and
  target launch use async dispatch. Entitlement clearing commits on a worker before queueing native
  hiding on the main thread. Licence bridge state and response emission remain serialized.
- SQL version comparison validates the whole SemVer value before comparing cores. Empty identifiers,
  forbidden numeric leading zeroes and whitespace are rejected. Edge validation fails before account
  calls; stable, prerelease **or** build client formats remain supported. Combined prerelease plus
  build client versions remain outside the existing profile constraint.
- Windows atomic replacement now handles long paths in the shared protected-state helper and note
  storage. The repair preserves replacement/recovery semantics and has three Windows regressions.
  The optional `storage_acceptance` feature binary now imports/re-exports the shared durable-state
  module, so its release build exercises the current protected storage implementation.
- Candidate preparation requires the release storage crash/interruption/file-lock matrix under a
  synthetic APPDATA profile and modern PowerShell before producing a handoff. Cleanup is bounded
  to verified synthetic fixture directories; personal profiles are not acceptance fixtures.
- Interface Lab integrity checks now follow canonical **LF** source bytes. Git attributes, recorded
  asset hashes and the LF regression agree across clean checkout and deployment bytes. The product
  validator describes the current combined Type/Draw, formatting, slash and attachment contract.
- Existing note handwriting remains **Kalam**. The thin Type/Draw control uses **DM Sans**, matching
  other controls; display typography remains **Manrope**. This is not a global font replacement.
- Re-enabling the editor after the close dialog no longer steals focus restored to the invoking
  button. Switching to another note still focuses its editor. The mounted dialog test now explicitly
  runs deferred autofocus, and a separate regression covers re-enabling and note switching.

## Findings and why

The release storage gate found a defect that ordinary library tests had not covered: long synthetic
Windows paths could fail during atomic replacement. Candidate handoff stopped at that failure.
The source repair, new regressions and rerun of the required release matrix all passed for the
repaired candidate. This establishes build/fixture evidence, not installed acceptance.

Ink flushing removes the earlier inconvenient cancellation whenever ink was dirty while preserving
the fail-safe native transition. Worker routing reduces explicit request work in native callbacks;
it does not prove native animation smoothness or measured performance. Strict version validation
prevents malformed announcement metadata from passing merely because its core is older. LF
integrity checks make byte hashes reflect the deployed source rather than local checkout conversion.

## Evidence and verification

| Check | Recorded result / limitation |
| --- | --- |
| Desktop | **54 files / 308 tests passed** on final candidate source |
| Required lint | **147 source files; zero warnings/errors**; invalid-hook fixture rejected |
| Updated native library | **184 tests passed**, including three new Windows long-path regressions |
| Integrated native suite | **229 test executions passed**: 184 library, 3 application and 42 migration/recovery; formatting passed |
| Synthetic Edge | **5 tests passed**, including invalid-version rejection before account calls |
| Site | **34 required files validated; 13 tests passed**, including LF asset integrity |
| Isolated SQL | All **four migrations** and expanded consent/version/trial assertions passed on PostgreSQL **18.3 / PGlite 0.5.8**, synthetic Auth/roles; not live PostgreSQL 17.6 or cross-connection evidence |
| Current candidate release storage matrix | **15/15 passed** on final source, including long-path crash, lock, corruption and permission fixtures |
| Candidate-source CI | All five CI jobs and Windows release storage acceptance passed on `62f031a` |
| Installer/build/signing/download evidence | **20/20 build gates passed**; NSIS/MSI branding passed; immutable hashes recorded; unsigned; local encrypted NSIS decryption matches manifest. Website handoff pending |

Candidate gates require a clean approved full source SHA, pinned **Node 22.23.1 / npm 10.9.8**,
locked dependencies, supported Rust/Cargo, no unapproved environment overrides, and modern PowerShell.
Mandatory checks include governance, product truth, site, private-artifact workflow, React runtime,
theme, compact surface, lint, typecheck, tests, production build, Rust formatting and native tests.
The release storage feature binary and crash/file-lock matrix precede the trial-enforced native check
and NSIS/MSI bundling. An immutable manifest records source/toolchain/configuration, gate outcomes,
storage-evidence hash, application/installer hashes and actual signing state; existing candidate
evidence must not be overwritten. All 20 gates passed for the candidate source above.

## Impact

The repairs improve data safety, explicit request responsiveness, editor behavior and candidate
assurance. No new idle polling, telemetry, note-content upload, cloud sync or public commerce is
introduced. Local tests use synthetic fixtures. Public reports exclude private keys, account data,
raw paths/logs and security proof details. The earlier website installer remains unchanged.

Android foundation is separate: [draft PR #277](https://github.com/Ankit6149/skribly/pull/277),
[open issue #276](https://github.com/Ankit6149/skribly/issues/276), **17 foundation tests passed**.
No APK, physical-device acceptance, desktop-to-mobile sync or released mobile capability is claimed.

## Remaining gaps and uncertainty

- Candidate full suite, release storage matrix, package hashes/signing and local encrypted-byte proof
  are recorded. Website download verification remains pending. An installer build is not installed Windows acceptance.
- Laptop tests remain necessary for close/sliding, paint/white flashes, focus, clipboard/files,
  ink/text saves, disk failure/recovery, multi-monitor/DPI and install/upgrade/uninstall/retention.
- BE-09 retains synchronous startup and UI/persistence placement transactions; exact-binary latency,
  idle CPU and WebView memory measurements remain open. No performance percentage is claimed.
- FE-09 retains the disabled inferred orphan sweep pending a safe native deletion/tombstone protocol.
- Account deployment awaits the explicit owner decision in the [backend execution proposal](../04-operations/ACCOUNT_REFRESH_DEPLOYMENT_2026-10-03.md).
  Migration must precede matching Edge deployment. Rollback after shipping null-sending clients must
  preserve null-as-unchanged consent, RPC columns and service-only grants; do not restore incompatible
  old parser/RPC code or reset trial/account rows. Production acceptance and concurrent claims remain open.
- Public distribution, signing/trust, password-protection decisions, legal/tax/KYC/commerce and mobile
  physical acceptance remain separate gates. Forced process termination cannot guarantee a JS save.

## Next recommended execution

After the required backend decision, execute only the approved migration-then-Edge scope.
Verify any authorized private website replacement and downloaded installer hash before giving the
owner a laptop test handoff. Update the dated hosted report and existing issues with actual outcomes;
keep acceptance open where Windows, backend or human verification remains.

## Human decision required

Backend production execution is still pending owner approval. The private candidate is built and
verified within the stated build/fixture boundary. The owner performs laptop acceptance after a verified
website handoff. No public release, signing change or paid-plan/Auth-settings change is approved by
this source report.

## Executor and tracking

Executor: Codex coordinator and the requested parallel native, editor, frontend, delivery and Android
agents. Meaningful source work is committed for review; completion is bounded by the evidence above.
**Linear write-back pending:** the connector requires reauthentication; no Linear update or closed
status is claimed. Use this execution report for the same existing outcome once access is restored.
