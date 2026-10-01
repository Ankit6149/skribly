# Skribli v0.1.50 — private widget owner candidate

2 October 2026. This unsigned candidate replaces v0.1.49 for private website owner testing once the encrypted asset deploys. Public downloads remain disabled. It improves the desktop widget; installed Windows acceptance remains open.

## Exact source and package

- Desktop source: `ea65a94967aef795b888fdbf8593d89a39aaf85d`, PR #225, based on the previously merged v0.1.49 desktop/UI source.
- Built from that clean source using `scripts/windows/build-owner-installer.ps1`: correct account configuration, app version, trial enforcement and entitlement public key. No signing/licence private key was committed.
- NSIS installer: `Skribli_0.1.50_x64-setup.exe`, 3,644,502 bytes; SHA-256 `C19928E96BA3B54CE51B8E1F77B0F2EC86BD8FA0C28F5A678D0195311681F442`.
- Encrypted website asset: `site/assets/skribli-v0-windows.enc`, 3,644,554 bytes; SHA-256 `500EFDD181B8C149BE536DDF1499219128BB69342FAEE0FEC311D1B052550296`.
- Reuses the v0.1.49 owner's private download key. It stays outside the repository and website. Delivery uses the existing local PBKDF2/AES-GCM browser flow; the key is not sent to a server.

## Changes and evidence

The expanded panel now visibly carries the widget's yellow/peach/lavender palette, readable paper cards, app-logo filters, local search and visible scopes. Known-app fallbacks reuse bundled Supericons Chrome/Firefox and the VS Code mark; actual Windows app icons are preferred. Stable hover bounds and atomic native placement address the observed jump path. A native region reveal treats Acrylic/content/hits together, with current-generation paint handoff and compact restoration after closing. UI-thread frame operations use a nonblocking gate; no gate is held while the timing worker waits for UI completion.

See the [surface/motion report](WIDGET_SURFACE_MOTION_2026-10-02.md) and [updated source preview](../01-design/evidence/arc-66/widget-after-open.png). 241 frontend tests/40 files and 177 Windows Rust library tests pass, along with TypeScript, production build and runtime/theme/compact validators. Region tests include real GDI membership checks at four DPI scales and both sides. Browser search, app filtering and a 320 × 480 left-docked empty panel were checked. NSIS packaging passed. Existing compiler/chunk warnings remain.

These establish implementation, geometry and package evidence. Windows Computer Use failed to initialize with kernel-assets path error (os error 3); the installer was not locally installed or executed. Exact installed DWM smoothness, black-flash elimination, idle CPU/RSS, upgrade/account persistence and historical AppHangB1 remain unverified.

## Owner acceptance and rollback

Download through the production `/v0-download` website with the existing owner key. Over-install without resetting notes or accounts. Test repeated open/close (especially closing), outside-click dismissal, interruptions, both dock sides, dragged widget height, multiple monitors/DPI, minimise/restore, reduced motion, app icons when apps are open/closed, and persistence after restart. Check the preceding note/logo/close-dialog/slash corrections are preserved.

ARC-13 and ARC-66 remain open until exact installed owner acceptance. CI, source merge and website publication do not replace that test. Public release, signing, installer lifecycle and launch/legal decisions remain separate. Website rollback restores the v0.1.49 encrypted asset/version labels from `c4c9231657e9a6887aff60b65ef708785564670f` using the same external owner key. Never delete/reset local data as part of rollback.
