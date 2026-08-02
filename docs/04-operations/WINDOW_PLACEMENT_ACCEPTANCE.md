# Compact editor placement acceptance

> **Status:** automated implementation and deterministic placement tests are maintained in the repository. Physical Windows acceptance remains required before parent issue 19 can close or a public installer can be enabled.

## Purpose

This runbook verifies that the compact Skribli editor opens beside the captured target application, remains fully inside that display's usable work area, retains readable logical sizing under Windows scaling, and can be recovered through the visible **Reposition** action.

Compilation, unit tests, website deployment, and screenshots from a browser preview do not prove native monitor selection, taskbar exclusion, per-monitor DPI transitions, Remote Desktop behavior, or display topology changes.

## Evidence identity

Every completed run must record:

- source commit SHA;
- pull request or release candidate reference;
- exact executable or installer SHA-256;
- build channel and version;
- Windows edition, version, build, and architecture;
- display model or virtual display description;
- display resolution, orientation, physical arrangement, primary-display selection, and scaling percentage;
- taskbar edge and auto-hide state;
- target application and privilege level;
- expected result, actual result, pass/fail, reviewer, and date;
- screenshot or recording references that contain no private note text or sensitive window titles.

Do not reuse evidence after the source commit, Tauri/WebView runtime, Windows build, display driver, placement code, or installer changes.

## Automated contract

The Windows unit suite must cover:

- 100%, 125%, 150%, and 200% scaling;
- monitors to the left of and above the primary display;
- a monitor whose usable work area is reduced by the taskbar;
- portrait work areas;
- virtual-desktop gaps;
- targets spanning displays;
- constrained but readable work areas;
- work areas too small for a readable editor, which must fail closed;
- final placement containment inside the selected work area.

The implementation must use the monitor nearest the captured target HWND and its `rcWork` rectangle. The old virtual-desktop bounding rectangle is not a valid placement boundary.

## Physical Windows matrix

Run every applicable row on Windows 10 and Windows 11 before release approval.

| Scenario | Required variations | Pass condition |
| --- | --- | --- |
| Single display | 100%, 125%, 150%, 175%, 200% | Editor is fully visible, readable, focused, and near the target. |
| Display to the right | Same and mixed scaling | Editor stays on the target display and does not cross into the gap or primary display. |
| Display to the left | Negative X origin, mixed scaling | Editor stays fully within the left display work area. |
| Display above | Negative Y origin, mixed scaling | Editor stays fully within the upper display work area. |
| Portrait display | 100% and high scaling | Editor remains readable and fully contained. |
| Target spanning displays | Majority on each display in separate runs | Windows' selected nearest monitor is used consistently and the editor is fully contained there. |
| Taskbar | Left, right, top, bottom; auto-hide on/off | Editor never opens behind reserved work-area space. |
| Display move while open | Drag target between monitors and scaling zones | Editor recalculates without becoming clipped or inaccessible. |
| Display disconnect/reconnect | Disconnect the target display while editor is hidden and while visible | No window is stranded off-screen; a clear failure or safe reposition occurs. |
| Resolution/orientation change | Landscape/portrait and resolution changes | Editor remains inside the refreshed work area. |
| Remote Desktop | Connect, resize session, disconnect, reconnect | Editor remains reachable and placement errors are visible. |
| Sleep, lock, resume | With one and multiple displays | Editor does not return off-screen or at stale scaling. |
| Manual recovery | Keyboard-tab to **Reposition**, then activate it | The editor returns beside the current target or shows an actionable error. |
| Elevated target | Standard Skribli process with elevated application | Unsupported access fails clearly and does not bind or place against stale data. |

## Core workflow

For each matrix row:

1. Start the exact candidate build and confirm only one Skribli process and tray icon exist.
2. Focus the intended target application.
3. Press **Ctrl + Shift + Space**.
4. Confirm the compact editor opens on the target monitor, not merely somewhere inside the virtual desktop.
5. Confirm every edge of the native editor rectangle is inside the selected monitor's usable work area.
6. Confirm the editor's logical size and control readability are consistent with the scaling percentage.
7. Type a non-sensitive test note and confirm save state remains truthful.
8. Move or resize the target where the scenario requires it and verify the editor recalculates safely.
9. Use keyboard navigation to activate **Reposition** and verify the result.
10. Save and close, reopen through the shortcut, and repeat to rule out stale cached placement.
11. Record exact evidence identity and result.

## Failure handling

A release-blocking failure includes:

- any editor edge outside the selected work area;
- placement in unused virtual-desktop space;
- placement behind a taskbar or reserved edge;
- unreadable controls caused by incorrect physical/logical conversion;
- showing the editor after final native rectangle validation fails;
- a stale target HWND or stale monitor being reused silently;
- the **Reposition** action being unreachable by keyboard;
- a display change stranding the editor off-screen;
- an error that hides the editor without telling the user what failed.

Record failures against the exact commit and environment. Keep the relevant issue open until the defect is fixed and the affected matrix rows are rerun.

## Release gate

Parent issue 19 remains open until all required physical rows have reviewed evidence tied to the exact release candidate. This document is a test procedure, not evidence that the matrix has already passed.
