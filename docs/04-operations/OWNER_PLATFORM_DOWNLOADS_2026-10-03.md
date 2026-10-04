# Owner platform download page — 3 October 2026

## Latest execution — 4 October 2026

**Execution summary:** the original owner download page is now published with Desktop and Phone choices. The existing external owner key decrypts both live packages. This is private test delivery; installed-device/product acceptance remains open.

**What happened:** a fresh foreground production deployment succeeded after the previous daily-quota rejection. No background retry was created or used. Vercel deployment `dpl_FQPcGr6rYMMGwFuGLcowpeybP5cd` is READY and aliased to [the original download page](https://skribly-desktop.vercel.app/v0-download).

**What changed:** published the exact prepared website source `7cf1d0af655c67b3e312ba38465abe76fe717123`. No frontend or package runtime was rebuilt or changed in this retry. This dated report is subsequent documentation only.

**Findings and why:** the previous publication failure was Vercel's daily deployment quota. The new foreground attempt was accepted. Both platform choices use the intended filenames and versions: Windows `Skribli_0.1.51_x64-setup.exe` and Android `Skribli_Mobile_Preview_0.0.1_arm64.apk`.

**Evidence and verification:** the live HTML, JS entrypoint, core module, UI module and stylesheet all return HTTP 200 with correct content types and bytes exactly matching the prepared local files. The original-URL browser shows both choices; selecting Phone enables Download Android preview APK, with the private-preview/local-text/no-sync description. No owner key was entered into the inspected browser or exposed in tool output. Both live ciphertexts were fetched and privately decrypted using the same external key, with these exact plaintext matches:

| Package | Bytes | SHA-256 |
| --- | ---: | --- |
| Windows v0.1.51 NSIS | 3,650,343 | `584dd3425147dfc377437b205041d41a8894cab5393cd4142d011fb5c576da4e` |
| Android v0.0.1 preview APK | 26,096,681 | `46fde03076fb3fe5273ba44c7ddbde8db687ebf177a192fa96132916354e62a7` |

**Impact:** the owner can download the Windows candidate and the first ARM64 Android text-note preview from the original website using the same key. Keys, raw APK and debug signing material remain outside repository/deployment inputs.

**Remaining gaps / uncertainty:** physical Android launch/save/restart/Back, process-death/draft recovery, insets, TalkBack and storage lifecycle are unverified. Windows owner/runtime acceptance remains open. Desktop v0.1.52 still requires its separate live backend approval and publication; this retry continues to deliver v0.1.51. No Supabase migration, Edge deployment, production signing, phone installation or main merge occurred.

**Next recommended execution / human decision:** owner downloads and tests on the actual Windows laptop and supported ARM64 Android phone; Android needs explicit Save. Record device/Android/WebView versions and results before changing outcome status. Review the separate backend proposal before publishing desktop v0.1.52.

**Executor / write-back:** Codex coordinator; no additional delegation in this retry. GitHub #276 and PR #278 receive this publication evidence and remain open for device acceptance. Linear write-back pending: Linear access is unavailable in this session.

## Outcome and authorization

The owner requested Desktop and Phone downloads on the existing private installer page using the same download key. This delivery extends that page; Android remains a private local text-note preview under GitHub #276. It does not fulfill the remaining desktop Windows acceptance gates or Android device acceptance.

## What changed and why

- Matching Desktop and Phone selection cards reuse the existing website typography, paper colours and controls. Cards have identical dimensions, including the narrow-screen stacked layout.
- One transient key input decrypts the selected package locally with the existing PBKDF2/AES-GCM envelope. The key is cleared immediately after submission and on completion; it is not stored or transmitted.
- Platform configuration allowlists package paths, filenames and MIME types. Cached ciphertext is scoped to its selected platform and invalidated on switching or failed authentication. Duplicate submissions and platform changes are disabled during an active download.
- Retrieval retains retry, authentication and integrity feedback. Android receives a 60-second request deadline; Windows retains 15 seconds.
- A CSS fix ensures the retry button is actually hidden when inactive despite the existing button display rule.

## Desktop boundary

The published package remains Windows **v0.1.51**, compatible with the current live backend. The prepared v0.1.52 desktop candidate requires the separately proposed backend migration and matching Edge function before publication. This page execution does not authorize or apply those production changes.

Windows v0.1.51 NSIS SHA256:
`584dd3425147dfc377437b205041d41a8894cab5393cd4142d011fb5c576da4e`

## Verification

- Website validation: 37 required files and 19 tests pass.
- Synthetic UI tests cover both platform dispatches, filename/MIME, same transient key, cache isolation after retry, duplicate/in-flight submission, failed authentication/fresh retry, unavailable builds and URL allowlisting.
- Browser inspection at 1280, 390 and 320 pixels: no horizontal overflow; cards equal width and height in each layout; inactive retry hidden. Real WebCrypto rejects a synthetic incorrect key against the desktop ciphertext, clears the input, restores focus and re-enables the form.
- Existing Windows ciphertext decrypted locally using the external owner key and matched the expected installer SHA256. No key was printed, committed or copied into deployment inputs.
- The in-app browser failed initialization (`system cannot find the path specified`); browser verification used the installed agent-browser skill/CLI in an isolated session.

## Historical APK and publication evidence — 3 October 2026

The Android APK is built and inspected. Package `app.skribly.mobilepreview`, v0.0.1/code1, minSdk24 (Android7+), targetSdk36, ARM64-only; 26,096,681 bytes. APK SHA256: `46fde03076fb3fe5273ba44c7ddbde8db687ebf177a192fa96132916354e62a7`. Its v2 debug signature verifies; zipalign 16 KB and native ELF 16 KB alignment pass. All 30 current frontend assets, including bundled DM Sans/Manrope/Kalam, match the compiled codegen assets. The final manifest disables cleartext and backup/transfer and contains only framework INTERNET plus an AndroidX self-signature receiver permission. Runtime compiled source: `2d11d2558d35f707edf6fdb205322a7d6e451c23` in the separate Android foundation branch. No physical phone was installed or tested.

Android ciphertext is 26,096,733 bytes; SHA256: `6e318df98ef32b7c8bb9efe0dc4bf33c44dc7f9224fccb1b2e20d83dac51fc79`. Local decryption with the same external owner key matches the APK hash exactly. Only ciphertext is staged in website/repository inputs; the raw APK and debug signer remain outside those inputs.

On 3 October, website publication was blocked by the Vercel free daily deployment quota (`api-deployments-free-per-day`, more than 100). The production CLI attempt also returned the same quota failure after upload; no new deployment went live. The owner chose to wait for the original URL, https://skribly-desktop.vercel.app/v0-download. Automatic approval review rejected the attempted background publication retry with only `blocked by policy`; no helper/process was started and no retry is scheduled. A fresh foreground deployment attempt is required when quota resets, followed by original-URL page/configuration and both ciphertext/plaintext hash checks. No success or phone availability is claimed before publication is verified. Physical Android installation, system Back, process-death recovery, keyboard/gesture insets, TalkBack and storage lifecycle remain owner/device acceptance work. Explicit Save is required; no desktop sync, attachments or ink are implemented in this first Android preview.

## Recovery

Restore the preceding Vercel production deployment to revert the page and download assets. This change has no live backend migration or user-note rewrite. Keep the owner key external to repository and uploads. A private debug Android preview uses its own application ID and is separate from Windows data.

Android packaging source and inspection report: [private preview execution](https://github.com/Ankit6149/skribly/blob/9028a20b589aebfd5c4b55c214766a12e8f86f32/docs/06-planning/ANDROID_PRIVATE_PREVIEW_2026-10-03.md). Native helper/docs head is `9028a20b589aebfd5c4b55c214766a12e8f86f32`; it changes no compiled runtime inputs.

## Tracking and executor

GitHub #276 tracks the Android outcome; desktop ARC-66 remains open at its existing Windows/owner acceptance boundary. Linear write-back pending: connector reauthentication is required. Executor: Codex coordinator, with the existing Android foundation agent handling native APK prerequisites/build and inspection.
