# Skribli

**Put a Skrib where the thought belongs.**

> **Status — active product development**  
> Public downloads remain disabled while the Windows desktop build completes its data-safety, lifecycle, context, recovery, accessibility, physical-runtime, and release-validation gates.

Skribli is a local-first contextual annotation application for Windows. Its product scope is broader than notes: handwriting, highlights, arrows, images, reminders, screenshot pins, and context attached to screens, applications, pages, files, and folders all belong to the long-term system. The current Founder Alpha implements the first honest slice—typed contextual **Skribs** in a compact editor—without pretending the richer tools are already shipped.

A normal launch always opens the visible **Skribli Home** window. Fresh users see account setup first, then a compact guide that explains the shortcut and local-first behavior, and finally a ready Home surface. The guide creates no sample Skrib and can be reopened later from **Quick guide** in the tray.

A verified account is mandatory for write access in enforced builds. The account service stores only verified email, trial/entitlement state, a one-way device claim, app version, and the user’s optional product-update consent. Skrib content remains on the Windows device. Changing accounts or reinstalling on the same Windows device does not restart that device’s trial.

## Current Windows build contract

The active compact-note flow is:

1. Focus a supported Windows application.
2. Press **Ctrl + Shift + Space**.
3. Skribli captures the foreground target once, clears any previous runtime target, and revalidates the exact HWND and process identity before using it.
4. A compact note editor opens inside that target monitor’s usable work area.
5. Type while Skribli reports truthful **Unsaved**, **Saving**, **Saved**, or **Save failed** state.
6. Choose **Done**, press **Escape**, or press **Ctrl + Enter**.
7. Skribli hides only after the latest non-empty draft is durably saved. If persistence fails, the editor remains open so the draft is not silently lost.

When Windows cannot provide or revalidate a safe target, Skribli shows one actionable compact message, clears the previous target, and does not create, reopen, move, or focus a note.

Launching Skribli again in the same Windows user session restores the existing Home window instead of creating a surprise Skrib or starting a second storage writer, tray process, hotkey registration, or WinEvent hook set.

Windows accessibility events use bounded, non-blocking delivery with callback-side filtering and duplicate coalescing. Relevant foreground and active-target changes are processed by a separate consumer thread; unrelated child-object and non-target movement events are discarded before queue delivery.

The current build does **not** leave a floating dot, attached tab, permanent toolbar, or full-screen interactive overlay after the editor closes.

The create/reopen decision is deterministic, All Skribs recovery is available, ordinary deletion is reversible through Trash, and portable JSON import requires a non-mutating preview before one atomic apply. Durable versioned context identity, archive/indexing/attachment work, physical Windows acceptance, installer lifecycle, and signed release evidence remain tracked in the production-readiness backlog. Do not treat a successful compile or website deployment as proof that the Windows product is ready to distribute.

## Implemented foundations

