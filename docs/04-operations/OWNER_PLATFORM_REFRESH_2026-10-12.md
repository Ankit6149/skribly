# Private owner platform refresh — 12 October 2026

Part of ARC-66. Executor: Codex. The owner authorized rebuilding the final installer, uploading the private packages and committing/pushing.

## Exact Windows candidate

Windows v0.1.54 includes the final tray, icon, hover and empty-note placeholder changes. Source: `f70d20879b80f3bef540781bb7ab4a13d7d0f670`. Candidate: `v0.1.54-f70d20879b80-20261011T185837044Z-f9726829`. The source tree was clean before packaging. All 20 build gates passed, including 397 desktop tests, Android foundation checks, native checks, 15 synthetic storage acceptance scenarios and installer branding. No further manual app testing was performed; the owner will test the installed packages.

NSIS: `Skribli_0.1.54_x64-setup.exe`, 3795139 bytes, SHA-256 `859409fc52b1eada8199bc4b4f5298bb8e501710222243acfe44d571baacab3d`. Signing: NotSigned. MSI and application identities are in the [manifest](evidence/private-owner-0.1.54-f70d208/manifest.json). Synthetic [storage evidence](evidence/private-owner-0.1.54-f70d208/storage-acceptance-evidence.json) and [branding evidence](evidence/private-owner-0.1.54-f70d208/branding-evidence.json) are preserved.

## Android and owner delivery

Android remains the certified v0.0.2 ARM64 debug-signed APK: 26,098,841 bytes; SHA-256 `23f542276ecb9694d641a30e61db46821160fe0193cf459067d9d887df447dce`. It supports offline notes and reminder entries. System notifications, encrypted desktop sync and the newest desktop/source Iconify refinements are not in this APK. No fresh APK or mobile service was selected. [Software comparison](../06-planning/ANDROID_SOFTWARE_DECISION_2026-10-11.md).

Both packages were locally encrypted and decrypted byte-for-byte using the actual website download implementation and one fresh owner download key. The key is outside Git and the website; no plaintext key or installer is deployed. The private owner page is https://skribly-desktop.vercel.app/v0-download. Website validation passed 19/19 tests. Production upload and live download verification are pending in this preparation commit.

## Remaining acceptance

Owner installation and real-phone testing remain pending. Windows blur, focus, DPI/multi-monitor, startup, persistence and installation/upgrade/uninstallation/rollback require installed-binary acceptance. Signing and public release remain open. ARC-66 remains In Progress; this private package is not a public release.
