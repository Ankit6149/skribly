# Android foundation

Private, local-only Android-first implementation started at the owner's request on 3 October 2026. This workspace is separate from the Windows owner candidate. It is not an Android release, a synced desktop companion, or an APK download.

## Implemented

- React + TypeScript + Vite, with a separate minimal Tauri 2 mobile shell. No second UI framework or Windows native module imports.
- My Skribs library, text search, eight consistent paper colours, text editor, explicit Save, and reversible Trash/restore.
- The existing shared paper/ink tokens, DM Sans controls, Manrope headings and **Kalam note content**. Fonts are bundled, not fetched from a service.
- Save-state feedback after an IndexedDB transaction completes; failed saves keep the draft visible. App Back prompts with Save and close, Close without saving, and Keep editing when dirty.
- Versioned mobile text records from `packages/shared/src/mobile.ts`. This is deliberately a mobile-only contract, not the desktop record format or a complete transfer protocol.
- Atomic revision comparison/write in one readwrite transaction. Conflicting edits are rejected rather than overwriting another window's save. Corrupt/future records fail closed and remain unchanged.

The app does not implement sign-in, desktop sync, external-app context/overlays, Android share intents, ink, attachments, notifications, payments, or background services. Its shared capability declaration marks these unavailable.

## Run the frontend

Use the repository's declared Node/npm toolchain, then from the repository root:

```powershell
npm ci
npm --workspace @skribly/android run dev
npm --workspace @skribly/android run test
npm --workspace @skribly/android run lint
npm --workspace @skribly/android run typecheck
npm --workspace @skribly/android run build
```

The development frontend is served at `http://localhost:1430`. IndexedDB belongs to this browser origin; the eventual installed Android WebView will have separate storage. Browser notes do not transfer into the APK automatically.

## Android shell setup

Follow [Tauri Android prerequisites](https://v2.tauri.app/start/prerequisites/#android): the Java toolchain, Android SDK platform/build/platform/command-line tools, side-by-side NDK, `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, and Rust Android targets. Then:

```powershell
npm --workspace @skribly/android run android:init
npm --workspace @skribly/android run android:dev
npm --workspace @skribly/android run android:build
```

`android:build` requests a **debug** build. The preview application ID is provisional and no production signing key is configured. Generated Android build sources, APKs and AABs are ignored. No SDK packages or Rust targets were installed during this foundation work.

On 3 October, Android SDK platform 34 and Java 17 were detected locally, but no NDK directory or Rust Android target was present. `android:init` stopped at the environment prerequisite check; it did not generate an Android project. Cargo metadata and Rust formatting passed, but native/mobile compilation and APK/device testing remain **unverified**.

## Data and recovery limits

- Explicit Save is required. A draft that has not been saved can be lost when Android kills the process; browser `beforeunload` is only a browser safeguard. Android system Back, task dismissal, keyboard insets, process-death recovery and WebView storage durability need real-device implementation/testing before a beta.
- IndexedDB is not an encrypted vault or a backup. Uninstalling/clearing app data can remove notes. There is no export/import or cloud backup in this foundation.
- There is no permanent-delete action. Trash preserves the note text and is reversible.
- This schema's version 1 is new storage, not a rewrite of desktop data. A future schema must have a tested migration; never reset unreadable data to an empty library.
- Empty permissions and a restrictive production CSP keep the shell minimal. Android generated manifests/backup/network configuration still require inspection after initialization; do not infer platform permissions from the frontend.

## Verification and next work

See [execution report](../../docs/06-planning/ANDROID_FOUNDATION_EXECUTION_2026-10-03.md) for exact tests, screenshots and the remaining device acceptance plan.
