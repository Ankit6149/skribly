# Skribli v0.1.44 — private owner download candidate

28 September 2026. This candidate is available only through the website's encrypted owner-key download. It is built from desktop source commit `ef5fc92b6ffec8e0c12dd4a279001b0e598ce451` on draft PR #207. It is not a signed or public release, and ARC-13 remains open for installed Windows acceptance.

## Change

- The note header's colour, reminder, Cancel, and More controls use the same 1.75 px icon stroke, resting ink strength, hover fill, hover ink, and press feedback. Add uses that same icon and hover treatment while retaining its quiet resting circle. The three-dot action remains bare at rest. The owner set pill-curve work aside.
- The candidate includes the source corrections made after installed v0.1.43: the compact widget returns to a visible DWM backdrop after panel collapse, the expanded global panel uses a separate outside handle and full work-area height, and the note's native region follows the visible paper and measured place chip more closely. These Windows outcomes still need owner verification.
- The website's `/v0-download` page names the downloaded file `Skribli_0.1.44_x64-setup.exe`. A newly generated key replaces the previous owner download key. The key is stored outside the repository and is never embedded in the site or installer.

## Artifact identity and checks

- NSIS installer: `Skribli_0.1.44_x64-setup.exe`; 3,620,742 bytes; SHA-256 `B375B869AEA47FCB570A135B1BA9C67CE63AAC753F78F1DE1BB4CE3CE2FBB0EF`; Authenticode `NotSigned`.
- Encrypted website asset: `site/assets/skribli-v0-windows.enc`; 3,620,794 bytes; SHA-256 `0F33EE78B5A1DADF29034AF899B5AED60608A9BD1041857B86BC0DB3811AC16D`.
- Optional MSI built for static branding validation: 4,743,168 bytes; SHA-256 `DB13D0A948482FE8970E2FDFEDCFF1345488EE1AE72B441CF648C07C6FDE6BEF`. The website delivers the NSIS installer.
- The NSIS build's executable reports version 0.1.44 and contains the active public entitlement verification key. Static Windows icon and installer-branding checks passed without installing over the owner's application.
- 232 desktop frontend tests, 211 Rust tests, TypeScript checks, desktop production build, repository governance, product-truth, theme, compact-surface, and site validators passed.
- A browser render of the real `SkribComposer` showed the header and Add strokes at 1.75 px and identical computed hover fills. The website form decrypted the final encrypted asset with the new key and downloaded a byte-for-byte match of the NSIS installer.

## Owner acceptance still required

Download v0.1.44 from `/v0-download` with the new key and install it over the existing owner build while keeping the same account and notes. Check sign-in and existing notes first. Then inspect the note header icons at rest and on hover, save and reopen a note, check attachment persistence, and inspect the paper edge after focus changes and resizing. Open and collapse the desktop widget repeatedly, including both dock sides, the outside handle, and app switching; verify the widget remains visible and the expanded panel stays readable. Report any freeze with the exact preceding action. The v0.1.43 `AppHangB1` had no captured call stack, so its cause remains unknown.

No account reset or note deletion is part of this test. A successful build and browser download do not establish installed WebView, native window, or upgrade acceptance. Keep PR #207 draft, ARC-13 open, and public downloads disabled until the applicable release gates pass.
