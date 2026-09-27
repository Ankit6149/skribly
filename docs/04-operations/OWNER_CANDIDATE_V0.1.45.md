# Skribli v0.1.45 — private owner download candidate

28 September 2026. This candidate corrects two issues found while testing v0.1.44: its round note app icon was shifted left, and the desktop installer lacked the newer main app UI already merged on `main`. It is available through the encrypted owner-key website download. It is not signed or public. ARC-13 remains open for installed Windows acceptance.

## Source and scope

- Desktop source commit: `980f6adfd88df3441aeaf2e308c4bac7ebee5876` on draft PR #207. The merge brings the existing `main` desktop UI at `fe82d7d9bfd4007e683ccb2c5c5b5fc33ed7d053` into the owner candidate: Ready, Find, Reminders, Settings, onboarding, library presentation, and larger home window.
- The forced `translateX(-2px)` on the note app icon was removed. Browser geometry now places the icon and chip centers at the same x coordinate. Note preferences remain accessible in the new Settings page, and a controlled Find view preserves navigation during archive/trash requests.
- The v0.1.44 note icon-weight and hover refinements and native widget visibility, outside-handle, panel-height, and note-region source corrections remain included.
- The owner reported that the desktop edge widget's closing slide feels broken. This motion is being investigated separately; v0.1.45 makes no sliding-animation change.

## Artifact identity and verification

- NSIS installer: `Skribli_0.1.45_x64-setup.exe`; 3,626,140 bytes; SHA-256 `C064C312487F38764D2BA33C9AA11624581EA8B2A8A2D67AD56A08B9F305020C`; Authenticode `NotSigned`.
- Encrypted website asset: `site/assets/skribli-v0-windows.enc`; 3,626,192 bytes; SHA-256 `568CFFCF063CD5926292E4EEB1B9D4BB08589D566252C32CD641D72BD18EC1A5`.
- The NSIS build's executable reports version 0.1.45 and contains the owner entitlement public verification key. The production frontend bundle contains the new Ready screen text.
- TypeScript, 232 desktop frontend tests, 211 Rust tests, Rust formatting, production frontend build, site, governance, product-truth, theme, compact-surface, and private-artifact validators passed. Headless Edge rendered the actual note, Ready, and Settings source surfaces; the icon and chip centers matched without a Vite error overlay.
- The same owner download key used for v0.1.44 decrypts this candidate. Its value remains outside the repository and website.

## Owner acceptance still required

Download v0.1.45 from `/v0-download` and install it over the existing owner build with the same account and notes. Verify the new Ready, Find, Reminders, and Settings desktop pages; account sign-in; note preference; existing notes and attachments; the round context icon; and repeated widget open/collapse on both dock sides. Report whether the closing motion remains rough, with a short screen recording if possible. The earlier v0.1.43 `AppHangB1` still has no captured call stack.

No account reset or note deletion is part of this test. A successful build and website download do not establish installed WebView, native-window, upgrade, or sliding-motion acceptance. Keep PR #207 draft, ARC-13 open, and public downloads disabled until the applicable release gates pass.
