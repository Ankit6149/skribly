# Skribli v0.1.43 — private owner candidate

## Post-install regression — owner report

The owner installed v0.1.43 and could not see the compact widget. A DPI-aware inspection found its native window visible at the right edge (`1885,460`, `35×100` physical px at 125% scaling), and UI Automation found the “Open My Skribs” button, but a screen capture showed no pastel strips. The expanded panel itself rendered. After collapse, `DWMWA_SYSTEMBACKDROP_TYPE` was `DWMSBT_NONE` (`1`). Setting that attribute to `DWMSBT_AUTO` (`0`) on the running widget restored the yellow, peach, and lavender strips immediately. The cause is the v0.1.43 `set_effects(None)` collapse path, which selected `DWMSBT_NONE` for the transparent WebView window.

The repository now uses the native DWM backdrop attribute directly: `DWMSBT_TRANSIENTWINDOW` while the panel is open and `DWMSBT_AUTO` when the compact widget is shown. The current installed v0.1.43 executable does **not** contain this source correction. No new installer was built at the owner's request; incorporate and verify the fix in the next candidate. The live `AUTO` adjustment on the running process is temporary and may reset on restart or after opening and closing the panel. Treat the v0.1.43 installer as a known regression, not an accepted candidate.

26 September 2026. The owner clarified that the view opened from the **compact desktop edge widget** should be a full-height side panel with a pastel frosted glass surface that blurs other content behind it. The separate in-app Skribs view is a different surface and is unchanged by this pass.

## Change

The prior global panel was fixed at 430 logical px high, and its CSS `backdrop-filter` could not sample other Windows applications behind the transparent WebView. The open widget now sizes to the selected monitor's usable height, docks flush to its left or right edge, and uses Windows Desktop Acrylic through Tauri's native window effect. A translucent pastel gradient tints that backdrop while light note rows and dark text preserve readability. The panel is 388 logical px wide (or narrower on a constrained monitor). Its header and app filters stay at the top; the full note list scrolls below them. The previous five-note truncation is removed. On collapse, the compact widget returns to its previous vertical position and the Acrylic effect is cleared.

The compact widget's appearance and dimensions, the separate in-app view, note records, account state, and previous focus-rim correction are unchanged.

## Verification

- Desktop production build, theme/compact-surface validators, and all 233 frontend tests passed.
- Rust release check and formatting passed. A native placement test verified full work-area height at 125% scaling, both left-edge positioning and return to the widget's previous vertical position, and narrow-monitor width clamping.
- Private NSIS owner installer built. Executable product version is 0.1.43 and contains the active public entitlement verification key.
- Installer: 3,604,652 bytes; SHA-256 `0D617EEA641A246F3A717F0AD9200B12CD32A6C9F8DC87C9BF87FE871C910989`; Authenticode `NotSigned`.

## Owner acceptance still required

Install v0.1.43 over the current build with the same account and notes. Open the compact desktop widget from both screen edges. Confirm the panel runs from the top to the bottom of the usable screen, other app text/content behind it is visibly blurred, rows remain legible, the full note list scrolls, and collapse returns the widget to its prior position. The separate in-app Skribs view should behave as before. The installed v0.1.42 focus-rim correction, sign-in, preserved notes, attachment persistence, and upgrade path remain open owner checks. No account reset or note deletion is needed.

Private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.43/Skribli_0.1.43_x64-setup.exe`. Keep PR #207 draft, ARC-13 In Review, and public downloads disabled pending Windows acceptance and signing.
