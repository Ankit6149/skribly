# v0.1.16 — workspace and interaction refinement

## Evidence and scope

On 4 September 2026, the installed executable reported **0.1.14**. Actual Home and rail captures are retained locally in `artifacts/ux-v016/` (not committed: they contain private note titles). The installed rail still included the retired inline preview. Version 0.1.15 already replaced that preview with separate Open here / Open at saved location actions.

This release builds on those changes, without changing the website, logo, account session, note storage format, or owner key. It is a scoped refinement, not a claim that all historical feature requests or production-readiness issues are complete.

## Implemented

- One taskbar window for Home, All Skribs, Calendar and the guide. Native Library HWND removed; import/export responses now target the shared workspace. Library search and selection survive navigation.
- Closing the workspace hides it to the tray; it no longer opens another window. Reopening the app restores the current workspace.
- Rail and dot accept a normal click or a deliberate drag on the same control. Drag does not also trigger opening. Keyboard activation remains available.
- Magnetic rail docking waits for mouse release instead of snapping during a pause in a drag.
- Enlarged notes retain their saved geometry rather than switching to the temporary centered workspace placement on parent-window movement.
- Rail typography and action targets are larger, with a hover/focus Open here affordance, explicit location action, and in-progress feedback. Duplicate opening/resize requests are guarded.
- Color choices occupy their own row instead of overlapping the toolbar. Escape first dismisses the active tool; it does not immediately close the whole note. Unsaved drawings and ongoing saves still block dismissal.
- Reminder panel has a clear close control; compact calendar days fit their columns. Manual note-size cycling closes the large tool rather than squeezing it into the small surface.
- Reduced note footer clutter: persistent save status, circular Trash action, and Done. Character limit appears visually only near its limit and remains available to assistive technology.
- Larger Home navigation and descriptive text. Background library refresh retains existing content and discards stale results.

## Verification and remaining acceptance

Local TypeScript, frontend tests, native tests, production frontend build and repository contracts passed during implementation. The Windows installer pipeline repeats these checks against the exact release commit.

The user reclaimed their computer after the initial capture. No updated installed-app walkthrough or DPI visual acceptance is claimed. Owner acceptance remains open for: opening and closing the shared workspace, keyboard navigation, reminder scrolling at 100/125/150% scaling, moving both collapsed and expanded surfaces, note persistence, and switching between Open here / Open at saved location.

Saved locations still use process/window-title matching; arbitrary closed browser tabs, Explorer folders and editor locations cannot be reconstructed reliably because those deep links were never stored. Unsigned installer SmartScreen reputation is also not resolved by UI changes. Payments and licensing rollout remain out of this refinement scope.

## Installer evidence

- Windows build [33901899825](https://github.com/Ankit6149/skribly/actions/runs/33901899825) succeeded against `d04505a47914191f88c16304a9242afb242c6d72`.
- Owner installer: `Skribli_0.1.16_x64-setup.exe`, 3,476,189 bytes.
- SHA-256: `ac350d398a4deed868bb75d92eb8a74e4f4c4cc80ce511bbada8a1e95c8e9e96`.
- Package identity, application/installer icon matching and installed shortcut target checks passed. Interactive startup smoke was explicitly skipped by CI because its Windows session was noninteractive; this is not native visual acceptance.
- Delivery remains the existing encrypted owner-key download, not a user-facing ZIP. No account reset or local data deletion is part of this upgrade.

## Design acceptance boundary

The owner clarified that only Interface Lab image, file and video attachment designs were accepted. Other Lab experiments were rejected and are not the desktop design specification. Existing Lab files from parallel repository work were preserved, not adopted as approved product layouts. This refinement does not claim new attachment-design integration.
