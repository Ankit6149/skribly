# Windows target-capture acceptance

## Purpose

This runbook validates the fail-closed shortcut-capture slice implemented for issue 109. It covers the moment between pressing **Ctrl + Shift + Space** and opening or creating a contextual note.

The automated implementation prevents a failed foreground lookup, stale active target, destroyed HWND, or recycled HWND from silently opening the wrong note. Parent issue 18 remains open for the durable versioned context schema, application-specific identity strategies, ambiguity and re-anchor UX, elevated-process policy, migration, and exact release-candidate evidence.

## Implemented contract

For every shortcut invocation Skribli must:

1. clear the previous runtime active target and WinEvent callback target;
2. capture the current foreground HWND once;
3. reject Skribli itself, desktop/taskbar/system surfaces, hidden or destroyed windows, minimized windows, empty process identity, and invalid bounds;
4. pair the HWND with its owning Windows process identifier and a monotonic capture sequence;
5. revalidate foreground ownership, HWND existence, process identifier, process name, class name, visibility, minimized state, and bounds before placement or note access;
6. stop without creating, reopening, moving, or focusing a note when any check fails;
7. show one privacy-safe actionable recovery surface when no composer or storage-recovery surface is active;
8. set the active target only after safe placement succeeds;
9. preserve an already-open draft rather than replacing it with the capture error surface.

## Automated evidence

The Windows Rust suite covers:

- accepted normal application candidate;
- Skribli/self rejection;
- taskbar/system-surface rejection;
- hidden/destroyed window rejection;
- minimized window rejection;
- empty process identity rejection;
- invalid bounds rejection;
- process-ID, process-name, and class-name mismatch detection;
- privacy-safe actionable message coverage.

The frontend suite covers the visible decision hierarchy for every typed capture failure.

The product-truth validator rejects:

- the former `get_foreground_target_window().or_else(|| coordinator_hk.get_active_target())` fallback;
- a shortcut path that does not clear runtime target state before capture;
- missing capture/revalidation calls;
- missing typed error and clear events;
- missing capture-error UI files;
- documentation that claims parent issue 18 is complete.

## Physical Windows matrix

Record exact commit, build type, binary SHA-256, Windows version/build, integrity level, display topology, scaling, target application, and result.

### Supported application baseline

- Notepad with a saved document;
- Notepad with an unsaved document;
- File Explorer normal folder window;
- a Chromium browser normal tab;
- Visual Studio Code normal editor window;
- Office-like document application when available;
- packaged/UWP application when available.

Expected: one compact editor appears for the exact foreground window; the prior target is never reused.

### Unsupported and system surfaces

- desktop (`Progman`/`WorkerW`);
- primary and secondary taskbars;
- Start menu and transient shell surfaces;
- Skribli’s own composer or recovery surface;
- a protected or inaccessible process;
- an elevated application while Skribli is unelevated;
- a tiny/tool window below the supported bounds;
- a minimized target.

Expected: no note mutation or reopen; one visible actionable message where Windows permits Skribli to present it.

### Rapid-change and stale-handle cases

- press the shortcut and immediately Alt+Tab;
- press the shortcut while the foreground app is closing;
- repeatedly open/close windows to encourage HWND reuse;
- switch between two windows owned by the same process;
- switch between two applications with identical document titles;
- disconnect/reconnect a display during capture;
- lock/unlock the session;
- suspend/resume before retrying.

Expected: foreground or identity changes fail closed. No note from the previous app appears.

### Existing-draft safety

- open a note and type an unsaved draft;
- press the shortcut while Skribli itself is focused;
- press the shortcut while a system surface is foreground;
- dismiss any subsequent message and return to the draft.

Expected: the composer remains the dominant surface and the draft is unchanged.

## Evidence requirements

For each failure case capture:

- typed error code;
- user-visible message screenshot;
- note count and revision before/after;
- active-target state before/after;
- confirmation that no prior-context note appeared;
- process/thread/handle observations when testing repeated rapid cases.

Do not record private document titles, full paths, note content, or raw process command lines in public evidence.

## Completion boundary

Issue 109 may close after implementation, automated gates, and this runbook are merged. Parent issue 18 remains open until durable context identity and the full physical release-candidate matrix are complete.
