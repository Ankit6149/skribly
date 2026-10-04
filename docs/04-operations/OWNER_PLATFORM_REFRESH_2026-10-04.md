# Prepared owner platform refresh — 4 October 2026

## Execution summary

Windows v0.1.53 and Android v0.0.2 are built, inspected, encrypted with the existing external owner key, and staged for the original owner download page. The production website has not been changed by this preparation.

## What changed

The prepared page names `Skribli_0.1.53_x64-setup.exe` and `Skribli_Mobile_Preview_0.0.2_arm64.apk`. Android copy accurately describes offline Skribs and reminders and states that encrypted desktop sync is not connected. The superseded Android v0.0.1 ciphertext is removed from the prepared deployment input.

## Evidence and verification

Windows source `1988e8202a7bf378c0106a0906427643e131b28b` passed the source-bound candidate pipeline, all 15 storage scenarios, installer branding, and NSIS/MSI packaging. Android native source uses the same integrated commit; its ARM64 native library compiled before the reviewed Windows JNI-copy fallback completed all 62 Gradle packaging tasks.

Both prepared ciphertexts decrypt byte-for-byte with the current external owner key:

| Package | Bytes | SHA-256 |
| --- | ---: | --- |
| Windows v0.1.53 NSIS | 3,764,618 | `94e91358b9524fa326638930e376886b74665c9c7b112b7306d0afed7cc957c0` |
| Android v0.0.2 preview APK | 26,098,841 | `23f542276ecb9694d641a30e61db46821160fe0193cf459067d9d887df447dce` |

Android package identity is `app.skribly.mobilepreview`, versionName `0.0.2`, versionCode `2`, minSdk 24, targetSdk 36 and ARM64 only. APK Signature Scheme v2 verification passes with the existing Android debug certificate. This remains a private preview, not a production-signed Play Store package.

Site validation and all 19 website tests pass. Local decryption proof matched both plaintext hashes above. No key was printed, committed, embedded in the site, or sent to a server.

## Remaining boundary

Desktop v0.1.53 uses null-as-unchanged consent refresh. The matching account migration and Edge function must be explicitly approved and deployed in that order before the desktop artifact is published. Android still requires real-phone launch, save/restart, Back, insets, TalkBack, notification delivery and storage-lifecycle acceptance. Cross-device sync is a reviewed ciphertext contract only; no live transport, key enrollment or sync claim exists.

## Next recommended execution and human decision

Approve or decline the prepared production account migration and matching Edge deployment. If approved, deploy and verify that backend, then publish the staged website, fetch both live ciphertexts, decrypt locally and compare the hashes above. Owner installation/runtime acceptance remains open after publication.

Executor: Codex coordinator. **Linear write-back pending:** Linear access is unavailable in this session.
