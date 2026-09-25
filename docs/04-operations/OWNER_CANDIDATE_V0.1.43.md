# Skribli v0.1.43 — private owner candidate

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
