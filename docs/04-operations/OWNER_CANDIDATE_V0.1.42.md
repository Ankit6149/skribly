# Skribli v0.1.42 — private owner candidate

26 September 2026. The owner installed v0.1.41 and confirmed that the pale rim still appeared after switching to another app. This supersedes the v0.1.41 acceptance claim; the earlier Tauri focus event correction did not solve the installed behavior.

## Diagnosis and correction

On the installed v0.1.41 process at 125% scaling, a DPI-aware probe measured four pure-white pixels along the transparent top fringe after the note lost focus. The native window region included those coordinates. An external `RedrawWindow` call with host and child invalidation cleared the white to the underlying desktop color (`39,40,34`) while the note stayed unfocused. A real activation change recreated the white; the same redraw 40 ms later cleared it and it stayed clear during the observation. The v0.1.41 Tauri focus handler therefore did not deliver the needed native redraw in this flow. The exact missed event or dispatch point is not established.

v0.1.42 schedules a one-shot redraw from the note window's native `WM_ACTIVATE` / `WM_ACTIVATEAPP` procedure. The existing native subclass handles the timer and excludes the collapsed dot. No note records, account state, or paper geometry are changed by this correction. Installed v0.1.42 focus behavior still needs the owner's test.

## Expanded panel

The compact widget is unchanged. Its expanded panel now opens visually from its docked edge over one restrained pastel gradient with a frosted backing. The original Skribli logo remains in the header. Rows are compact, have a narrow note-color cue, and show the actual running application's Windows icon where available. Icons are cached locally after capture so saved app rows can continue to show them when that app closes; a simple fallback glyph appears until a valid icon is available. The contextual panel uses the same surface while retaining its note previews and direct open controls.

## Verification

- Installed v0.1.41 live Win32 focus switch and pixel/redraw experiment as described above.
- Desktop production build, theme/compact-surface validators, and 233 frontend tests passed.
- Rust release compilation and formatting passed. Native placement tests were run separately.
- NSIS installer built with the active public entitlement verification key embedded. Executable product version is 0.1.42. Installer is unsigned.
- Installer: 3,595,369 bytes; SHA-256 `B0CE7EDC4C1DAEA0DBD3C0096CDA28BCB363CFBCFA07755331E2E32709ADA7C9`.

## Owner acceptance still required

Install v0.1.42 over v0.1.41 with the same account and notes. Open a note and change focus repeatedly between the note and another application; inspect the top, side, and bottom transparent edges. Collapse to the dot and reopen. Open the compact widget's expanded panel from both left and right dock positions; confirm the panel, app icons, and note actions render and work in the installed app. Sign-in, preserved notes, attachment removal persistence, and upgrade behavior remain open owner checks. No account reset or note deletion is needed.

Private installer: `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.42/Skribli_0.1.42_x64-setup.exe`. Keep GitHub PR #207 draft, ARC-13 In Review, and public downloads disabled pending Windows owner acceptance and signing.
