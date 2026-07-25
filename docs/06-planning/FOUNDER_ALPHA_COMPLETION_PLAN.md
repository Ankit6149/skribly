# Skribly Founder Alpha Completion Plan

_Last updated: July 2026_

This plan is intentionally narrow. Skribly Founder Alpha is a Windows-first contextual annotation product, not a general notes platform.

## Product promise

> Leave a note inside any app. Close it into a small movable dot. Return to the note and its working context when you need it.

## Chunk 1 — Native contextual overlay foundation

Status: **implemented in code; Windows runtime acceptance still required**

- global shortcut
- external-window binding
- native selective hit testing
- target move/minimize/restore observation
- local text-note persistence
- same-session context reconnection
- recovery through All Skribs

## Chunk 2 — Useful compact note interaction

Status: **implemented in code**

- new notes open in a focused composer
- Type mode uses a normal focused editor
- Write mode expands the composer
- mouse/touch/stylus drawing canvas
- completed notes close into a movable coloured dot
- clicking a small note opens a readable preview
- large or rich notes open directly in the composer
- preview cards remain movable and resizable
- drag/resize persists once on release

## Chunk 3 — Rich local content and recovery widget

Status: **implemented in code**

- images and files attached locally through IndexedDB
- 8 MB per-file Founder Alpha limit
- 24 MB per-note attachment limit
- image previews
- drawing stored as PNG attachment
- attachment deletion
- attachment cleanup when a Skrib is deleted
- saved-notes widget with count
- note list and detail view
- safe reconnection to a matching open application
- ambiguity refusal rather than silent guessing

Limitations:

- attachments are local to the WebView profile and are not yet part of the Rust JSON backup/export
- arbitrary files or executables are never launched silently
- Open original app reconnects only to a matching window that is already open

## Chunk 4 — First-run and release surface

Status: **partially implemented**

Implemented:

- three-step first-run onboarding
- Founder Alpha version `0.1.0`
- NSIS and MSI bundle configuration
- Windows installer build job in CI
- source SVG for the final icon
- CSP support for local blob image previews

Still required locally:

- generate all Tauri icon assets from `assets/branding/skribly-app-icon.svg`
- verify the generated tray and installer icons
- implement and verify tray menu actions
- decide close-button behaviour: hide to tray versus quit

## Chunk 5 — Release verification

Status: **not accepted until performed on Windows**

Required on the exact final SHA:

1. `npm ci`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check`
6. `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
7. `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
8. `npm run tauri -- dev`
9. real Notepad and VS Code lifecycle test
10. cross-process click-through test
11. attachment restart test
12. drawing restart test
13. saved-notes widget reconnection test
14. runtime metrics capture
15. `npm run tauri -- build --ci`
16. install/uninstall both produced installer types

## Founder Alpha acceptance criteria

- no full note permanently covers the user’s work
- a completed note becomes a small movable dot
- dot, preview, composer, toolbar, picker, onboarding, and widget are interactive
- empty overlay regions continue to pass through
- text survives application restart
- attachments survive application restart on the same profile
- note movement is saved
- global shortcut works while an external application is focused
- target movement, minimize, restore, close, and reopen behave honestly
- exact CI run produces installer artifacts
- no unsupported PASS claims remain

## Explicitly deferred

- macOS runtime implementation
- browser extension and DOM anchoring
- file/folder launch and anchoring
- cloud sync
- accounts
- collaboration
- OCR
- AI
- reminders
- mobile
- perfect mixed-DPI multi-monitor behaviour
- signed installer
- automatic updater
