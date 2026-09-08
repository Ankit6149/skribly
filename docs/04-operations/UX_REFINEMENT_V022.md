# v0.1.22 — floating rail snap containment

## Owner report

Dragging the collapsed My Skribs widget close to the top or side of the display could expose a work-area-sized grey surface around the 64 px rail pill.

## Root cause

The transparent rail host was marked as a user-resizable Windows window. Skribli moves it through the native title-bar drag path, so Windows could interpret a drag near a screen edge as a Snap Layout or maximize request. The WebView then occupied the enlarged transparent host and Windows rendered the unused area as a grey sheet.

## Correction

- The rail host is non-resizable and non-maximizable to keep it outside Windows Snap Layouts.
- Its native size is bounded to the two supported surfaces: 64 × 64 collapsed and 336 × 500 expanded.
- Before every programmatic size transition, Skribli recovers a rail left maximized by an older build and reapplies the non-resizable/non-maximizable contract.
- Click-to-open, deliberate drag, nearest-edge magnetic docking, Y-axis placement, transparency, and always-on-top behavior remain unchanged.

## Verification contract

- Static validation rejects a rail that can be user-resized or maximized and checks the 64 × 64 to 336 × 500 envelope.
- Native rail geometry tests retain nearest-edge docking, negative-origin monitor, inward growth, and stale-movement suppression coverage.
- Installed-app visual acceptance remains with the owner, as requested.

## Release evidence

- All six pending Dependabot updates were merged before packaging; only `main` remains.
- Exact candidate: `6b7f076f33f863832abfacf321cc7b6eb301d46a`.
- Windows workflow: `34219289037`; private artifact: `10053445093`.
- NSIS installer: `Skribli_0.1.22_x64-setup.exe`, 3,476,305 bytes.
- NSIS SHA-256: `df502bb4772838d7f2103eb86a67438c1a1eb722312a2ac72788abb77ad76c8f`.
- Encrypted owner asset: 3,476,357 bytes; SHA-256 `a24ec280b3e17df2bcbd00cb3694ca2a317fad763161865fc72b7bedab93eb2a`.