- Tauri 2 desktop shell with React, TypeScript, Vite, and Rust.
- Compact fully interactive note window rather than a screen-blocking overlay.
- A visible, decorated Home window that opens on every normal launch and remains recoverable after setup failures.
- Mandatory email/password account setup with verified-email state, secure Windows DPAPI session storage, and explicit optional product-update consent.
- Server-owned seven-day trial records joined across verified account and privacy-minimized stable device claim.
- Server-signed native entitlements, bounded offline grace, and native write blocking after sign-out, invalid entitlement, clock rollback, or trial expiry.
- Versioned first-run state with explicit **unseen**, **shown**, and **completed** behavior.
- Visible three-step first-Skrib guide with local-first privacy and Close/Hide-versus-Quit education.
- Reopenable **Quick guide** and **Open Skribli** tray actions plus a visible retry surface when account or native setup fails.
- Fail-closed one-shot foreground capture with HWND and process-identity revalidation before placement or note access.
- Visible privacy-safe recovery guidance when target capture fails, without creating or reopening a note.
- Target-monitor work-area placement using fresh HWND geometry and per-monitor DPI.
- Final native placement validation, fail-closed errors, and a keyboard-accessible **Reposition** action.
- Per-Windows-session named-mutex guard acquired before the Tauri runtime starts.
- Second-launch routing to the existing visible Home window.
- Bounded, non-blocking, filtered, and duplicate-coalesced Windows event delivery.
- Privacy-safe event counters for filtering, delivery, saturation, disconnection, processing, and pending capacity.
- Local versioned JSON persistence with crash-recovery generations and storage diagnostics.
- Ordered/coalesced text persistence with truthful save and retry states.
- Final-save flush before the compact editor hides.
- Rust-side note mutation validation for IDs, Unicode length, colours, and geometry.
- A normal non-floating **All Skribs** window with deterministic ordering, search, read-only detail, selected-note export, and complete portable backup export.
- Reversible Trash with 30-day recovery guidance; permanent deletion exists only inside Trash after note-specific confirmation.
- Portable JSON import with strict validation, non-mutating preview, duplicate/conflict reporting, revision/fingerprint locking, verified rollback backup, and atomic apply.
- No console window in the Windows release build configuration.
- Locally bundled Kalam handwriting typography for Skrib content; the editor never depends on a remote font request.
- Global **Ctrl + Shift + Space** shortcut and tray-based background process.
- Public downloads and payment flows disabled while release gates are incomplete.

## Current release blockers

