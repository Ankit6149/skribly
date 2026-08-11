# Current Skribli architecture

> **Status:** Windows v0 source of truth. This document describes the code that ships today. Planned annotations, reminders, browser precision, macOS, and sync are listed separately and are not production capabilities.

## Product boundary

Skribli is one Windows background application with three current user-facing surfaces:

1. a normal home/account window;
2. a compact contextual note editor opened by `Ctrl + Shift + Space`;
3. one reusable **All Skribs** library window opened from the tray.

Closing a window hides it; **Quit Skribli** exits the background process. The current build does not keep a full-screen overlay, dot, attached tab, widget, or note window floating over another application.

## Runtime map

```text
Windows user session
|
+-- one Skribli process
    |
    +-- Tauri/Win32 application shell (Rust)
    |   +-- single-instance mutex and second-launch signal
    |   +-- one global hotkey registration
    |   +-- bounded/coalesced WinEvent receiver
    |   +-- foreground-target capture and revalidation
    |   +-- compact-window placement per monitor work area/DPI
    |   +-- tray and window lifecycle
    |   +-- note coordinator and lifecycle rules
    |   +-- hardened local JSON storage and recovery generations
    |   +-- Trash, export, and atomic portable import
    |   +-- trial/licence boundary
    |
    +-- WebView UI (React/TypeScript)
        +-- home/account and first-run guidance
        +-- compact note composer and truthful save states
        +-- All Skribs, search, export, import, and Trash
        +-- recovery, unsupported-target, and licence surfaces
        +-- shared website-aligned design tokens and local fonts
```

The website is a separate static Vercel surface. It describes the current product and serves an owner-key-encrypted Windows installer. It is not part of the desktop process and cannot access local Skrib data.

## Authority and dependency direction

The allowed production dependency direction is:

```text
React views -> frontend feature controllers/stores -> typed Tauri commands/events
                                                       |
                                                       v
Windows/Tauri adapters -> Rust application coordination -> Rust domain/storage rules
```

- Rust is authoritative for foreground capture, target revalidation, context matching, note lifecycle mutations, persistence, import transactions, Trash rules, and licence write access.
- TypeScript owns presentation state, local editor drafts, save orchestration, input validation duplicated only for immediate feedback, and accessible user messaging.
- React views do not read or write the filesystem directly.
- Platform calls remain under `src-tauri/src/platform` or desktop shell modules; domain/storage modules do not call React or browser APIs.
- The design-system package owns shared semantic tokens. Feature styles may compose those tokens but must not define a competing theme.
- Future or experimental capability types do not authorize production UI, persistence, permissions, network access, or product claims.

## Window and target lifecycle

When the shortcut is pressed, Rust captures the foreground window before Skribli receives focus. The captured HWND and process identity are revalidated before a note request is created. Unsupported, hidden, destroyed, minimized, self, shell/system, missing-identity, invalid-bounds, changed-foreground, expired, or changed-process targets fail closed with typed user-safe errors.

For a supported target, the coordinator returns an explicit `created` or `reopened` request. Legacy duplicate matches are resolved deterministically. The compact editor is placed inside the selected monitor's usable work area using current DPI; no full-screen overlay coordinate system is used by the active product flow.

## Editing and persistence

The textarea draft is immediate frontend state. Per-note writes are serialized and rapid changes coalesce. The editor exposes dirty, saving, saved, and failed states; stale responses cannot replace a newer draft. Done, Escape, `Ctrl + Enter`, Close, and blur flush the latest draft before hiding. Failed final persistence keeps the editor and exact draft visible.

The durable source of truth is a versioned, integrity-checked local JSON envelope owned by Rust. Commits use temporary-file sync, verified replacement, bounded known-good backup generations, corruption quarantine, and read-only recovery for unsupported future schemas. SQLite is a possible future migration, not the current store. See [ADR-0001](ADR-0001-hardened-json-storage.md).

Skrib content remains local. Account and entitlement calls do not upload note text. Portable export/import is explicit and user-directed; import validates a fingerprint and storage revision, writes a verified rollback backup, and applies atomically.

## Current module ownership

| Concern | Authoritative area |
| --- | --- |
| React entry/startup recovery | `apps/desktop/src/bootstrap.ts`, `src/main.tsx` |
| Home, account, and quick guide | `apps/desktop/src/features/account`, `src/features/onboarding` |
| Compact editor and draft saves | `apps/desktop/src/features/skribs` |
| Library, Trash, export/import UI | `apps/desktop/src/features/library` |
| Frontend native boundary/state | `apps/desktop/src/stores` |
| Note coordination and persistence | `apps/desktop/src-tauri/src/core` |
| Explicit note-open lifecycle | `apps/desktop/src-tauri/src/note_lifecycle.rs` |
| Library/import native operations | `apps/desktop/src-tauri/src/desktop` |
| Windows capture/events/placement | `apps/desktop/src-tauri/src/platform` |
| Tray and single-instance shell | `apps/desktop/src-tauri/src/desktop/tray.rs`, `src/windows_single_instance.rs` |
| Shared visual tokens | `packages/design-system/src/tokens.css` |
| Website and owner download | `site/` |
| Repository/product/release contracts | `scripts/validation`, `scripts/governance`, `.github/workflows` |

## Data that is not current production scope

The following capabilities are deferred behind their dedicated issues and must not be inferred from prototypes, types, or planning documents:

- editable ink, highlighter, shapes, arrows, pins, and checklists;
- reminders, recurrence, notification scheduling, or calendar integration;
- attachments as a supported portable production feature;
- browser URL/DOM anchoring or a production browser bridge;
- macOS binaries or permissions;
- cloud sync, collaboration, AI, OCR, mobile clients, or third-party plugins.

Dormant experimental code is tracked by issue #23 and must remain outside current product claims. New capability work requires an approved domain model, permission/network declaration, migration and recovery behavior, accessibility states, deterministic tests, and an explicit release gate.

## Architecture decisions

- [ADR-0001](ADR-0001-hardened-json-storage.md): hardened versioned JSON storage.
- [ADR-0002](ADR-0002-canonical-note-open-lifecycle.md): explicit create/reopen lifecycle.
- [ADR-0003](ADR-0003-reversible-trash-lifecycle.md): reversible Trash and confirmed permanent deletion.
- [ADR-0004](ADR-0004-portable-import-transaction.md): strict preview and atomic portable import.

The older `adr/ADR-001-provisional-stack.md` is historical planning and is not authoritative where it conflicts with these accepted decisions or the current interaction specification.

## Verification

The current architecture is guarded by:

- frontend unit tests and TypeScript checks;
- native Rust domain, storage, lifecycle, import, capture, event, placement, and single-instance tests;
- product-truth, note-lifecycle, library, Trash, import, governance, React-runtime, theme, and site validators;
- Windows NSIS/MSI builds plus installed-window branding/startup evidence;
- release-specific live download decryption and installer-hash comparison.

Physical compatibility, signing reputation, update/rollback, accessibility hardware evidence, performance budgets, settings, privacy controls, and future capabilities remain tracked by their open issues. A successful compile alone does not expand the supported product boundary.
