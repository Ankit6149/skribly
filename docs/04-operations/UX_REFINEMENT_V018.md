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
