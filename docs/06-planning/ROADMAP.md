# Roadmap

## Phase 0 — repository and product truth

- [x] product vision
- [x] selected visual direction
- [x] component inventory
- [x] provisional architecture
- [x] business/tax working notes
- [ ] make GitHub repository private
- [x] push the working scaffold

## Phase 1 — Windows overlay technical spike

No database, browser extension, payments, AI, or full library UI.

### Implemented in code

- [x] transparent always-on-top Windows overlay foundation
- [x] real Win32 global shortcut registration and native event delivery
- [x] native hit-test rectangle pipeline
- [x] WinEvent-based target-window observation
- [x] numeric HWND handling and Win32 process-handle cleanup
- [x] same-session context reconnection and ambiguity handling foundation
- [x] canonical physical-screen to overlay-client coordinate protocol
- [x] negative virtual-desktop origin and uniform-DPI coordinate tests
- [x] local drag and resize preview with one native persistence call on release
- [x] idempotent Tauri event-listener initialization

### Required runtime acceptance before Phase 1 is closed

- [ ] verify Ctrl+Shift+Space while Notepad has focus on the latest commit
- [ ] verify clicks pass through empty overlay space into an external process
- [ ] verify note controls remain interactive immediately after click-through
- [ ] verify target movement, resize, minimize, restore, close, and same-session reopen
- [ ] verify overlay HWND bounds match Windows virtual-screen bounds at runtime
- [ ] capture CPU, memory, handle-count, and thread-count evidence with the committed script
- [ ] attach a short screen recording from the exact tested commit
- [ ] verify the latest frontend, cargo-fmt, and windows-rust CI jobs
- [ ] make a Windows go/no-go decision from evidence rather than implementation claims

### Explicit Phase 1 limitations

- mixed-DPI multi-monitor behavior remains experimental
- physical second-monitor behavior is not accepted without hardware testing
- `HTTRANSPARENT` is not considered proven cross-process click-through until observed with another application
- macOS overlay behavior has not been implemented or tested

## Phase 2 — durable local Windows MVP

- [ ] SQLite schema and migrations
- [ ] persist Skribs across application restarts
- [ ] durable create/edit/delete typed Skribs
- [ ] tray menu and background lifecycle
- [x] global shortcut foundation
- [ ] whole-window anchoring hardening
- [x] collapse and color prototype
- [ ] lock note interaction
- [ ] crash recovery
- [ ] All Skribs recovery and search panel
- [ ] local export and backup
- [ ] first-run onboarding

## Phase 3 — expressive annotations

- [ ] pen and stylus ink
- [ ] highlighter
- [ ] arrows and shapes
- [ ] checklists
- [ ] reminders and notifications
- [ ] touch mode
- [ ] re-anchor flow

## Phase 4 — browser precision

- [ ] Chromium extension
- [ ] URL context
- [ ] DOM element selection
- [ ] scroll tracking
- [ ] selector fallbacks
- [ ] local secure desktop bridge

## Phase 5 — commercial Windows beta

- [ ] unsigned internal Windows installer
- [ ] signed public Windows installer
- [ ] licence and checkout decision
- [ ] privacy, terms, and refund documents
- [ ] CA review
- [ ] onboarding and update system
- [ ] crash-reporting decision
- [ ] 10–20 person Windows tester cohort
- [ ] Founder Early Access launch

## Later

- signed and notarized macOS build
- cloud sync
- collaboration
- mobile
- AI
- OCR
- marketplace
