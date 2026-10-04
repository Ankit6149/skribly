# Prepared owner platform refresh — 4 October 2026

## Production execution — 4 October 2026

Repository-owner approval was received after the integrated source merged to `main`. The matching Supabase migration and `account-session` v5 deployment completed and passed the metadata, grant, synthetic-version, source-match and unauthenticated HTTP 401 checks recorded in the account deployment report.

Vercel production deployment `dpl_HD1G8Fp7W2bhy967SwrrjTdcJVLJ` reached READY and was aliased to `https://skribly-desktop.vercel.app`. The live owner page HTML, JavaScript modules and stylesheet match the merged source byte-for-byte. Both live ciphertexts returned HTTP 200, matched their prepared ciphertext hashes, decrypted locally with the external owner key, and matched the certified plaintext hashes below. The key was not printed, committed, uploaded or transmitted.

Installed-device acceptance remains open: Windows install/upgrade and runtime behavior must be checked on the owner laptop, and Android launch/save/restart/Back/insets/TalkBack/notification/storage behavior must be checked on a supported ARM64 phone. Android desktop synchronization remains unconnected and is described that way on the live page.

Executor: Codex coordinator. **Linear write-back pending:** Linear access is unavailable in this session.

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

Automatic Vercel deployment from `main` is disabled in both possible project-root configurations. This lets the integrated source merge without publishing the backend-dependent owner package. After the account migration and Edge deployment are approved and verified, publication must use an explicit reviewed Vercel production deployment; CLI deployments remain available.

## Next recommended execution and human decision

Approve or decline the prepared production account migration and matching Edge deployment. If approved, deploy and verify that backend, then publish the staged website, fetch both live ciphertexts, decrypt locally and compare the hashes above. Owner installation/runtime acceptance remains open after publication.

Executor: Codex coordinator. **Linear write-back pending:** Linear access is unavailable in this session.
