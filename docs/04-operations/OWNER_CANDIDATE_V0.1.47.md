# Skribli v0.1.47 — private owner download candidate

28 September 2026. This candidate follows the owner's installed v0.1.46 review. The note context logo is centered horizontally and vertically in the existing chip. The close button now opens a confirmation at the center of the note, blurs the note behind it, and offers Keep editing, Save and close, and Discard and close. The desktop edge widget's closing animation is unchanged.

## Source and artifact

- Desktop source: `bfdfb8913da8a53d7f983b352547864b0d87d627` on draft PR #207. The newer main app UI, typed `/` tool behavior, and earlier note/widget corrections remain included.
- NSIS installer: `Skribli_0.1.47_x64-setup.exe`; 3,623,549 bytes; SHA-256 `E4153412E15814B8C731E6868A685448F5D08B1277E673641B8042BF16D8FECD`; unsigned.
- Encrypted website asset: `site/assets/skribli-v0-windows.enc`; 3,623,601 bytes; SHA-256 `907B215FEAC1753896BC4D83BE858414B512F0E9927732CA3E2A7C3F2F2A326E`.
- The existing owner download key decrypts this candidate. Its value remains outside the repository and website.

## Verification

All 235 desktop frontend tests, TypeScript, production frontend build, theme and compact-surface validators, and NSIS packaging passed locally. The note source preview rendered in Edge: the logo measured 22 by 22 px and its center coincided with the center of the unchanged 40 by 52 px chip. The browser preview showed the centered, blurred close confirmation with all three choices. The automated test checks the dialog, choices, initial focus, and Escape focus return. Site CI and website download evidence should be attached to ARC-13 after deployment.

## Owner acceptance and public release boundary

Install from `/v0-download` over the existing build without clearing account or notes. Check the logo in a real Chrome-context note, the close dialog placement, blur, Save and close, Discard and close, and preservation or removal of the expected note. Recheck `/` tool behavior, Ready/Find/Reminders/Settings, sign-in, note and attachment persistence, and edge widget visibility and collapse on both dock sides. Record the exact preceding action and screenshot/log for any failure. The rough closing motion and earlier v0.1.43 `AppHangB1` still lack installed acceptance and a captured root cause.

This is a private unsigned owner candidate. Keep PR #207 draft, ARC-13 open, and public downloads disabled. Broader public launch requires Windows runtime evidence, installer lifecycle and rollback validation, signing, and applicable legal/support checks.
