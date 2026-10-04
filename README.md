# Skribli

**Put a Skrib where the thought belongs.**

> **Status — private Windows product development.** Public downloads remain disabled while native lifecycle, data/recovery, accessibility, installer, signing, and exact Windows runtime gates remain open. The current private owner candidate is **v0.1.51**.

Skribli is a local-first contextual annotation application for Windows. The current desktop app uses **Tauri 2 + Rust + React + TypeScript**. Skrib content remains on the device; verified account/trial/entitlement state is handled separately from note content.

## Start here

| Need | Source |
| --- | --- |
| What is current vs historical? | [docs/README.md](docs/README.md) |
| Current product/engineering source-of-truth index | [docs/current/README.md](docs/current/README.md) |
| Target repository/module structure | [docs/current/REPOSITORY_STRUCTURE.md](docs/current/REPOSITORY_STRUCTURE.md) |
| Current Windows interaction contract | [docs/01-design/INTERACTION_SPEC.md](docs/01-design/INTERACTION_SPEC.md) |
| Current architecture | [docs/02-engineering/ARCHITECTURE.md](docs/02-engineering/ARCHITECTURE.md) |
| Product decisions | [docs/06-planning/DECISION_LOG.md](docs/06-planning/DECISION_LOG.md) |
| Repository governance | [docs/06-planning/REPOSITORY_GOVERNANCE.md](docs/06-planning/REPOSITORY_GOVERNANCE.md) |
| Current private owner candidate | [docs/04-operations/OWNER_CANDIDATE_V0.1.51.md](docs/04-operations/OWNER_CANDIDATE_V0.1.51.md) |

## Repository map

```text
skribly/
├── apps/desktop/              Windows Tauri + React application
├── apps/android/              Private Android-first local-note foundation
├── site/                      Product website and private owner delivery
├── extensions/chromium/      Deferred browser-extension work
├── packages/design-system/   Shared design tokens
├── packages/shared/          Shared capability-gated models
├── supabase/                 Account/trial/entitlement backend
├── scripts/                  Validation, packaging and governance tooling
├── docs/                     Product, engineering, acceptance and historical records
├── assets/                   Product/brand assets
└── .github/                  CI, release and repository automation
```

The repository is being reorganized under [issue #229](https://github.com/Ankit6149/skribly/issues/229). Structural cleanup must not hide product-behavior changes inside file moves.

## Current product boundary

The current Windows build includes:

- one normal Home/workspace window;
- one reusable contextual note editor;
- the global **My Skribs** edge widget and contextual in-app widget;
- typed/rich text, editable ink, local attachments and local reminders;
- recurring reminder rules and a local Calendar/agenda;
- local versioned note persistence with recovery;
- reversible Trash and Archive;
- native portable JSON export/import for note text/metadata;
- verified account/trial/entitlement enforcement for write access.

Current portable JSON does **not** include IndexedDB ink, attachment blobs or reminders. Browser URL/DOM anchoring, macOS, cloud sync, collaboration, AI and public commerce remain deferred/not released.

The owner requested starting Android development on 3 October 2026. The separate [Android foundation](apps/android/README.md) has a runnable local frontend and an inspected ARM64 debug APK for private owner testing. Real-phone acceptance remains pending; mobile is not included in the Windows owner installer.

## Development prerequisites

- Node.js **22.23.1 LTS** from [`.nvmrc`](.nvmrc)
- npm **10.9.8**
- current stable Rust toolchain with `rustfmt`
- Windows build tools/SDK and WebView2 for native desktop work

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

These checks do not replace installed-Windows acceptance. Native focus, transparent/topmost windows, WebView2 paint/compositor behavior, multi-monitor/DPI behavior, suspend/resume and installer lifecycle require exact-binary Windows testing.

## Repository and licence status

This repository is publicly visible for development and issue tracking, but Skribli is proprietary software and is **not open source**. Public access does not grant permission to copy, deploy, redistribute or build another product from its source or assets. See [NOTICE.md](NOTICE.md).

## Distribution status

Skribli is **not a public download**. The website currently exposes only an owner-key-encrypted private Windows candidate. Public distribution remains blocked until the applicable release gates pass for an exact signed Windows package.
