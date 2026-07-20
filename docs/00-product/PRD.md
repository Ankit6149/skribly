# Product requirements document

**Product:** Skribly  
**Status:** Definition / technical spike  
**Platforms:** Windows and macOS  
**Distribution:** Direct installers first; store listings optional  
**Business model:** One-time lifetime purchase, with an early-access tier

## 1. Core job

When a user notices something worth remembering inside an app, webpage, file, folder, or screen location, Skribly must let them capture it immediately and restore it automatically when the relevant context returns.

## 2. Core objects

A contextual annotation is called a **Skrib**.

Initial Skrib types:

1. typed note
2. handwritten/ink note
3. highlight
4. arrow
5. pin/label
6. checklist
7. reminder

## 3. Creation flow

1. User invokes the global shortcut or tray action.
2. Skribly enters placement mode and reveals a compact tool palette.
3. User selects a tool and places it over the current app/window.
4. User types, draws, or configures the Skrib.
5. Skribly derives and stores context automatically.
6. Clicking outside commits the Skrib; no explicit Save button is required.

## 4. Context behavior

- Whole-window anchoring must work before fine-grained anchors.
- A Skrib follows its target window when moved or resized.
- A Skrib hides when the target minimizes, closes, or leaves its matching context.
- A Skrib restores when the context returns.
- If confidence is low after layout changes, Skribly presents a re-anchor flow rather than pretending the match is exact.
- Website element anchoring is provided later through a browser extension.

## 5. Editing behavior

A Skrib can be:

- selected
- typed into or inked on
- dragged
- resized
- recolored
- collapsed
- locked
- re-anchored
- archived
- deleted through a reversible trash state

## 6. Library

“All Skribs” is a recovery and search surface, not the primary workflow. It provides:

- full-text search
- filters by app, date, type, reminder, status, and context
- preview and jump-to-context
- archived/trash recovery
- local export and backup

## 7. Touch and pen

- Use Pointer Events in the shared UI.
- Support mouse, touch, stylus, pressure, and tilt where available.
- Touch mode increases target sizes.
- Ink strokes remain editable vector-like data; do not store only flattened screenshots.

## 8. Privacy

- v1 stores data locally.
- no account or cloud requirement
- no screenshot capture
- no OCR
- no keystroke content collection
- Accessibility permission is used only for context/window identification
- no network activity except explicit update checks

## 9. Quality requirements

- idle CPU approximately zero when windows are static
- no permanent animation loops
- instant note editing and local saving
- multi-monitor and mixed-DPI support
- recover safely from app crashes
- signed installers before broad public launch
- clear permission onboarding on macOS

## 10. Monetization

Planned initial offer:

- private/free tester build
- paid early-access lifetime licence
- final pricing to be validated through demand and support cost

No subscription is required for local v1. Future paid cloud sync must remain optional.
