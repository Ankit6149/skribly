# Public release readiness — 11 October 2026

Part of ARC-66. Executor: Codex. Owner: Ankit Bhardwaj.

The owner wants a public release on **12 October 2026**. The current decision is **hold**: source verification is passing, but an exact public candidate has not met the release and installed-Windows gates. A date is a target, not acceptance evidence.

## Scope and product decisions

The proposed shortest release scope is Windows x64 only. Free public beta versus paid launch is awaiting the owner's answer. The current product requires account verification and enforces a server-owned seven-day account/device trial; checkout intentionally returns HTTP 503. Do not advertise unlimited free use or enable sales without a reviewed entitlement/commercial decision.

Android v0.0.2 remains a separate private ARM64 preview. Live sync, Creative canvas, Android PC-settings control, complete rich-content backup and Android OS notifications are unfinished. They must not be included in tomorrow's release claims. This review does not approve a storage migration, licensing change, new network path, signing operation or public publication.

## Evidence collected today

- Workspace typecheck passed.
- Desktop tests: 56 files / 317 tests passed. Android: 24 frontend and 3 packaging checks passed.
- Workspace production build, required desktop lint, product-truth validation, governance validation and website validation passed. Website: 19 tests passed.
- Rust formatting passed. Full native cargo test command passed, including the 187 library tests and 42 storage/durable-state integration tests.
- Candidate provenance: 20 synthetic assertions passed; these do not install, sign or test an owner binary.
- Source panel at 388×800: search, unmatched-search state, app filtering and empty Archive checked. At 320×600 all five cards were 88 px high and 265.8 px wide; document width remained 320 px. At 388 px, filtered cards were 333.8×88 px. Captures are in docs/01-design/evidence/beta-review-2026-10-11/.
- The retained delivered v0.1.53 installer is 3,764,618 bytes, SHA-256 `94e91358b9524fa326638930e376886b74665c9c7b112b7306d0afed7cc957c0`, matching the October 4 delivery record. Authenticode status is **NotSigned**. It does not contain the newer uncommitted beta refinements.
- GitHub CLI is unauthenticated; no remote PR has been created in this pass. Linear ARC-66 and its latest execution reports were read; owner design selection and installed acceptance remain open.

Initial checks used the existing Node 22.18.0 / npm 11.6.1 environment. The required Node 22.23.1 Windows x64 archive was subsequently downloaded from nodejs.org and verified against its official SHA-256 `7df0bc9375723f4a86b3aa1b7cc73342423d9677a8df4538aca31a049e309c29`. Its bundled npm is 10.9.8. The portable toolchain is in ignored artifacts/toolchain/node-v22.23.1-win-x64; no machine-wide installation or security setting was changed. This resolves toolchain availability, not clean-candidate provenance.

All seven frontend/website gates were subsequently repeated under the required Node 22.23.1 / npm 10.9.8 toolchain and passed: typecheck, test, build, lint, product-truth, governance and site. Per-gate logs are retained in ignored artifacts/frosted-panel-review-20261011/validation/. Dependencies were not reinstalled in a clean checkout, so this is source/toolchain verification rather than a reproducible candidate build.

Existing warnings remain: Vite's greater-than-500-kB chunk advisory and Rust dead-code warnings. Neither establishes a runtime failure, and neither substitutes for performance measurement.

## Release gates still open

| Gate | Current gap | Required evidence before public delivery |
| --- | --- | --- |
| Frozen source | Beta refinements remain uncommitted; new panel direction is unselected | Reviewed immutable commit/PR; selected release scope and exact candidate identity |
| Reproducible candidate | Existing owner artifact predates refinements; no fresh candidate produced today | Clean checkout, locked install, supported toolchain, recorded gates, exact installer/application hashes |
| Signing/distribution | Retained package is unsigned; signing availability is awaiting owner answer | Approved route and exact signed package; verify Authenticode after packaging |
| Windows lifecycle | No new installed-device evidence | Clean install, upgrade/retention, duplicate launch, shortcut, focus, close/Quit, sleep/resume, mixed DPI, both dock sides, uninstall/rollback |
| Data/recovery | JSON excludes ink, attachment blobs and reminders | Exact-candidate durability/recovery and clean-profile restore; truthful backup limitations; review complete-backup design before persistence changes |
| Accessibility/performance | Browser checks are supporting evidence only | Keyboard/screen reader, text scaling, forced colours, reduced motion, startup and combined app/WebView idle CPU/memory |
| Account/security/support | Public onboarding and failure/deletion/support acceptance not recorded | Verify new-user access, outage/read-only behavior, deletion/retention and working support/private reporting contacts |
| Public website/release | Owner-key delivery only; production release workflow explicitly held | Reviewed public download/copy matching the exact accepted package, hashes, version, requirements, limits and recovery/support guidance |
| Paid launch, if selected | Sales unavailable; owner/professional/provider decisions and fulfillment open | Complete applicable checklist and payment/entitlement lifecycle before enabling checkout |

The current workflow .github/workflows/release.yml intentionally does not build or publish installers. Do not remove the hold, signing requirements or truthful status to meet the date.

## Execution order for the target date

1. Resolve public beta versus paid launch and signing availability. The owner selected a saturated ticket-grid reference and authorized panel implementation; the rejected Image Gen mocks are no longer a selection gate.
2. Finish only the selected Windows scope, review and freeze it, then prepare a source-bound candidate using the required toolchain. Avoid combining tomorrow's release with the deferred companion/migration features.
3. Test the exact packaged candidate with synthetic data and a clean profile, record installer/runtime/data/accessibility/performance evidence, and repair reproduced failures before freezing again.
4. Complete applicable account, privacy/support and distribution decisions; prepare truthful public download/release notes against that exact package.
5. Make a go/no-go decision from the retained evidence. Obtain the owner's concrete publication approval if required by the release boundary, then publish and verify actual public retrieval. If any gate remains unresolved, keep download private and change the date.

## Frosted panel follow-up

The owner rejected the Image Gen mocks and selected a ticket-grid image instead. Source now expands the global rail across the monitor work area, uses saturated ticket cards over a dark translucent backdrop, supports 32 note colours, enlarges the note app pill and shows captured folder/page titles.

Correction to the earlier audit: native backdrop was already wired through Windows DwmSetWindowAttribute with DWMSBT_TRANSIENTWINDOW while expanded. The former heavy pastel tint obscured that material. The new browser backdrop-filter supports source previews; it does not prove desktop blur. Installed Windows acceptance of full-view geometry, native material, docking restoration and focus remains pending. Source implementation and screenshots do not establish public readiness.

ARC-66 remains open. This report records current evidence and remaining work; it does not claim the product is ready, signed or publicly released.
