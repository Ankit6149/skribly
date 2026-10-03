# Owner platform download page — 3 October 2026

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

## Remaining publication and acceptance evidence

The Android APK is built and inspected. Package `app.skribly.mobilepreview`, v0.0.1/code1, minSdk24 (Android7+), targetSdk36, ARM64-only; 26,096,681 bytes. APK SHA256: `46fde03076fb3fe5273ba44c7ddbde8db687ebf177a192fa96132916354e62a7`. Its v2 debug signature verifies; zipalign16KB and native ELF16KB alignment pass. All30 current frontend assets, including bundled DM Sans/Manrope/Kalam, match the compiled codegen assets. The final manifest disables cleartext and backup/transfer and contains only framework INTERNET plus an AndroidX self-signature receiver permission. Runtime compiled source: `2d11d25` in the separate Android foundation branch. No physical phone was installed or tested.

Android ciphertext is26,096,733 bytes; SHA256: `6e318df98ef32b7c8bb9efe0dc4bf33c44dc7f9224fccb1b2e20d83dac51fc79`. Local decryption with the same external owner key matches the APK hash exactly. Only ciphertext is staged in website/repository inputs; the raw APK and debug signer remain outside those inputs.

Website publication is currently blocked by the Vercel free daily deployment quota (`api-deployments-free-per-day`, more than100). A temporary hosted-page preference was requested from the owner. Production URL verification remains pending. Physical Android installation, system Back, process-death recovery, keyboard/gesture insets, TalkBack and storage lifecycle remain owner/device acceptance work. Explicit Save is required; no desktop sync, attachments or ink are implemented in this first Android preview.

## Recovery

Restore the preceding Vercel production deployment to revert the page and download assets. This change has no live backend migration or user-note rewrite. Keep the owner key external to repository and uploads. A private debug Android preview uses its own application ID and is separate from Windows data.

## Tracking and executor

GitHub #276 tracks the Android outcome; desktop ARC-66 remains open at its existing Windows/owner acceptance boundary. Linear write-back pending: connector reauthentication is required. Executor: Codex coordinator, with the existing Android foundation agent handling native APK prerequisites/build and inspection.
