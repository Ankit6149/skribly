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
