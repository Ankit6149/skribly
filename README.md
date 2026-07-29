# Skribli

**Leave a note exactly where the thought belongs.**

> **Status — active production development**  
> Installer access is temporarily disabled. The previous Windows beta has been withdrawn while the native overlay, shortcut flow, click-through behaviour, typography, and close controls are rebuilt and validated.

Skribli is a local-first contextual note utility for Windows. The intended interaction is deliberately small:

1. Open the application where the note belongs.
2. Press **Ctrl + Shift + Space**.
3. Write the note immediately.
4. Close it into a small attached note tab.
5. Return to the application later and find the note in the same context.

There should be no permanent floating toolbar, mandatory account, target-selection wizard, or full-screen interaction layer.

## Repository and licence status

This repository is publicly visible for development and issue tracking, but Skribli is proprietary software and is **not open source**. Public access to the repository does not grant permission to copy, deploy, redistribute, or build another product from its source or assets. See [`NOTICE.md`](NOTICE.md) and [`docs/06-planning/REPOSITORY_GOVERNANCE.md`](docs/06-planning/REPOSITORY_GOVERNANCE.md).

## Production priorities

- The transparent overlay must remain click-through everywhere except the exact note or editor bounds.
- The release executable must never open a terminal window.
- The shortcut must attach a note to the foreground application automatically.
- The app must start quietly in the system tray and provide clear **Show**, **Hide**, and **Quit** controls.
- Notes must use a warm, natural handwritten type treatment while controls remain readable.
- Notes and attachments remain on the user’s computer by default.

## Current stack

- Tauri 2 desktop shell
- React + TypeScript + Vite interface
- Rust native core and Windows adapters
- Local versioned storage
- Native `RegisterHotKey`, WinEvent hooks, per-monitor DPI handling, and selective `WM_NCHITTEST` click-through

## Repository map

```text
skribly/
├── apps/desktop/              Tauri + React Windows application
├── extensions/chromium/       Future exact webpage anchoring adapter
├── packages/design-system/    Shared visual tokens
├── packages/shared/           Shared TypeScript models
├── assets/                    Product and branding assets
├── docs/                      Product and engineering documentation
└── site/                      Product website
```

## Development prerequisites

- **Node.js 22.23.1 LTS** — the canonical version is recorded in [`.nvmrc`](.nvmrc).
- **npm 10.9.8**, bundled with Node.js 22.23.1.
- The current stable Rust toolchain with `rustfmt`.

The repository enforces the supported Node range through `package.json` and `.npmrc`. Install or activate Node.js 22.23.1 before running npm commands. Verify the environment with:

```bash
node --version
npm --version
```

The expected versions are `v22.23.1` and `10.9.8`.

## Local validation

```bash
npm ci
npm run typecheck
npm run test
npm run build
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1
```

Windows runtime verification must additionally confirm that empty overlay space does not capture mouse input, the global shortcut creates one note for the foreground app, the window can be hidden or quit cleanly, and no console window appears in a release build.

## Distribution status

Skribli is **not currently available for download**. A new installer will be provided only after the production build passes native Windows runtime validation.
