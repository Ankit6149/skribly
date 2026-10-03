# Android foundation

Private, local-only Android-first implementation started at the owner's request on 3 October 2026. This workspace is separate from the Windows owner candidate. It is a mobile preview, not a synced desktop companion or a production Android release.

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

`android:build` requests an **ARM64 debug APK** with bundled frontend assets. The preview application ID `app.skribly.mobilepreview` is provisional and no production signing key is configured. Generated Android build sources, APKs and AABs are ignored. Minimum Android SDK is 24 (Android 7.0); the generated target/compile SDK is 36.

The initial environment check found SDK 34/Java 17 without an NDK or Rust Android target. A later owner-authorized build installed the official NDK 28.2.13676358, SDK/build tools 36 and the `aarch64-linux-android` target. Build/download/cache paths were scoped to D:; no global Windows security setting was changed. Native ARM64 compilation succeeded, then Tauri's Windows JNI symlink step failed because this host cannot create symlinks.

### Windows packaging fallback

After the native library was compiled by `android:build` with `tauri/custom-protocol`, this generated-project fallback packages that library using the official Gradle wrapper:

```powershell
# JAVA_HOME, ANDROID_HOME, NDK_HOME, CARGO_TARGET_DIR, GRADLE_USER_HOME,
# ANDROID_USER_HOME and TEMP/TMP must point to your configured toolchain/cache.
./apps/android/package-windows-preview.ps1 `
  -NativeLibrary "$env:CARGO_TARGET_DIR/aarch64-linux-android/debug/libskribli_mobile_lib.so" `
  -NativeSha256 <SHA256-recorded-after-current-native-compilation> `
  -BuiltSourceCommit <full-commit-of-compiled-runtime-source>
```

The helper requires the hash recorded after compilation and the compiled source commit. It rejects changed tracked runtime/build inputs, a mismatched library and native output older than the frontend build. It validates ARM64 ELF, generated task/version contracts and native dependencies, prepares backup/network rules, copies the compiled library into ignored `jniLibs`, and strips debug symbols only from the copy. It excludes only the already-completed `rustBuildArm64Debug` task. Gradle still performs Android manifest merge, resources, Kotlin/Dex, APK packaging and debug signing. These checks supplement the compile log; always compile current source and inspect embedded assets rather than attesting an old library with new metadata. No tool binaries, user security settings, original library or production signing key are modified.

Final package inspection and the reproducible evidence are recorded in [private preview build report](../../docs/06-planning/ANDROID_PRIVATE_PREVIEW_2026-10-03.md). A built APK is not phone acceptance.

## Data and recovery limits

- Explicit Save is required. A draft that has not been saved can be lost when Android kills the process; browser `beforeunload` is only a browser safeguard. Android system Back, task dismissal, keyboard insets, process-death recovery and WebView storage durability need real-device implementation/testing before a beta.
- IndexedDB is not an encrypted vault or a backup. Uninstalling/clearing app data can remove notes. There is no export/import or cloud backup in this foundation.
- There is no permanent-delete action. Trash preserves the note text and is reversible.
- This schema's version 1 is new storage, not a rewrite of desktop data. A future schema must have a tested migration; never reset unreadable data to an empty library.
- Tauri command permissions are empty and the production CSP is restrictive. Android's generated framework retains `INTERNET`; this is distinct from Tauri permissions. The preparer disables cleartext networking and excludes note storage from platform cloud backup/device transfer. OEM behavior and final merged permissions still need inspection/testing; these rules are not a data backup feature.

## Verification and next work

See [execution report](../../docs/06-planning/ANDROID_FOUNDATION_EXECUTION_2026-10-03.md) for exact tests, screenshots and the remaining device acceptance plan.
