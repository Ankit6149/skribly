# Compact note window design

Skribli uses one compact, borderless note window rather than a transparent desktop-sized overlay.

## Interaction

1. Focus the application where the note belongs.
2. Press `Ctrl + Shift + Space`.
3. Skribli captures that application before showing itself.
4. A single note editor opens near the upper-right area of the target window.
5. Type remains compact; Draw, Files, and Reminder can open a bounded larger workspace without covering the desktop.
6. `Done`, the close button, or `Esc` saves the latest typed draft and collapses the active editor into a movable pastel dot.
7. Clicking the dot restores that note at its saved on-screen position; the shortcut also restores it without losing content.
8. **Move to Trash** confirms the ordinary delete action and hides the active note.

## Safety constraints

- The Skribli window must never cover the virtual desktop.
- The active note may remain as one compact dot. No empty transparent editor shell or desktop-sized surface remains visible.
- The editor and dot share one native window in this release, so only the current contextual note is shown on screen at once.
- Editor and dot positions persist target-relative coordinates and clamp to the target monitor's usable work area after monitor/DPI changes.
- The whole compact window is interactive; native selective hit testing is not used for the note editor.
- Windows builds use the GUI subsystem in both development and packaged binaries so no console window appears.
- The system tray remains the only persistent surface and provides explicit show, hide, and quit controls.

## UI direction

- New notes rotate through the exact website yellow, peach, mint, sky, and lavender pastels; the user may choose any of those five colours.
- The Type view stays compact. Draw, Files, and Reminder use a moderate editor workspace with responsive overflow instead of squeezing controls.
- Natural handwritten font for note content only.
- Clean system font for context, labels, and controls.
- Scrollbars use the website-aligned track, thumb, hover, and corner tokens across all scrollable editor/library surfaces.
- Clear hierarchy: context, writing area, destructive action, primary completion action.
- No modal backdrop and no application picker.

## Rich-content boundary

- Pen, highlighter, eraser, approved local attachments, and one-time reminders persist in WebView IndexedDB.
- The linked calendar shows local reminder state and Windows notifications are permission-gated and best effort while Skribli is running.
- Native portable JSON export/import currently covers the Rust-owned note record only; it does not yet carry drawing strokes, attachment blobs, or reminders.
- Recurring reminders, cloud sync, payments, and multiple simultaneous independent note dots are outside this Windows v0 design.
