# Interaction specification

## Global shortcut

The final default shortcut must be checked for conflicts on both platforms. Working placeholder:

- Windows: `Ctrl + Shift + Space`
- macOS: `Control + Shift + Space`

Do not use the Windows screenshot shortcut.

## Create

1. Invoke shortcut.
2. Tool palette appears near the pointer.
3. Current target window receives a subtle border.
4. Select a tool or use the default Note.
5. Click/drag to place.
6. The Skrib unfolds.
7. Input begins immediately.
8. Click outside to commit.

## Type

- Single click selects.
- Double click or Enter edits.
- `Ctrl/Cmd + Enter` commits while keeping selection.
- Escape cancels current uncommitted edits or exits edit mode.
- Saving is automatic and debounced.

## Scribble

- Pen/stylus down begins a stroke.
- Mouse works as a fallback.
- Pressure affects width only when hardware reports reliable pressure.
- Highlighter uses translucent compositing.
- Palm rejection relies first on pointer type; platform-specific improvement is optional.
- Raw points are simplified after the stroke, never during input in a way that creates visible lag.

## Drag

- Dragging from the note header moves the Skrib.
- Holding a modifier reveals cross-window snap targets.
- Crossing into a new target previews reattachment.
- Dropping commits the new context only after the target is accepted.
- Escape returns the Skrib to its original context.

## Resize

- Corners resize; edges may be enabled later.
- Typed notes preserve readable minimum width.
- Ink notes scale their viewport without destructively rewriting source points.

## Collapse

- Collapse folds the note into a small colored edge marker.
- Hover previews content.
- Click expands.
- Multiple collapsed markers on one edge stack without overlap.

## Delete

- Delete has a physical peel/slide animation lasting less than 250 ms.
- The item moves to Trash, allowing restoration.
- Permanent deletion happens only from Trash or purge settings.

## Context return

- When the matching app/window appears, Skribly restores relevant overlays without stealing focus.
- A returning Skrib may use one subtle 150–250 ms unfold, then remain static.
- When confidence is weak, show a collapsed warning state rather than overlaying the wrong control.

## Click-through

Default overlay state:

- transparent background passes input through
- visible Skrib surfaces receive input
- drawing mode captures pointer input over the selected drawing region
- pause mode makes the complete overlay input-transparent

This is a release-blocking cross-platform behavior.