The canonical execution tracker is [issue #34](https://github.com/Ankit6149/skribly/issues/34). The most immediate blockers include:

- [#15](https://github.com/Ankit6149/skribly/issues/15) remaining shutdown, installer, suspend/resume, and lifecycle evidence after the core single-instance guard;
- [#17](https://github.com/Ankit6149/skribly/issues/17) physical idle, event-storm, accessibility-heavy application, Remote Desktop, suspend/resume, and long-session evidence after bounded event delivery implementation;
- [#18](https://github.com/Ankit6149/skribly/issues/18) durable versioned context identity, ambiguity/re-anchor policy, migration, and physical evidence after fail-closed shortcut capture;
- [#19](https://github.com/Ankit6149/skribly/issues/19) physical mixed-DPI, topology-change, taskbar, and Remote Desktop evidence after monitor-safe placement implementation;
- [#20](https://github.com/Ankit6149/skribly/issues/20) remaining archive, broader context/lifecycle consistency, usability evidence, and exact release-binary validation after deterministic create/reopen and reversible Trash delivery;
- [#21](https://github.com/Ankit6149/skribly/issues/21) remaining archive, scalable indexing/filtering, attachment portability, broader backup/recovery, and exact physical evidence after All Skribs, export, Trash, and portable import delivery;
- [#24](https://github.com/Ankit6149/skribly/issues/24) release-blocking Windows runtime evidence;
- [#25](https://github.com/Ankit6149/skribly/issues/25) signed reproducible installer and rollback pipeline;
- [#28](https://github.com/Ankit6149/skribly/issues/28) final production ownership/migration of the temporary account service, update-email operations, and payment entitlement integration (payments remain deferred to #27);
- [#51](https://github.com/Ankit6149/skribly/issues/51) remaining shortcut-conflict detection, migrations, settings integration, permissions education, usability studies, and release-candidate onboarding evidence after the first-note guide.

An issue must remain open when only part of its acceptance criteria has been implemented. Progress belongs in a detailed issue comment with exact commits, checks, missing runtime evidence, and remaining work.

## Product boundaries

### Current release target

- Windows desktop only.
- Typed contextual Skribs through a compact transient editor as the first annotation tool.
- Mandatory verified account for trial/write access; Skrib content itself remains local.

### Deferred and unavailable in the current build

- macOS support;
- browser URL or DOM-element anchoring;
- the not-yet-implemented ink, highlighter, arrow, shape, pin, reminder, screenshot, and attachment tools;
- cloud sync, collaboration, mobile apps, AI, OCR, plugins, and a marketplace.

Deferred capabilities are tracked under [issue #46](https://github.com/Ankit6149/skribly/issues/46). Their placeholder code or documentation must not be interpreted as released support.

## Repository and licence status

This repository is publicly visible for development and issue tracking, but Skribli is proprietary software and is **not open source**. Public access does not grant permission to copy, deploy, redistribute, or build another product from its source or assets. See [`NOTICE.md`](NOTICE.md) and [`docs/06-planning/REPOSITORY_GOVERNANCE.md`](docs/06-planning/REPOSITORY_GOVERNANCE.md).

## Repository map

```text
skribly/
├── apps/desktop/              Active Tauri + React Windows application
├── extensions/chromium/       Deferred placeholder; not a released capability
├── packages/design-system/    Shared visual tokens and primitives
├── packages/shared/           Shared models; production use must remain capability-gated
├── assets/                    Product and branding assets
├── docs/                      Product, engineering, operations, and planning documents
├── scripts/                   Validation, governance, storage, and licence tooling
└── site/                      Product website with downloads disabled
```

## Development prerequisites

- **Node.js 22.23.1 LTS** is the canonical local and CI runtime recorded in [`.nvmrc`](.nvmrc).
- Supported managed environments may use Node `>=22.12.0 <23`.
- **npm 10.9.8** is the canonical npm version.
- Current stable Rust toolchain with `rustfmt`.
- Windows build tools, SDK, and WebView requirements for native desktop work.

Verify the local runtime before installing dependencies:

```bash
node --version
npm --version
```

## Local validation

```bash
npm ci
npm run governance:validate
npm run product-truth:validate
npm run site:validate
npm run typecheck
npm run test
npm run build
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1
```

These commands prove static, frontend, and Rust test gates only. Windows acceptance must also exercise the exact release binary across supported OS versions, applications, display arrangements, scaling values, shortcut conflicts, storage faults, lifecycle events, and installer paths. Evidence must identify the exact commit and binary hash.

## Documentation sources of truth

- [Product backlog and contribution map](docs/06-planning/PRODUCT_BACKLOG_AND_CONTRIBUTION_MAP.md)
- [Historical full-product audit and current execution gates](docs/06-planning/FULL_PRODUCT_AUDIT_AND_EXECUTION_PLAN.md)
- [Current and future product requirements](docs/00-product/PRD.md)
- [Canonical compact-editor interaction specification](docs/01-design/INTERACTION_SPEC.md)
- [First-run and quick-guide acceptance](docs/04-operations/FIRST_RUN_ACCEPTANCE.md)
- [All Skribs library acceptance](docs/04-operations/ALL_SKRIBS_ACCEPTANCE.md)
- [Reversible Trash acceptance](docs/04-operations/TRASH_ACCEPTANCE.md)
- [Portable import acceptance](docs/04-operations/PORTABLE_IMPORT_ACCEPTANCE.md)
- [Target-capture acceptance](docs/04-operations/TARGET_CAPTURE_ACCEPTANCE.md)
- [Compact editor placement acceptance](docs/04-operations/WINDOW_PLACEMENT_ACCEPTANCE.md)
- [Single-instance and lifecycle acceptance](docs/04-operations/SINGLE_INSTANCE_ACCEPTANCE.md)
- [Private Windows installer and branding acceptance](docs/04-operations/PRIVATE_WINDOWS_TEST_ACCEPTANCE.md)
- [Windows event-pipeline acceptance](docs/04-operations/WIN_EVENT_ACCEPTANCE.md)
- [Vercel deployment scope](docs/04-operations/VERCEL_DEPLOYMENT.md)
- [Repository governance](docs/06-planning/REPOSITORY_GOVERNANCE.md)

When code behavior changes, update the relevant issue, tests, README, product documents, website claims, and release evidence together.

## Distribution status

Skribli is **not currently available for download**. A public installer must not be enabled until the applicable release gates in issue #34 pass against an exact signed Windows package.
