# Skribli v0.1.41 — private owner candidate

26 September 2026. The owner installed v0.1.40 and showed a pale border around an otherwise transparent note after changing focus. Collapsing to the dot and reopening cleared it temporarily.

## Diagnosis

On the installed v0.1.40 process at 125% Windows scaling, the unfocused note's top fringe contained four pure-white pixels (`255,255,255`) before the pink paper began. The note's HTML, WebView2 background, and native host were configured transparent; no focus-dependent CSS changed the paper backdrop. Windows reported a one-pixel DWM frame, but setting its border color to `DWMWA_COLOR_NONE` left the rim visible, so that theory was rejected and the default was restored. A native `RedrawWindow` call on the existing note HWND removed the white pixels while the note remained unfocused. Switching focus back to another app recreated them; another redraw cleared them again. The diagnostic capture was made DPI-aware to avoid Windows coordinate virtualization.

## Change

After either focus transition, the main note window now waits 40 ms for the native focus paint, then invalidates and redraws its host and child WebView. This preserves the transparent fringe needed for smooth paper and chip corners. Collapsed dots are excluded. Note storage, account flow, paper geometry, and other windows are unchanged.

## Verification

- Live installed v0.1.40 experiment: top fringe changed from `255,255,255` to the underlying desktop color `39,40,34` after `RedrawWindow`, including while unfocused. Repeating the focus switch recreated the white fringe and the same redraw cleared it.
- Rust release check and formatting passed; all 22 Windows placement and region tests passed.
- Desktop theme and compact-surface validators, TypeScript build, and production Vite build passed during packaging.
- NSIS owner installer built from the final source. Executable version is 0.1.41 and contains the entitlement verification public key.
- Installer: 3,549,146 bytes; SHA-256 `4EB64EBE0DCF5777F2D91F17E2782C7506843BD6B6034893A4EC19C2BB9918A9`; Authenticode `NotSigned`.

## Owner acceptance still required

Install v0.1.41 over v0.1.40, keep the same account and notes, then switch focus between the open note and another application several times. Check the top, left, and bottom paper edges, including after resizing and collapsing/reopening. The live API experiment establishes the redraw mechanism, but the new focus-event timing still needs installed Windows acceptance. Sign-in, existing notes, and attachment removal persistence remain separate owner checks. No account reset or note deletion is needed.

Local private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.41/Skribli_0.1.41_x64-setup.exe`. Public downloads remain disabled until the signed-release and owner Windows acceptance gates pass.
