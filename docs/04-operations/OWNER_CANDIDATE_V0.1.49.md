# Skribli v0.1.49 — private owner download candidate

1 October 2026. This candidate includes the merged desktop UI, centered logo, unified note controls, literal slash handling, centered blurred close dialog, aligned corner spacing, contained paper shadow, and edge-widget closing handoff. It additionally corrects the native app-pill clipping mask. It replaces the prepared but unpublished v0.1.48 candidate and supersedes v0.1.47 for owner testing after the encrypted site asset deploys. It is unsigned and is not a public release.

## Exact source and package

- Desktop source commit: `807f1acc87b43ba326e191a70f62aa793fe43412` on PR #224, based on the merged ARC-13/ARC-66 source PRs #207 and #222.
- The owner build used `scripts/windows/build-owner-installer.ps1`, including account URL, public publishable key, app version, trial enforcement, and entitlement verification public key. No licence private key is in the repository.
- NSIS installer: `Skribli_0.1.49_x64-setup.exe`; 3,626,211 bytes; SHA-256 `D96C8AFACC323890550FD2203011B2170883B5C8084DF25FE3BD81F48185DE4D`.
- Encrypted website asset: `site/assets/skribli-v0-windows.enc`; 3,626,263 bytes; SHA-256 `55D06E22EA75382014031ADA5CD9A3DC59D772C32D4B2D69E7DF7C80F65DC580`.
- The newly generated 64-character owner download key remains outside the repository and website. Decrypting the asset reproduced the installer byte-for-byte and matched the SHA-256 above.

## Source and browser evidence

The preceding desktop UI suite passed 237 tests in 39 files. v0.1.49 adds native clipping changes; all 24 Windows placement tests passed, including real GDI `PtInRegion` checks at 100%, 125%, 150%, 175%, and 200% scaling. TypeScript, production frontend build, theme/runtime/compact validators, Rust formatting, and Windows NSIS packaging passed. The executable reports product name Skribli and version 0.1.49. Final source CI and site CI remain independent gates.

Browser measurement confirms a 22 × 22 px Chrome image in the unchanged 40 × 52 px context chip, with zero horizontal and vertical center offset. Pill bounds relative to the note window are (2,20,40,52), or (2,16,40,52) in the compact layout. The + action has 11 px visible left and bottom inset; the More hover circle has 11 px right and 12 px top inset. The [Chrome hover screenshot](../01-design/evidence/arc-66/note-v0.1.48-chrome-hover.png) and [white-background screenshot](../01-design/evidence/arc-66/note-v0.1.48-white-background.png) remain representative of the unchanged CSS appearance.

The old native pill mask used a fixed 22 px corner diameter, including transparent wedges outside the 40 px capsule. It now derives the diameter from measured physical dimensions and uses a current startup fallback. The [native-mask report](NOTE_PILL_NATIVE_MASK_2026-10-01.md) describes evidence and limits. Tests establish exclusion of those wedges, not installed WebView2 compositor acceptance. The 2 px inset paper shadow improves separation; the earlier v0.1.43 AppHangB1 still has no captured stack.

## Owner acceptance and recovery

Download only from the production website's private `/v0-download` page with the new owner key. Over-install without resetting the account or deleting local notes. Check Chrome/Code logo centering, hover circles, + spacing, white fringe after focus changes, resizing and minimize/restore, centered blurred close confirmation and all three actions, literal `/` and tool selection, Ready/Find/Reminders/Settings, sign-in, existing notes/attachments, rail close on both sides, and persistence after restart. Record display scale and preceding action with screenshot/recording for any fringe or hang.

Keep ARC-13 and ARC-66 open until installed Windows acceptance. Public downloads, signing, installer lifecycle, and legal release gates remain separate. Site rollback restores the encrypted v0.1.47 asset and labels from commit `0425029675b1b86a6f1e02657ad03486eca365b4` and requires its previous private key. No local data reset is part of recovery.
