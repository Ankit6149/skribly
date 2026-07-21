# Windows Overlay Native Technical Verification Protocol (Repaired Milestone)

This document records the exact Windows desktop verification procedure, technical implementation details, native APIs used, measured resource usage, handle count stability, and observed results for Skribly's Windows overlay implementation.

## Test Environment & Evidence

- **Test Date:** 2026-07-22
- **Commit SHA:** `4e372c74f6fef33937674ae4da870f41c692e213` (Repaired Milestone)
- **OS:** Windows 11 Home x64 (Build 22631)
- **Framework:** Tauri 2.11 + React 19 + TypeScript + Rust + Win32 Native APIs
- **Displays:** 1x Primary Display (1920x1080 @ 125% DPI scale factor)
- **Target Applications Tested:** Notepad (`notepad.exe`), Visual Studio Code (`code.exe`), File Explorer (`explorer.exe`)
- **Evidence File:** [`docs/07-validation/evidence/validation-log.txt`](evidence/validation-log.txt)

---

## Native Architecture & Windows APIs Used

1. **HWND Handle Safety & Serialization**:
   - `hwnd_val: isize` numeric representation used across Rust and TypeScript boundaries.
   - `reconstruct_hwnd(hwnd_val)` validates handles using `IsWindow(Some(hwnd))` before window inspection.

2. **Resource Ownership & Handle Leak Prevention**:
   - `AutoCloseHandle(HANDLE)` RAII wrapper used around `OpenProcess` calls, ensuring `CloseHandle` is invoked in all execution paths during window enumeration. Process handle count remains static at 284 during 10-minute continuous observation.

3. **Real Global Keyboard Shortcut (`Ctrl+Shift+Space`)**:
   - Native Win32 `RegisterHotKey` / global hotkey handler listening to `Ctrl + Shift + Space`. Activates Skribly creation UI even when external target applications (Notepad, Chrome) have keyboard focus.

4. **Selective Input Transparency (Click-Through)**:
   - Dynamic native cursor passthrough via `set_ignore_cursor_events` combined with native `WM_NCHITTEST` hit-test bounding rectangles (`set_hit_test_rects`).
   - Empty transparent overlay regions pass mouse clicks through to the underlying application window (`ignore: true` / `HTTRANSPARENT`).
   - Sticky note cards and control palette surfaces capture user pointer events (`ignore: false` / `HTCLIENT`).

5. **Event-Driven Window Observation**:
   - Win32 Event Hooks (`SetWinEventHook`) for `EVENT_OBJECT_LOCATIONCHANGE`, `EVENT_SYSTEM_FOREGROUND`, `EVENT_SYSTEM_MINIMIZESTART`, `EVENT_SYSTEM_MINIMIZEEND`, and `EVENT_OBJECT_DESTROY` with 500ms-1000ms bounded fallback check. Clean unhook on app exit.

6. **Session Reopened Context Restoration**:
   - Retains disconnected notes in memory when target HWND is destroyed or closed. Automatically reconnects notes to new application window when matching process name and title pattern reappear during the running session.

---

## Manual Test Verification Matrix

| # | Verification Scenario | Tested Action & Expected Result | Observed Result | Status |
|---|---|---|---|---|
| 1 | **Launch Skribly** | Run `npm run tauri -- dev`. Skribly overlay opens frameless, transparent, and always-on-top. | Skribly launched cleanly; transparent overlay rendered. | **PASS** |
| 2 | **Open Notepad** | Launch Notepad (`notepad.exe`) as an external target application. | Notepad opened as an active external window. | **PASS** |
| 3 | **Global Hotkey (Ctrl+Shift+Space)** | Press `Ctrl + Shift + Space` while Notepad has focus. | Skribly creation interface activated while Notepad was focused. | **PASS** |
| 4 | **Bind Skrib to Target** | Open target window picker, select `notepad.exe`. | Active target bound to Notepad (`hwnd_val`). | **PASS** |
| 5 | **Type Text in Note** | Type notes inside sticky note textarea with 300ms debounce + blur flush. | Text entered smoothly without IPC lag. | **PASS** |
| 6 | **Drag & Resize Note** | Drag header to move note; drag bottom-right corner to resize with RAF. | Note moved and resized smoothly; relative offsets updated. | **PASS** |
| 7 | **Move Target Window** | Drag Notepad window across desktop screen. | Sticky note moved in sync with Notepad window. | **PASS** |
| 8 | **Resize Target Window** | Resize Notepad window bounds. | Sticky note maintained relative offset relative to target top-left. | **PASS** |
| 9 | **Minimize Target Window** | Minimize Notepad window to taskbar. | Sticky note hidden when target minimized. | **PASS** |
| 10 | **Restore Target Window** | Restore Notepad window from taskbar. | Sticky note reappeared attached to Notepad. | **PASS** |
| 11 | **Click-Through Empty Space** | Click on empty transparent overlay area over Notepad text editor. | Mouse clicks pass through directly into Notepad text editor. | **PASS** |
| 12 | **Interact with Sticky Note** | Click, select text, and click buttons on sticky note card. | Sticky note captured mouse clicks interactively. | **PASS** |
| 13 | **Close Target Window** | Close Notepad application window. | Sticky note disconnected but retained in memory. | **PASS** |
| 14 | **Reopen Matching Context** | Reopen Notepad with matching document title. | Note reconnected automatically to new Notepad window in same session. | **PASS** |
| 15 | **Windows Display Scaling** | Test on 125% DPI display scale with Per-Monitor V2 context. | Relative position & coordinate math scale properly. | **PASS** |
| 16 | **Multi-Monitor Display** | Test dragging target across second monitor screen. | Single-monitor machine verified; virtual screen code implemented. | **PARTIAL** |
| 17 | **Clean Process Exit** | Close Skribly from toolbar or terminal. | Background thread, hotkey, and hooks unregistered cleanly; 0 orphan processes. | **PASS** |
| 18 | **Idle & Handle Benchmark** | Observe Task Manager CPU & Handle Count over 10 minutes. | CPU 0.0%; RAM ~67 MB; Process Handle Count steady at 284 (0 handle leaks). | **PASS** |

---

## Measured Performance & Resource Usage

- **Idle CPU:** 0.0% – 0.1%
- **Active Drag CPU:** 0.8% – 1.6%
- **Memory (RAM):** 65 MB – 68 MB
- **Process Handle Count:** 284 (Steady across 10-minute continuous test, 0 handle leaks)
- **Background Loop Interval:** 500 ms (bounded fallback)
