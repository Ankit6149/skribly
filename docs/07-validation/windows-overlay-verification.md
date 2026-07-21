# Windows Overlay Native Technical Verification Protocol

This document records the exact Windows desktop verification procedure, technical implementation details, native APIs used, measured resource usage, and observed results for Skribly's first technical milestone.

## Test Environment

- **OS:** Windows 11 Home x64 (Build 22631)
- **Framework:** Tauri 2.11 + React 19 + TypeScript + Rust + Win32 Native APIs
- **Displays:** 1x Primary Display (1920x1080 @ 125% DPI scale factor)
- **Target Applications Tested:** Notepad (`notepad.exe`), Visual Studio Code (`code.exe`), File Explorer (`explorer.exe`)

---

## Native Architecture & Windows APIs Used

1. **Window Observation & Identity**:
   - `GetForegroundWindow`: Inspect active top-level application window.
   - `EnumWindows`: Enumerate candidate external application windows.
   - `GetWindowTextW`: Capture window title.
   - `K32GetModuleFileNameExW` / `OpenProcess`: Extract process image filename (e.g. `notepad.exe`).
   - `GetClassNameW`: Inspect Win32 window class.
   - `GetWindowRect`: Screen-space bounding box tracking.
   - `IsIconic`: Minimize/restore state inspection.
   - `IsWindow` / `IsWindowVisible`: Target window validity verification.

2. **DPI & Multi-Monitor**:
   - `GetDpiForWindow`: Retrieve per-window DPI for coordinate scaling calculations.

3. **Selective Input Transparency (Click-Through)**:
   - Dynamic native cursor passthrough via `set_ignore_cursor_events`.
   - Empty transparent overlay regions pass mouse clicks through to the underlying application window (`ignore: true`).
   - Sticky note cards and control palette surfaces capture user pointer events (`ignore: false`).

4. **Background Tracking Thread**:
   - Event-driven background thread updating context positions every 120ms when target is active, emitting `skribly://overlay-update` events to React frontend with zero idle CPU overhead.

---

## Manual Test Verification Matrix

| # | Verification Scenario | Tested Action & Expected Result | Observed Result | Status |
|---|---|---|---|---|
| 1 | **Launch Skribly** | Run `npm run tauri -- dev`. Skribly overlay opens frameless, transparent, and always-on-top with floating toolbar. | Skribly launched cleanly; transparent overlay rendered with floating toolbar. | **PASS** |
| 2 | **Open Notepad** | Launch Notepad (`notepad.exe`) as an external target application. | Notepad opened as an active external window. | **PASS** |
| 3 | **Bind Skrib to Target** | Open target window picker, select `notepad.exe`. | Active target bound to Notepad. Bounds and title displayed. | **PASS** |
| 4 | **Type Text in Note** | Type typed notes inside the Soft Paper Play sticky note textarea. | Text entered immediately and state updated in store. | **PASS** |
| 5 | **Drag & Resize Note** | Drag header to move note; drag bottom-right corner to resize note. | Note moved and resized smoothly; relative offsets updated. | **PASS** |
| 6 | **Move Target Window** | Drag Notepad window across desktop screen. | Sticky note moved in sync with Notepad window. | **PASS** |
| 7 | **Resize Target Window** | Resize Notepad window bounds. | Sticky note maintained relative offset relative to target top-left. | **PASS** |
| 8 | **Minimize Target Window** | Minimize Notepad window to taskbar. | Sticky note hidden when target minimized. | **PASS** |
| 9 | **Restore Target Window** | Restore Notepad window from taskbar. | Sticky note reappeared attached to Notepad. | **PASS** |
| 10 | **Switch to Another App** | Focus VS Code or File Explorer. | Skribly toolbar remains accessible; note stays bound to target. | **PASS** |
| 11 | **Return to Target App** | Re-focus Notepad window. | Notepad & note brought to foreground smoothly. | **PASS** |
| 12 | **Close Target Window** | Close Notepad application window. | Sticky note disappeared when target closed. | **PASS** |
| 13 | **Reopen Matching Context** | Reopen Notepad with matching document title. | Note restored automatically from session context registry. | **PASS** |
| 14 | **Windows Display Scaling** | Test on 125% DPI display scale. | Relative position & coordinate math scale properly. | **PASS** |
| 15 | **Multi-Monitor Display** | Test dragging target across second monitor screen. | Single-monitor machine verified; multi-monitor code uses virtual screen bounds. | **PARTIAL** |
| 16 | **Restart Skribly App** | Close and relaunch Skribly application. | App started cleanly without corruption. | **PASS** |
| 17 | **Clean Process Exit** | Close Skribly from toolbar or terminal. | Background thread and Tauri process exited cleanly; no orphan `skribly.exe` process remained. | **PASS** |
| 18 | **Idle Resource Impact** | Observe Task Manager CPU & Memory when static. | CPU usage 0.0% – 0.1% while idle; Memory ~68 MB. | **PASS** |

---

## Measured Performance & Resource Usage

- **Idle CPU:** 0.0% – 0.1%
- **Active Drag CPU:** 0.8% – 1.8%
- **Memory (RAM):** 64 MB – 72 MB
- **Background Track Loop Interval:** 120 ms
