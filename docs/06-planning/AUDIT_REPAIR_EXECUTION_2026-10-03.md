# Audit repair execution - 3 October 2026

## Execution summary

Reviewable source changes are integrated on `fix/ARC-66-audit-repairs-20261003` in [draft PR #275](https://github.com/Ankit6149/skribly/pull/275). Baseline: `598f5ed9b2a0e6fbc27d8da3ae599d02f5bf4e59`. Implementation head before this report: `01d2786070d8ea534a7b223aa88713a7a0617268`.

The 43 audit entries include confirmed source findings, candidates and readiness gaps. This report records repairs and remaining acceptance separately; it does not close every issue or declare a public release ready.

## What changed and why

- Native save-before-shortcut/close/Quit ownership, protected persistence recovery and import consistency address data-loss/deadlock risks.
- Reminder claim/write/lifecycle safeguards, local read/export access, consent preservation and stale-response protection address unreliable failure paths.
- Rich-save ordering, StrictMode lifetime, discard recovery, explicit attachment deletion and synchronous clipboard reservations address editor data safety. A queued paste cannot be invisible to the close/discard barrier. A paste during native quiescence gets retry feedback; the clipboard remains unchanged.
- One thin 30 px Type/Draw pill, image/PDF paste, clearer local file cards, selection bold/italic/underline/colour/highlight, keyboard resize and 11 working slash actions improve the existing editor. Literal `/` remains until a valid command is selected. The + control retains its existing behavior.
- Kalam is loaded for note content and existing handwritten surfaces. Type/Draw labels and other controls retain DM Sans; display typography remains Manrope. Font tokens/imports were preserved. Fallback-font captures from an isolated preview font-loading failure were rejected and replaced after actual font loading was verified.
- Required lint, CSS order/computed-style mutation checks, honest extension scope, safe cleanup leases, command failure propagation, truthful website copy/download errors and exact candidate provenance strengthen delivery safeguards.

## Verification and evidence

| Check | Result and scope |
| --- | --- |
| Integrated desktop tests | **51 files / 296 tests passed** |
| Root typecheck | Passed, including deferred extension typecheck |
| Required lint | **143 source files; zero warnings/errors**; invalid-hook negative fixture rejected |
| Full Cargo suite / rustfmt | **223 tests passed** (181 library, 3 app, 39 migration/recovery); fmt passed |
| Synthetic Edge tests | **3 passed**, without live accounts |
| Synthetic candidate provenance | **20 assertions passed**, no installer/process/signing operation |
| Website validation | **34 required files; 12 tests passed** |
| Production CSS order | **3 tests passed**, deliberate import-order mutations rejected |
| Root build | Passed; emitted CSS fixture checks 4 transparent surfaces, radii and opaque/radius mutations; Kalam font assets bundled |
| Product truth, governance, private-artifact validators | Passed; cleanup fixtures used a temporary local bare repository |
| SQL migration execution | All 4 migrations + assertions passed on isolated PostgreSQL 18.3 / PGlite 0.5.8 with synthetic auth schema/roles |
| Browser QA | Actual composer at 320/420 px: loaded Kalam/DM Sans, centered logo, thin normal-font pill, formatting/slash/paste/layout; local Interface Lab tabs/scale/runtime controls worked |

Development checks used local Node **22.18.0** / npm **11.6.1**. The owner builder requires the repository's **22.23.1 / 10.9.8** toolchain and rejected the local mismatch before key reads or build. Vite retains its >500 kB bundle advisory; unrelated Rust dead-code warnings remain. No background-resource improvement percentage is claimed.

## Finding disposition

Every acceptance item below remains distinct from source/build evidence. Original audit links and researched remedies remain in the hosted register.

| Entry | Repair / verification | Remaining boundary |
| --- | --- | --- |
| FE-01 | **Lifecycle repair tested.** Trash/Archive finish recurring rules without advancing them. | Installed reminder/lifecycle acceptance. |
| FE-02 | **Write guard tested.** Calendar mutations check current native entitlement and storage state; file/reminder deletion is guarded too. | Installed read-only and outage matrix. |
| FE-05 | **Save ordering tested.** A rejected older rich write preserves the newer pending draft. | Quota/crash and installed typing/IME acceptance. |
| FE-06 | **Deletion UX tested.** Inline X removes only a reference; stored-file deletion requires named confirmation. | Installed clipboard/file UX acceptance. |
| FE-10 | **Local access repair tested.** Find and export remain reachable during account-service failures; write entitlement stays enforced. | Installed account-outage/read-only acceptance. |
| FE-11 | **Source ready; deployment pending.** Routine refresh sends unchanged consent; explicit choices and persisted consent are retained. | Apply/review new migration and Edge function before shipping matching clients. |
| FE-07 | **Content detection tested.** Empty formatting is treated as empty; real lists/dividers/references remain content. | Installed close/empty-note acceptance. |
| FE-08 | **StrictMode repair tested.** Controller cleanup suspends and can reactivate; same-note updates preserve the session. | Windows editor lifecycle acceptance. |
| FE-12 | **Stale response repair tested.** Library previews and reminder panels reject superseded responses. | Installed navigation and delayed-storage acceptance. |
| FE-04 | **Atomic claim tested.** Due reminders and last-check metadata are claimed in one IndexedDB transaction. | Actual multi-WebView/notification acceptance. |
| FE-13 | **Recovery repair tested.** Discard journals both blob-bearing snapshots, compensates failures and retains unresolved recovery. | Actual quota, interruption and cross-store Windows acceptance. |
| FE-03 | **Source safeguard tested.** Composer Trash flushes typed and rich drafts before mutation. | Cross-window Windows lifecycle acceptance; original finding was a candidate. |
| FE-09 | **Mitigation tested; gap retained.** Rich mutations use one readwrite transaction. Inferred orphan sweeps are disabled. | Native deletion/tombstone protocol is needed before automatic blob reclamation; real multi-WebView acceptance. |
| FE-14 | **Cancellation repair tested.** Account generations and serialized native entitlement mutations prevent stale UI/claim results; sign-out failures have truthful retry paths. | Actual native in-flight entitlement/account failure acceptance; original finding was a candidate. |
| BE-01 | **Source repair tested.** Native operation ownership no longer blocks UI callbacks; docking commits use the UI owner. | Exact Windows contention, motion, focus and latency evidence. |
| BE-02 | **Protected transaction tested.** Licence and account state transactions serialize complete load/mutate/commit operations. | Installed concurrent access and interruption acceptance. |
| BE-03 | **Recovery repair tested.** Validated staged/backup generations preserve protected state and fail closed on unsupported formats. | Antivirus/file locks and interrupted Windows commits. |
| BE-04 | **Transition contract tested.** Shortcut switching requests exact editor save acknowledgement before a bounded native commit. | Installed rich/ink/clipboard/shortcut timing. Dirty ink currently cancels safely instead of being flushed. |
| BE-05 | **Transition contract tested.** Quit and OS close request durable save and cancel on failure/timeout. | Installed Quit/close, ink and forced-termination limitations. |
| BE-06 | **Snapshot repair tested.** Import records and revision share one authoritative snapshot. | Installed import conflict and storage-failure acceptance. |
| BE-07 | **SQL fixture passed; deployment pending.** Version comparison handles numeric cores, prerelease and build metadata without integer overflow. | Hosted PostgreSQL/Supabase compatibility and reviewed deployment. |
| BE-08 | **Request fixture passed; deployment pending.** Streaming body caps and malformed/non-object JSON return truthful client errors. | Hosted Edge configuration/deployment acceptance. |
| BE-09 | **Partial source improvement.** Principal disk/account/library commands are async; icon extraction uses a worker. | Some startup/infrequent paths remain synchronous. Exact-binary startup, latency, idle CPU and WebView memory measurements remain open. |
| UX-01 | **Feedback repair tested.** Unknown/failed storage health is displayed explicitly. | Installed recovery/failure-state acceptance. |
| UX-02 | **Semantic repair tested.** Library actions use ordinary grouped buttons and pressed state. | Screen-reader/keyboard acceptance; this is not complete accessibility certification. |
| UX-03 | **Dialog repair tested.** Import has focus management, Escape and focus restoration. | Installed assistive-technology and import acceptance. |
| UX-04 | **Semantic repair tested.** Account mode controls no longer claim an incomplete tab pattern. | Installed keyboard/screen-reader acceptance. |
| UX-05 | **Keyboard repair tested.** Resize handles accept keyboard actions with bounded sizes. | Native resize, hit-test and mixed-DPI acceptance. |
| UX-06 | **Fixture isolation tested.** The exact dev preview uses synthetic IDs and memory rich/reminder storage. | It does not simulate installed persistence or account acceptance. |
| UX-07 | **Failure state tested.** Calendar loading/error/retry is distinct from an empty agenda. | Installed delayed-storage/error acceptance. |
| UX-08 | **Keyboard repair tested.** Calendar dates use one tab stop with arrow navigation. | Screen-reader/date and timezone acceptance. |
| AT-01 | **Required lint gate passed.** Required desktop lint checks 143 sources and proves invalid hooks fail. Integrated run has zero warnings/errors. | CI execution and owner workflow review. |
| AT-02 | **Source/build fixtures passed.** Production import order and emitted CSS have negative mutations; four surfaces compute transparent with current radii. | CSS/JSDOM does not prove native WebView compositor or installed paint behavior. |
| AT-03 | **Documentation reconciled.** Shortcut, eight colours, checklist, recurrence, current test matrix and deferred scope match current source. | Exact installed product claims still require acceptance. |
| AT-04 | **Scaffold labelled honestly.** Deferred Chromium has typecheck, without an artifact-producing build claim. | Extension remains deferred and is not shipped. |
| DS-01 | **Safety fixture passed.** Cleanup protects open PR heads/bases and uses current SHA deletion leases for merged branches. | Owner workflow review. No live remote branches were deleted or cleanup dispatched. |
| DS-02 | **Failure propagation tested.** Each required Windows validation command is a separate failing step before bundle creation. | Owner workflow review and an actual gated Windows run. |
| DS-03 | **Asset/control fixtures passed.** Loaded Interface Lab v3 assets, hashes and real DOM controls are checked; local browser controls operated. | No product website deployment or native product acceptance is claimed. |
| DS-04 | **Current copy reconciled.** Private encrypted owner delivery is distinguished from disabled public downloads. | Owner review and later product-site publication. |
| DS-05 | **Synthetic failure tests passed.** Download errors separate availability/header integrity and combined AES authentication failure, with a fetch deadline. | Exact owner artifact/browser acceptance; no real key or installer was used. |
| DS-06 | **Provenance safeguards tested.** Executable hash/path and selected process identity are separate from checkout HEAD; missing manifest means unknown source. | Exact-binary measurements. A local hash-matched manifest is not signed attestation; WebView child resources are excluded. |
| DS-07 | **Builder safeguards tested.** Clean approved full SHA, pinned toolchain, required gates and immutable hash/signing manifest precede candidate handoff. | No installer built. Local Node/npm mismatch was rejected before key/build access; owner review and supported-toolchain build remain open. |
| DS-08 | **Human decisions remain open.** Checkout explicitly returns unavailable. Owner/counsel/CA/provider decisions are documented without fabricated approval. | Seller/privacy/age/retention/tax/KYC/terms/refunds/signing decisions and sandbox fulfilment acceptance. |

## Impact, uncertainty and next execution

No live Supabase migration/Edge deployment, product-site publication, installer build, signing, payment enablement, owner-key generation or live branch deletion occurred. Existing private website installer remains unchanged. The audit report site is updated separately.

Native compositor/motion/focus, mixed DPI, real clipboard/IME/pen behavior, real cross-WebView contention, quota/crash recovery and exact installer lifecycle remain unverified. Pending ink safely cancels native transitions; the code does not promise to flush it. Orphan blob reclamation needs a native tombstone/deletion protocol before inferred sweeping returns. BE-09 is partial; DS-08 requires human decisions.

Next execution: owner review of PR #275's storage/licensing/workflow/release boundaries; reviewed hosted migration/Edge compatibility matrix; supported-toolchain private candidate with immutable hashes; exact Windows owner acceptance of those hashes (save/close/Quit, failed rich/ink saves, paste/discard timing, focus/DPI/paint/motion, install/upgrade/uninstall/recovery and resource measurements). Public downloads and commerce stay held until their separate gates pass. Mobile/extension/cloud sync remain deferred.

Human decisions required: repository-owner review under CONTRIBUTING.md, installed acceptance and distribution/signing route; legal seller/privacy/age/retention and terms; CA tax/invoicing review; provider KYC and sandbox fulfilment. This execution does not fabricate these approvals.

## Recovery and tracking

Use the reviewed PR to revert bounded source changes; preserve protected and discard recovery generations. Do not delete account/trial/customer rows or reset local data to bypass failures. Ship frontend/native acknowledgement contracts together. Backend rollback needs a reviewed replacement migration/function retaining consent/trial data. CI/workflow source changes remain proposals until owner review.

Executor: Codex coordinator with requested parallel repair_editor, repair_native, repair_frontend (Luna) and repair_delivery (Luna); frontend cross-reviewed the native/editor barrier and the queued-paste gap was repaired with a mounted regression.

**Part of ARC-66. Linear write-back pending:** the connector returned a reauthentication error. No Linear status/comment update is claimed. GitHub issues remain open where acceptance is outstanding. GitHub is not mirrored into new Linear issues.
