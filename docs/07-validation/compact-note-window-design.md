# Compact note window design

Skribli uses one compact, borderless note window rather than a transparent desktop-sized overlay.

## Interaction

1. Focus the application where the note belongs.
2. Press `Ctrl + Shift + Space`.
3. Skribli captures that application before showing itself.
4. A single note editor opens near the upper-right area of the target window.
5. `Done`, the close button, or `Esc` saves the note and hides the Skribli window completely.
6. `Delete` removes the note and hides the window.

## Safety constraints

- The Skribli window must never cover the virtual desktop.
- No saved-note dots, toolbars, widgets, or empty transparent surfaces remain visible after closing.
- The whole compact window is interactive; native selective hit testing is not used for the note editor.
- Windows builds use the GUI subsystem in both development and packaged binaries so no console window appears.
- The system tray remains the only persistent surface and provides explicit show, hide, and quit controls.

## UI direction

- One warm paper card.
- Natural handwritten font for note content only.
- Clean system font for context, labels, and controls.
- Clear hierarchy: context, writing area, destructive action, primary completion action.
- No modal backdrop and no application picker.
