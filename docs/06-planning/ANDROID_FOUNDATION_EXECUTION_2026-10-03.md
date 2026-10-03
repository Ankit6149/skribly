# Android-first foundation execution

**Date:** 3 October 2026 (Asia/Calcutta)

**Executor:** Codex Android foundation agent, delegated by the root executor

**Authorization:** The owner requested starting the phone app and selected **Android first**.

**Scope:** A separate `feature/android-foundation` branch based on `01acfac`; no mobile changes merged into the desktop candidate.

**Tracking:** [Android outcome #276](https://github.com/Ankit6149/skribly/issues/276). Historical epic #46 is closed as a duplicate and was not reopened or treated as active acceptance.

**Acceptance:** Source/browser foundation only. No APK or installed Android acceptance. **Linear write-back pending**; no mobile Linear issue was available to this executor.

## What changed and why

Added `apps/android` as a React/Vite frontend with a minimal Tauri 2 shell, preserving the repository's one-UI-framework rule. Desktop window capture, tray, account/native license commands and background loops are not imported. The existing desktop paper palette and typography are the visual target: UI uses DM Sans/Manrope; typed Skrib content uses Kalam.

The separate native crate has a committed Cargo lockfile resolved from the existing local registry cache (418 packages); this records dependency resolution, not Android compilation.

The useful first slice is a local text library with search, editor, eight paper colours, truthful Save state and reversible Trash. Shared `mobile.ts` provides versioned validation and explicit capability declarations. Browser IndexedDB compares expected revision and writes in one transaction; only transaction completion counts as saved. Save failure retains the draft, and future or malformed stored records are preserved and block normal writes through the unreadable library. This keeps a small foundation from inheriting desktop lifecycle or sync assumptions.

The Product Design index skill was read before UI work. This is implementation against the existing desktop code/design target, with no new visual direction or mockup approval claim. Shared design tokens, equal 44px touch targets, consistent icon strokes, restrained paper cards, keyboard-visible focus, native modal focus containment, reduced-motion-safe static layouts and responsive widths guide this slice.

## Evidence

| Check | Result |
| --- | --- |
| `npm --workspace @skribly/android run test` | **17 passed in 2 files**: current/future/unsafe model validation; exactly one winner from concurrent same-revision saves; ID collision rejected; transaction-complete read; Trash/restore preserves text; future record unchanged; revision skip/oversized draft rejected. |
| `npm --workspace @skribly/android run lint` | Passed with **zero warnings/errors**; hooks and dependency rules mandatory. |
| `npm --workspace @skribly/android run typecheck` | Passed. |
| `npm --workspace @skribly/android run build` | Passed; 234.62 kB JavaScript before gzip, bundled DM Sans/Manrope/Kalam assets. Frontend output only, not APK. |
| `cargo fmt --manifest-path apps/android/src-tauri/Cargo.toml --check` | Passed. |
| `cargo metadata --manifest-path apps/android/src-tauri/Cargo.toml --offline --no-deps --format-version 1` | Passed; manifest metadata only, not Rust compilation. |
| `npm --workspace @skribly/android run android:init` | Stopped at Android environment prerequisite check. Existing SDK platform 34/Java 17 detected; no NDK or Rust Android targets. No installation attempted. |
| Browser at 390×844 and 320×740 | Save/reload retained synthetic text; centered blurred unsaved modal; Save and close returned to library; Close without saving preserved stored text; Trash/restore and search worked. No horizontal overflow; each colour control 44×44. `document.fonts.check` confirmed Kalam and DM Sans loaded. |

The preview initially used a node_modules junction and showed blocked fonts. That preview was rejected. Dependencies were installed in the isolated worktree and the preview was restarted; only the loaded-font captures below are retained.

- [Library, 390px](../01-design/evidence/android-foundation/library-390.png)
- [Editor, 390px](../01-design/evidence/android-foundation/editor-390.png)
- [Editor, 320px](../01-design/evidence/android-foundation/editor-320.png)
- [Centered unsaved dialog, 390px](../01-design/evidence/android-foundation/close-dialog-390.png)

All screenshots and tests use synthetic note text. No production key, account, user note, backend, payment flow or telemetry was used.

## Remaining gaps and next execution

1. Install/configure the Android NDK and Rust targets with the owner toolchain; initialize the Android project and inspect its generated manifest, backup rules, release networking and permissions. Then build a debug APK and run on a real phone.
2. Implement Android system Back routing and recoverable drafts before treating unsaved editing as durable. Prove force-stop/process death, offline save, storage-full errors, reinstall/data-clear behavior, WebView upgrades, keyboard/gesture insets, rotation and large-text/TalkBack flows.
3. Test cold-start/idle resource usage on real devices. There are no new background services in this foundation, but no Android CPU/memory claims are made.
4. Add complete local export/import/recovery, then user-invoked Android share capture for text/URLs. Inspect shared content before saving and avoid storing secret-bearing URL parameters by default.
5. Evaluate attachments/ink and local notifications separately. Do not reuse desktop JSON as a complete export, and do not promise any sync until a complete portable content contract and approved encryption/recovery design exist.
6. Resolve store identifier, owner device matrix, private beta distribution, privacy/store disclosures and optional commerce only after the local-device slice is accepted. The preview identifier is not a store commitment.

**Human decision required:** Android device(s) and OS versions for first private testing; eventual store identity. These do not block committing this foundation. No desktop release gate is closed by mobile work.

## Recovery/rollback

The branch is separate from the desktop candidate. Removing the workspace does not migrate or delete desktop data. The mobile database has its own name and version. For a later APK, do not change the application identifier to reuse a different install's data without an explicit migration and backup plan. A native storage failure must keep existing records and show a recovery state; never silently clear storage.
