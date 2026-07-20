# Complete UI component inventory

This inventory prevents coding agents from reducing Skribly to a single yellow textarea.

## A. Overlay surfaces

- transparent per-context overlay host
- placement-mode dimmer
- click-through background regions
- active drawing surface
- anchor and snap guides
- context lost/degraded indicator

## B. Floating creation tools

- quick tool palette
- Note tool
- Pen tool
- Highlighter tool
- Arrow tool
- Pin tool
- Checklist tool
- Reminder tool
- Eraser tool
- palette drag handle
- current-tool indicator
- pen color and width popover
- undo/redo controls

## C. Skrib states

- default
- hover
- selected
- editing
- drawing
- dragging
- resizing
- collapsed
- locked
- pinned
- reminder upcoming
- reminder overdue
- read-only/degraded context
- archived
- trash pending

## D. Typed note internals

- optional title
- rich plain-text body (v1 should avoid a complex document editor)
- checklist rows
- reminder chip
- context chip
- color picker
- pin/unpin
- collapse/expand
- lock/unlock
- more menu
- archive
- delete
- resize affordance

## E. Ink note internals

- Canvas layer
- live stroke preview
- pressure-aware pen
- translucent highlighter
- eraser
- lasso/select (later)
- undo/redo
- stroke color
- stroke width
- clear canvas confirmation

## F. Structured annotation objects

- arrow with endpoints
- rectangle/circle highlight
- freeform highlight stroke
- small pin/label
- “continue here” marker
- warning label
- countdown/reminder marker

## G. Context controls

- current app/window chip
- URL/document chip
- anchor confidence state
- re-anchor action
- attach to whole window
- attach to element (browser extension)
- detach and make desktop-local
- move to another context

## H. Drag and re-anchor

- drag ghost
- original-context placeholder
- target snap outline
- accepted/rejected target state
- drop confirmation animation
- “things moved” dialog
- suggested matches
- manual point picker
- always use this rule toggle

## I. All Skribs library

- search input
- filters: app, date, type, reminder, archived, trash
- context grouping
- grid/list modes
- compact preview
- open context
- edit
- archive/restore
- export
- local backup status
- empty, loading, and error states

## J. Reminder UI

- quick options
- date picker
- time picker
- recurrence (later)
- notification preview
- overdue state
- snooze
- complete/dismiss

## K. System UI

- tray icon
- tray menu
- pause Skribly globally
- pause on current app
- reveal all Skribs shortcut
- lock all Skribs
- update indicator
- quit action

## L. Settings

- General
- Appearance
- Hotkeys
- Behavior
- Touch & Pen
- Privacy
- Backups
- Updates
- About

Settings include startup, shortcut editor, theme, touch mode, topmost behavior, fullscreen pause, local backup schedule, update channel, permission status, data-folder access, export, and reset.

## M. Onboarding and permissions

- value demonstration
- “Add a Skrib” shortcut tutorial
- interactive first placement
- macOS Accessibility explanation
- browser extension optional step
- privacy promise
- skip and revisit

## N. Failure and recovery

- database migration failure
- corrupt local file recovery
- inaccessible target app
- lost anchor
- unsupported fullscreen app
- hotkey conflict
- permission revoked
- extension disconnected
- update failed
- crash recovery draft
