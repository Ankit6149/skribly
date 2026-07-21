# Architecture

```text
React / TypeScript UI
  ├── overlay renderer
  ├── note and ink editors
  ├── library and settings
  └── design system
          │ Tauri commands/events
Rust application core
  ├── context matcher
  ├── overlay coordinator
  ├── storage and migrations
  ├── reminders
  ├── permissions
  └── update coordination
          │
  ┌───────┴────────┐
Windows adapter   macOS adapter
Win32 + UIA       AppKit/AX APIs

Optional Chromium extension
  └── URL and DOM-element anchors
```

## Process model

Prefer one background application process. Create overlay hosts only for visible annotated contexts. Do not create one OS-level window per Skrib.

## Rendering model

- HTML: typed notes, checklists, chips, menus
- Canvas: freehand strokes and highlighter
- SVG: arrows, shapes, anchor guides
- CSS: paper surfaces, shadows, fold effects, transitions

## Persistence

SQLite is the durable source of truth. React state is ephemeral. Rust owns all database access.

Planned tables:

- `skribs`
- `anchors`
- `contexts`
- `ink_strokes`
- `reminders`
- `attachments`
- `settings`
- `migration_history`

## Implementation Status (Windows Overlay Milestone)

The initial Windows technical proof has been fully implemented:
- **Rust Core Coordinator (`apps/desktop/src-tauri/src/core/coordinator.rs`)**: Manages in-memory context matching, active targets, relative coordinate calculations, and context restoration.
- **Win32 Platform Adapter (`apps/desktop/src-tauri/src/platform/windows.rs`)**: Implements `GetForegroundWindow`, `EnumWindows`, `GetWindowTextW`, `K32GetModuleFileNameExW`, `GetWindowRect`, `IsIconic`, `GetDpiForWindow`, and selective cursor passthrough via `set_ignore_cursor_events`.
- **Soft Paper Play UI (`apps/desktop/src/features`)**: React 19 + Zustand overlay host, sticky notes with drag, corner resize, color swatches (yellow, peach, mint, sky, lavender), collapse/expand, and delete.

## Platform boundaries

The shared core must not contain platform conditionals outside a defined adapter layer. Windows and macOS implementations expose the same operations:

- active window
- window identity
- bounds
- movement/focus/minimize events
- accessibility element at point
- overlay hit-test configuration
- permission status

## Browser extension boundary

The browser extension may send only user-directed page identity and anchor information to the local app. It must not become a browsing-history collector.
