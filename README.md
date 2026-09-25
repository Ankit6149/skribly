# Skribli

**Put a Skrib where the thought belongs.**

> **Status — active product development**  
> Public downloads remain disabled while the Windows desktop build completes its data-safety, lifecycle, context, recovery, accessibility, physical-runtime, and release-validation gates.

Skribli is a local-first contextual annotation application for Windows. The current owner-test v0 supports typed and handwritten **Skribs**, local image/video/document attachments, one-time reminders, and a local calendar. Arrows, shapes, screenshot pins, richer context types, sync, and collaboration remain future work.

A normal launch always opens the visible **Skribli Home** window. Fresh users see account setup first, then a compact guide that explains the shortcut and local-first behavior, and finally a ready Home surface. The guide creates no sample Skrib and can be reopened later from **Quick guide** in the tray.

A verified account is mandatory for write access in enforced builds. The account service stores only verified email, trial/entitlement state, a one-way device claim, app version, and the user’s optional product-update consent. Skrib content remains on the Windows device. Changing accounts or reinstalling on the same Windows device does not restart that device’s trial.

## Current Windows build contract

The current [v0.1.38 owner candidate](docs/04-operations/OWNER_CANDIDATE_V0.1.38.md) places the context pill halfway across the paper edge with an opaque, note-coloured backing to avoid the former white gutter, removes the drag tooltip, and reduces the in-app presence dot while preserving its click target. It includes the [v0.1.37 curve and icon-rail pass](docs/04-operations/OWNER_CANDIDATE_V0.1.37.md), direct attachment removal, and the v0.1.31 sign-in packaging correction. Owner sign-in and native Windows visual acceptance remain open.

The unreleased [17 September refinement foundation](docs/04-operations/REFINEMENT_FOUNDATION_2026-09-17.md) records the smaller horizontal-band widget, native rail-state synchronization, note-surface correction and temporary reminder sizing, together with the remaining Windows acceptance gaps.

The subsequent [quiet context presence pass](docs/04-operations/QUIET_CONTEXT_PRESENCE_2026-09-17.md) replaces the in-app bar with a brief count, quiet dot and compact list, and separates foreground presence tracking from the editor. Both passes remain unreleased.

The [18 September reopen-flow correction](docs/04-operations/REOPEN_FLOW_2026-09-18.md) opens detached notes beside the invoking list, keeps their moved position during resizing, preserves smaller saved dimensions and rejects delayed context actions. It is also unreleased; physical Windows acceptance remains pending.

The active compact-note flow is:

1. Focus a supported Windows application.
2. Press **Ctrl + Shift + Space**.
3. Skribli captures the foreground target once, clears any previous runtime target, and revalidates the exact HWND and process identity before using it.
4. A compact note editor opens inside that target monitor’s usable work area. By default, the shortcut reopens the oldest active Skrib for that context, or creates one if none exists. Settings can enable a fresh Skrib on every shortcut press. Existing notes are never merged or removed. Native applications are grouped by application; browsers currently use the captured page title, not a verified website URL. Saved notes remain available from My Skribs and All Skribs.
5. Type while Skribli reports truthful **Unsaved**, **Saving**, **Saved**, or **Save failed** state.
6. Choose **Done**, press **Escape**, or press **Ctrl + Enter**.
7. Skribli hides the saved editor only after the latest draft is durable and returns it to the appropriate **My Skribs** surface. If persistence fails, the editor remains open so the draft is not silently lost.

When Windows cannot provide or revalidate a safe target, Skribli shows one actionable compact message, clears the previous target, and does not create, reopen, move, or focus a note.

Launching Skribli again in the same Windows user session restores the existing Home window instead of creating a surprise Skrib or starting a second storage writer, tray process, hotkey registration, or WinEvent hook set.

Windows accessibility events use bounded, non-blocking delivery with callback-side filtering and duplicate coalescing. Relevant foreground and active-target changes are processed by a separate consumer thread; unrelated child-object and non-target movement events are discarded before queue delivery.

The current build uses two deliberately separate entry surfaces instead of creating a floating dot for every note. A slim three-colour **My Skribs** tab stays at the desktop edge for the complete library, while one small circular context dot appears inside the active application when that context has notes. It does **not** create a full-screen interactive overlay.

Shortcut creation follows the one-primary-note default described above, with multiple notes available through Settings. One click on the desktop tab unfolds the complete collection as ribbons; the context indicator unfolds a horizontal shelf with hover/focus previews. Only one list expands at a time, and both launchers remain available. Their overflow offers **Here**, **Everything**, and **Archived** while the full library remains the management surface. The app indicator can be moved within its owning application, follows that application as it moves or resizes, and hides when another application becomes active. Completing a task archives its note and linked reminders, while ordinary deletion is reversible through Trash. Portable JSON import requires a non-mutating preview before one atomic apply. Rich attachments, ink, and reminders are device-local and are not yet included in that portable JSON path. Rich-data portability, browser-origin enrichment, physical Windows acceptance, installer lifecycle, and signed release evidence remain tracked in the production-readiness backlog.

The local [19 September rail/workspace correction](docs/04-operations/RAIL_WORKSPACE_REFINEMENT_2026-09-19.md) adds window-scoped state, inward docking on either edge, horizontal context previews, and a quieter single-window workspace. Owner Windows acceptance remains pending.

## Implemented foundations

- Tauri 2 desktop shell with React, TypeScript, Vite, and Rust.
- Compact fully interactive note window rather than a screen-blocking overlay.
- One quiet three-colour desktop edge tab for all Skribs, plus one movable app-contained context dot for the active application. Both unfold into color-coded note ribbons with **Here**, **Everything**, and recoverable **Archived** scopes; individual notes no longer create floating dots.
- Eight theme pastels with automatic new-note rotation and per-note color selection.
- One unified text-and-ink canvas with pen, highlighter, eraser, select-and-move, width/color controls, undo, and editable vector-stroke persistence.
- Safe device-local image, video, and document attachments with preview and quota enforcement.
- Device-local reminders with daily, weekday, weekly, and monthly repeat rules, Calendar view, and permission-gated Windows notifications.
- Compact, medium, and large note sizes plus persisted small, medium, and large handwriting text.
- A grouped, collapsible My Skribs ribbon with a horizontal application context switcher, active-note feedback, and predictable saved-screen-to-app-home fallback.
- Windows launch-at-login so the global shortcut is available after sign-in without manually opening the dashboard.
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
- A normal non-floating **All Skribs** window with deterministic ordering, search, read-only detail, and portable text/metadata record export.
- Reversible Trash with 30-day recovery guidance; permanent deletion exists only inside Trash after note-specific confirmation.
- Task completion archives the note and linked reminders together; archived notes remain readable and can return to active notes.
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
- Typed and handwritten contextual Skribs on one canvas with local attachments and repeating reminders through a resizable editor.
- Mandatory verified account for trial/write access; Skrib content itself remains local.

### Deferred and unavailable in the current build

- macOS support;
- browser URL or DOM-element anchoring;
- arrow, shape, pin, checklist, screenshot, and rich attachment portability tools;
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
└── site/                      Product website with owner-key v0 access; public downloads disabled
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

Skribli is **not currently available as a public download**. The website exposes only an owner-key-encrypted v0 installer; a public installer must not be enabled until the applicable release gates in issue #34 pass against an exact signed Windows package.
