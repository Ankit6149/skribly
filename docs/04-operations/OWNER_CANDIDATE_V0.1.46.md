# Skribli v0.1.46 — private owner download candidate

28 September 2026. This candidate follows the owner's v0.1.45 note review. It makes the Chrome mark in the note's context chip smaller and optically centered without changing the chip dimensions. A typed `/` now remains visible while the tool menu is open. Choosing a tool removes only that trigger slash; continuing to type or dismissing the menu keeps the slash as note text. The desktop edge widget's closing animation is unchanged.

## Source and artifact

- Desktop source: `6576efa7825ccd714cafd47f4ac917018a46ecb7` on draft PR #207. The newer main app UI and v0.1.45 corrections remain included.
- NSIS installer: `Skribli_0.1.46_x64-setup.exe`; 3,623,591 bytes; SHA-256 `0CBEF4B6525AB029EE01A2E39D9EF4E94ED828D400141A6C18485E8C8746ABCF`; unsigned.
- Encrypted website asset: `site/assets/skribli-v0-windows.enc`; 3,623,643 bytes; SHA-256 `C91A2C4E5C94B9DC49A2696F68BD7570741C1E64A7B34EE73D5C7E9C5E7D1705`.
- The same owner download key used for v0.1.44 and v0.1.45 decrypts this candidate. Its value remains outside the repository and website.

## Verification

TypeScript, 234 desktop frontend tests, production frontend build, theme and compact-surface validators passed locally. The note source preview rendered in Edge without a Vite error overlay; the Chrome mark measured 22 by 22 px in the unchanged 40 by 52 px chip. The frontend tests cover the typed-slash menu, tool selection removal, and ordinary `/a` text. CI and website browser-download evidence should be attached to ARC-13 after the site PR passes and deploys.

## Owner acceptance and public release boundary

Install from `/v0-download` over the existing build without clearing account or notes. Verify the chip logo, `/` then tool selection, `/` followed by normal text, Escape with `/` left in the note, Ready/Find/Reminders/Settings, sign-in, note and attachment persistence, and the edge widget on both dock sides. Record the exact installed hash and any preceding action for failures. The rough closing motion and earlier v0.1.43 `AppHangB1` still lack installed acceptance and a captured root cause.

This is a private unsigned owner candidate. Keep PR #207 draft, ARC-13 open, and public downloads disabled. Broader public launch requires Windows runtime evidence, installer lifecycle and rollback validation, signing, and the applicable legal/support checks; automated frontend and packaging results do not establish those gates.
