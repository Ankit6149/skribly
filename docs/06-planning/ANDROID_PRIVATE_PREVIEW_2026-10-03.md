# Android private preview build — 3 October 2026

## Execution scope

The owner requested an Android download alongside Windows on the existing private owner-key page. This follows the Android-first local foundation, on its separate branch. No mobile code was merged into the desktop candidate. [Outcome #276](https://github.com/Ankit6149/skribly/issues/276) and [draft PR #277](https://github.com/Ankit6149/skribly/pull/277) remain open for real-phone acceptance. **Base association / Linear write-back pending** because Linear access is unavailable; no Android ARC issue was supplied. Executor: Codex Android foundation agent.

The initial source report's prerequisite block is historical: the owner subsequently authorized installing the prerequisites and building an APK. This report records that later execution.

## Toolchain and build

- Source UI/native compilation: `2d11d2558d35f707edf6fdb205322a7d6e451c23`; later packaging-helper/report edits do not change runtime source.
- Java 17.0.19; Tauri CLI 2.11.4 / native Tauri 2.11.5; NDK 28.2.13676358; Rust target `aarch64-linux-android`.
- Generated Android Gradle plugin 8.11.0, Gradle 8.14.3, Kotlin 1.9.25; compile/target SDK 36; minimum SDK 24 (**Android 7.0+**).
- SDK, NDK, Gradle caches, Rust target artifacts and temporary files are scoped to `D:/Skribli-work/android-build`. Existing SDK licenses were copied from the already configured local SDK. No global Windows security settings or tool binaries were changed.
- `npm --workspace @skribly/android run android:build` built the frontend and compiled ARM64 native source with **`tauri/custom-protocol`**, so static frontend assets are embedded. It stopped at the JNI symlink step: Windows denied symlink creation.

Tauri's [JNI staging source](https://github.com/tauri-apps/cargo-mobile2/blob/dev/src/android/jnilibs.rs) uses `force_symlink`; an existing ordinary file cannot bypass that CLI step. The source-controlled `apps/android/package-windows-preview.ps1` instead stages a regular-file copy and calls the official generated wrapper with:

```text
:app:assembleArm64Debug -x :app:rustBuildArm64Debug
-PabiList=arm64-v8a -ParchList=arm64 -PtargetList=aarch64 --no-daemon
```

[Gradle task exclusion](https://docs.gradle.org/current/userguide/command_line_interface.html#sec:excluding_tasks_from_the_command_line) skips only the native Rust task already completed. Manifest merge, resource processing, Kotlin/Dex, Android packaging and debug signing remain active. The helper requires the native compilation hash and source commit, rejects changed tracked runtime/build inputs and a native output older than the frontend build. Recompile current source before using it; never attest a stale library with new metadata.

The NDK `llvm-readelf` reports only system dependencies (`libandroid`, `libdl`, `liblog`, `libm`, `libc`), so no shared C++ runtime is staged. `llvm-strip --strip-debug` modifies only the generated copy:

| Library | Bytes | SHA-256 |
| --- | ---: | --- |
| Original ARM64 debug library, preserved | 113,575,184 | `d7e57d1d0d1e9f195f77dc1a2bef386c9c42979ffed808100a9445e0e44596ac` |
| Staged copy after removing debug symbols | 18,930,808 | `3036c3df026800f6f20256002c64bf0cf9e392f85b58e6d72e938a51d0646b6d` |

## Privacy preparation

The generated manifest is prepared immediately before packaging: cleartext networking disabled; `allowBackup=false`; full-backup and Android 12+ cloud/device-transfer rules exclude all nine app storage domains. Tauri commands/plugins have no grants. Android framework `INTERNET` is retained; the frontend implements no account, backend, sync, telemetry or network service.

`allowBackup=false` alone cannot establish every OEM's transfer behavior; see [Android backup documentation](https://developer.android.com/identity/data/autobackup). Final merged manifest inspection and real-phone behavior are separate evidence gates. These exclusions do not provide user backups.

## Verification boundaries

### Built artifact inspection

The official generated Gradle build succeeded: **62 executed tasks, 7 minutes**. The committed packaging helper was exercised successfully (28 seconds: two tasks executed, 60 up-to-date); an incorrect native hash was rejected before staging. The private APK is `Skribli_Mobile_Preview_0.0.1_arm64.apk`, **26,096,681 bytes**, SHA-256 **`46fde03076fb3fe5273ba44c7ddbde8db687ebf177a192fa96132916354e62a7`**. It is kept outside every repository/deployment directory at `D:/Skribli-owner-artifacts/Android-preview-0.0.1/Skribli_Mobile_Preview_0.0.1_arm64.apk`; no plaintext APK or signer is committed. Parent executor encrypts the verified file for website delivery.

| Inspection | Evidence |
| --- | --- |
| `aapt dump badging` | `app.skribly.mobilepreview`, versionName `0.0.1`, versionCode `1`, minSdk `24`, targetSdk `36`, only `arm64-v8a`; app label `Skribli Mobile Preview`. |
| `apksigner verify --verbose --print-certs` | Passed APK signature scheme v2. One **Android Debug** RSA-2048 signer; certificate SHA-256 `b7aa67ba20919a12ede51d7cb0aac25e73ea87d124895304b58f005a1b1fc10e`. This is not a production signature. The debug key remains outside the repo in the scoped Android user home for preview upgrades. |
| `zipalign -c -P 16 -v 4` / NDK `llvm-readelf -l` | Alignment verification passed; all native LOAD segments align to `0x4000` (16 KB). Device startup remains unverified. |
| Extracted `lib/arm64-v8a/libskribli_mobile_lib.so` | Only native library/ABI in the APK; 18,930,808 bytes; SHA-256 exactly matches the staged stripped copy above. |
| Embedded frontend | All **30** current `dist/assets` JS/CSS/font files byte-match Brotli-decoded Tauri codegen assets; the exact compressed asset bytes and keys are present in the packaged native library. Includes current `index-Ft_V4yR4.js` and all six Kalam font assets plus DM Sans/Manrope. No external dev server is required by this build. Rendering still requires a phone test. |
| Final APK binary manifest | `debuggable=true`, `allowBackup=false`, `usesCleartextTraffic=false`, backup and data-extraction resources reference the prepared rules. AndroidX additionally merges its app-local signature-protected dynamic-receiver permission; permissions are that and framework `INTERNET`. No storage/camera/location/contact/notification permissions. |
| Final APK backup resources | Nine exclusions in legacy full-backup; 18 exclusions across cloud-backup and device-transfer, covering all nine domains in each. |

The AndroidX profile-installer receiver is exported but guarded by Android's `DUMP` permission; the file/startup providers are not exported. This is framework manifest inspection, not a claim that Android lifecycle/backup behavior is accepted.

Foundation: 17 model/IndexedDB tests; three private-manifest preparation tests; lint and typecheck passed. Browser verification at 390px and 320px confirmed bundled Kalam note content, DM Sans controls, consistent touch targets, explicit Save/reload, Trash/restore and centered unsaved modal. Screenshots are in `docs/01-design/evidence/android-foundation`; all notes are synthetic.

An APK build does not close phone acceptance. Android system Back routing, durable unsaved drafts/process death, keyboard/gesture insets, rotation, offline save across WebView restarts/upgrades, storage-full errors and TalkBack/large text still need real-phone testing. Uninstall/data clear can delete local notes. No export/import, sync, attachment/ink, Android share capture or notifications are claimed.

## Owner decisions / next execution

Test the private preview on a supported ARM64 phone; record Android/WebView version and actual launch/save/restart/Back results. This is debug-signed private distribution, not Play Store or production signing. Do not treat the debug certificate as the eventual production identity or promise cross-signer updates. Parent executor handles owner-key encryption and website publication; no keys or APKs are committed here.
