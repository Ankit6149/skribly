# v0.1.18 — resizable notes, calm calendar, and visual attachments

## Owner acceptance scope

- Note corners start the real Windows resize interaction and save the resulting width and height.
- Manual resizing keeps the rounded native note silhouette aligned with the final window size.
- Preset size changes use a short eased native transition instead of jumping between rectangles.
- Opening Calendar from a compact note grows the same note to the medium 640 × 600 surface.
- Calendar stays in a two-column month-and-time layout at medium size and scrolls safely on smaller displays.
- Opening and closing the Calendar uses restrained transitions with reduced-motion support.
- The top command bar no longer contains an attachment button; attachments remain available in the writing area.
- Photos, videos, and documents use the accepted Interface Lab object language: photo stacks, framed video, and clipped paper with actions on hover or focus.

## Regression protection

- The compact-surface validator checks native resize configuration, permission, resize handles, and the call into the Windows resize API.
- Frontend type checking, the production build, interface tests, native tests, theme validation, compact-surface validation, and installer-candidate validation must pass before packaging.

## Visual verification boundary

The production implementation follows the accepted local Interface Lab source files. The Windows Computer Use helper is unavailable in this task (`failed to write kernel assets`), so no new installed-app screenshot is presented as evidence. Final visual acceptance remains the owner's installer test.

## Installer delivery

- Exact application commit: `51394da2157c1dc919fd38666bc39acecd6366ba`.
- GitHub Actions run: `33978661199`; artifact: `skribli-private-test-33978661199` (`9973246716`).
- Owner installer: `Skribli_0.1.18_x64-setup.exe`, 3,479,740 bytes.
- Installer SHA-256: `be80ce6df316562713b6e4fd59907ad8585e08e207fca25125c6be38f5e6414f`.
- Encrypted website asset SHA-256: `3e5218721737128ac9dc501d872d63690d7f669d0e7fe99fdf19961ab0c90a47`.
