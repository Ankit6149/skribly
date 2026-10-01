# Skribli v0.1.51 — private widget visual refinement

2 October 2026. Unsigned private owner candidate replacing v0.1.50 once website deployment succeeds. Public downloads remain disabled; installed owner acceptance remains open.

## Exact source and artifact

- Desktop source `ee33a3b2aa5262406efcb3ae3b37fc46fe27d330`, [PR #227](https://github.com/Ankit6149/skribly/pull/227), including the owner's final clarification: all cards must share one consistent height and width.
- Built from that clean source using `scripts/windows/build-owner-installer.ps1`, with enforced trial/account configuration, app version and entitlement public key. No private signing/licence/download key committed.
- Installer `Skribli_0.1.51_x64-setup.exe`: 3,650,343 bytes; SHA-256 `584DD3425147DFC377437B205041D41A8894CAB5393CD4142D011FB5C576DA4E`.
- Website encrypted asset: 3,650,395 bytes; SHA-256 `BBD1FD5463D3BFF98BCE282FC686B0C9990AB235C3C6C9257F5631F120A33C18`.
- Reuses the existing v0.1.49/v0.1.50 private owner key, kept outside the repository and website. Existing browser PBKDF2/AES-GCM flow; key never sent to a server. Local decryption verifies the exact installer SHA-256.

Intermediate v0.1.51 builds without uniform card dimensions are superseded and were not published to production. Only the hash above is the delivery candidate.

## Changes and evidence

Cleaner scope tabs, unframed app logos, quieter paper cards/colour dots, consistent interface-font list previews and refined spacing. Every card shares one fixed 110 px height and the same column width: all five measure 334 × 110 px at 388 × 800 and 266 × 110 px at 320 × 480. Titles clamp to one line with full-title label/tooltip; previews clamp to two. App-logo dimensions stay unchanged: filters 20 px, cards 18 px. This supersedes the intermediate interpretation of preserving the previous different content-driven heights.

See [visual report](WIDGET_VISUAL_POLISH_2026-10-02.md), [preview](../01-design/evidence/arc-66/widget-polish-after.png) and [bounds evidence](../01-design/evidence/arc-66/widget-polish-bounds.json). A 320 × 480 panel has no horizontal overflow, a visible footer and scrolling notes. Dark hover icons and accessible app-filter selection were checked. TypeScript, six dismissal/focus tests, production build and React/runtime/theme/compact validators pass. NSIS build and site validation pass; existing compiler/chunk warnings remain. Current-head GitHub CI and Windows release-mode storage acceptance are required before merge.

Native v0.1.50 reveal/placement logic is unchanged; note editor/contextual shelf handwriting, storage and accounts are preserved. No schema migration, dependency, remote icon call or background task. No local installer was executed. Browser/component/package evidence does not establish installed Acrylic appearance, native closing smoothness, black-flash elimination, historical AppHangB1 resolution or idle CPU/RSS.

## Owner acceptance and recovery

Download from production `/v0-download` with the existing owner key. Over-install without resetting notes/accounts. Review card dimensions, app icons, spacing and hover/focus states; repeat v0.1.50 opening/closing, interruption, dock-side, dragged-height, monitor/DPI, reduced-motion and restart/persistence checks. Record installed evidence before closing ARC-66 or ARC-13.

Source merge, CI, package build and private publication do not constitute public launch/signing or owner acceptance. Website rollback restores the v0.1.50 encrypted asset/version labels from `7fd7fa95f1d9d3bd9b7f9baab957abfd57e1edd8` using the same external key. Never reset/delete notes or accounts to roll back.
