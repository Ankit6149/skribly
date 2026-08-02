# Skribli

**Leave a note where the thought belongs.**

> **Status — active production development**  
> Public downloads remain disabled while the Windows desktop build completes its data-safety, lifecycle, context, recovery, accessibility, physical-runtime, and release-validation gates.

Skribli is a local-first contextual typed-note utility for Windows. The current product direction is deliberately small: capture a thought in a compact editor, save it safely on the user’s computer, then return to the original application.

## Current Windows build contract

The active compact-note flow is:

1. Focus a supported Windows application.
2. Press **Ctrl + Shift + Space**.
3. Skribli captures the foreground target before taking focus.
4. A compact note editor opens inside that target monitor’s usable work area.
5. Type while Skribli reports truthful **Unsaved**, **Saving**, **Saved**, or **Save failed** state.
6. Choose **Done**, press **Escape**, or press **Ctrl + Enter**.
7. Skribli hides only after the latest non-empty draft is durably saved. If persistence fails, the editor remains open so the draft is not silently lost.

Launching Skribli again in the same Windows user session signals the existing process through the same note-opening path instead of starting a second storage writer, tray process, hotkey registration, or WinEvent hook set.

Windows accessibility events use bounded, non-blocking delivery with callback-side filtering and duplicate coalescing. Relevant foreground and active-target changes are processed by a separate consumer thread; unrelated child-object and non-target movement events are discarded before queue delivery.

The current build does **not** leave a floating dot, attached tab, permanent toolbar, or full-screen interactive overlay after the editor closes.

The final create/reopen lifecycle, safe context identity, reversible trash, complete All Skribs library, physical Windows acceptance, installer lifecycle, and signed release evidence remain tracked in the production-readiness backlog. Do not treat a successful compile or website deployment as proof that the Windows product is ready to distribute.

## Implemented foundations

- Tauri 2 desktop shell with React, TypeScript, Vite, and Rust.
- Compact fully interactive note window rather than a screen-blocking overlay.
- Foreground-target capture before the Skribli window takes focus.
- Target-monitor work-area placement using fresh HWND geometry and per-monitor DPI.
- Final native placement validation, fail-closed errors, and a keyboard-accessible **Reposition** action.
- Per-Windows-session named-mutex guard acquired before the Tauri runtime starts.
- Second-launch routing through the existing global-shortcut note flow.
- Bounded, non-blocking, filtered, and duplicate-coalesced Windows event delivery.
- Privacy-safe event counters for filtering, delivery, saturation, disconnection, processing, and pending capacity.
- Local versioned JSON persistence with crash-recovery generations and storage diagnostics.
- Ordered/coalesced text persistence with truthful save and retry states.
- Final-save flush before the compact editor hides.
- Rust-side note mutation validation for IDs, Unicode length, colours, and geometry.
- Two-step explicit confirmation before the current irreversible delete operation.
- No console window in the Windows release build configuration.
- Global **Ctrl + Shift + Space** shortcut and tray-based background process.
- Public downloads and payment flows disabled while release gates are incomplete.

## Current release blockers

The canonical execution tracker is [issue #34](https://github.com/Ankit6149/skribly/issues/34). The most immediate blockers include:

- [#15](https://github.com/Ankit6149/skribly/issues/15) remaining shutdown, installer, suspend/resume, and lifecycle evidence after the core single-instance guard;
- [#17](https://github.com/Ankit6149/skribly/issues/17) physical idle, event-storm, accessibility-heavy application, Remote Desktop, suspend/resume, and long-session evidence after bounded event delivery implementation;
- [#18](https://github.com/Ankit6149/skribly/issues/18) fail-closed durable context identity;
- [#19](https://github.com/Ankit6149/skribly/issues/19) physical mixed-DPI, topology-change, taskbar, and Remote Desktop evidence after monitor-safe placement implementation;
- [#20](https://github.com/Ankit6149/skribly/issues/20) final note lifecycle contract;
- [#21](https://github.com/Ankit6149/skribly/issues/21) non-floating library, search, export, archive, and reversible trash;
- [#24](https://github.com/Ankit6149/skribly/issues/24) release-blocking Windows runtime evidence;
- [#25](https://github.com/Ankit6149/skribly/issues/25) signed reproducible installer and rollback pipeline.

An issue must remain open when only part of its acceptance criteria has been implemented. Progress belongs in a detailed issue comment with exact commits, checks, missing runtime evidence, and remaining work.

## Product boundaries

### Current release target

- Windows desktop only.
- Typed contextual notes through a compact transient editor.
- Local-first use without a mandatory account.

### Deferred and unavailable in the current build

- macOS support;
- browser URL or DOM-element anchoring;
- ink, highlighters, arrows, shapes, pins, checklists, reminders, and attachments;
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

- [Production-readiness execution plan](docs/06-planning/FULL_PRODUCT_AUDIT_AND_EXECUTION_PLAN.md)
- [Product backlog and contribution map](docs/06-planning/PRODUCT_BACKLOG_AND_CONTRIBUTION_MAP.md)
- [Current and future product requirements](docs/00-product/PRD.md)
- [Compact editor placement acceptance](docs/04-operations/WINDOW_PLACEMENT_ACCEPTANCE.md)
- [Single-instance and lifecycle acceptance](docs/04-operations/SINGLE_INSTANCE_ACCEPTANCE.md)
- [Windows event-pipeline acceptance](docs/04-operations/WIN_EVENT_ACCEPTANCE.md)
- [Repository governance](docs/06-planning/REPOSITORY_GOVERNANCE.md)

When code behavior changes, update the relevant issue, tests, README, product documents, website claims, and release evidence together.

## Distribution status

Skribli is **not currently available for download**. A public installer must not be enabled until the applicable release gates in issue #34 pass against an exact signed Windows package.
