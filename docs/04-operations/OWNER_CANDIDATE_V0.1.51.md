# Skribli v0.1.51 — private widget visual refinement

2 October 2026. Unsigned private owner candidate replacing v0.1.50 once website deployment succeeds. Public downloads remain disabled; installed owner acceptance remains open.

## Exact source and artifact

- Desktop source `6c579a7f0520131b212fa1660060e1f363a1d246`, [PR #227](https://github.com/Ankit6149/skribly/pull/227), including the owner's card-height/width and icon-size clarification.
- Built from that clean source using `scripts/windows/build-owner-installer.ps1`, with enforced trial/account configuration, app version and entitlement public key. No private signing/licence/download key committed.
- Installer `Skribli_0.1.51_x64-setup.exe`: 3,644,577 bytes; SHA-256 `91F71A7316793F443E239BEDEBEFB0F89E8A6EA6992BF707C7BD9A2507FF8F37`.
- Website encrypted asset: 3,644,629 bytes; SHA-256 `A542186C016998F70E7E5B0DEB77C93B1A8116FA5B300F4F8C109A99E7DC0F67`.
- Reuses the existing v0.1.49/v0.1.50 private owner key, kept outside the repository and website. Existing browser PBKDF2/AES-GCM flow; key never sent to a server. Local decryption verifies the exact installer SHA-256.

An initial v0.1.51 build without the dimension correction is superseded and was not published. Only the hash above is the delivery candidate.

## Changes and evidence

Cleaner scope tabs, unframed app logos, quieter paper cards/colour dots, consistent interface-font list previews and refined spacing. Previous card height/width and app-icon sizes are retained. All five sample card rectangles and six app-logo rectangles match the preceding stylesheet at 388 × 800 after fonts load. Card width 334 px; first height 89.078125 px, remaining heights 108.671875 px. Filter logos 20 px, card logos 18 px. Heights remain content-driven, as before.

See [visual report](WIDGET_VISUAL_POLISH_2026-10-02.md), [preview](../01-design/evidence/arc-66/widget-polish-after.png) and [bounds evidence](../01-design/evidence/arc-66/widget-polish-bounds.json). A 320 × 480 panel has no horizontal overflow, a visible footer and scrolling notes. Dark hover icons and accessible app-filter selection were checked. TypeScript, six dismissal/focus tests, production build and React/runtime/theme/compact validators pass. NSIS build and site validation pass; existing compiler/chunk warnings remain. Current-head GitHub CI and Windows release-mode storage acceptance are required before merge.

Native v0.1.50 reveal/placement logic is unchanged; note editor/contextual shelf handwriting, storage and accounts are preserved. No schema migration, dependency, remote icon call or background task. No local installer was executed. Browser/component/package evidence does not establish installed Acrylic appearance, native closing smoothness, black-flash elimination, historical AppHangB1 resolution or idle CPU/RSS.

## Owner acceptance and recovery

Download from production `/v0-download` with the existing owner key. Over-install without resetting notes/accounts. Review card dimensions, app icons, spacing and hover/focus states; repeat v0.1.50 opening/closing, interruption, dock-side, dragged-height, monitor/DPI, reduced-motion and restart/persistence checks. Record installed evidence before closing ARC-66 or ARC-13.

Source merge, CI, package build and private publication do not constitute public launch/signing or owner acceptance. Website rollback restores the v0.1.50 encrypted asset/version labels from `7fd7fa95f1d9d3bd9b7f9baab957abfd57e1edd8` using the same external key. Never reset/delete notes or accounts to roll back.
