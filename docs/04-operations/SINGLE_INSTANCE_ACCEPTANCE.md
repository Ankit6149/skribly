# Single-instance and background lifecycle acceptance

> **Status:** the per-session process guard and second-launch routing are automated in the repository. Parent issue 15 remains open until the physical Windows lifecycle matrix below is executed against an exact release candidate.

## Purpose

This runbook verifies that Skribli creates one process, one tray icon, one global hotkey registration, one WinEvent hook set, and one storage writer per Windows user session. It also verifies that launching Skribli again signals the existing process through the normal shortcut path instead of creating partially initialized duplicate state.

Compilation and unit tests cannot prove process count, tray behavior, installer replacement, session transitions, pending-write shutdown behavior, or long-running native-handle stability.

## Evidence identity

Every completed run must record:

- source commit SHA;
- pull request or release-candidate reference;
- executable or installer SHA-256;
- build channel and version;
- Windows edition, version, build, architecture, and user type;
- exact launch method: executable, Start menu, desktop shortcut, installer, updater, or command line;
- expected result, actual result, pass/fail, reviewer, and date;
- process count, tray-icon count, relevant window count, and handle/thread measurements;
- privacy-safe screenshot, recording, or command-output references.

Do not reuse evidence after changes to startup, storage, tray, native hooks, hotkeys, installer behavior, Tauri, WebView, or Windows support policy.

## Automated contract

The source and Windows test suite must prove:

- the mutex name is explicitly scoped to the local Windows session;
- process matching accepts only current and legacy Skribli executable names;
- the second launch uses the same `WM_HOTKEY` identifier as the registered global shortcut;
- signal discovery has a bounded retry window and cannot wait forever;
- the guard is acquired in `main` before `skribly_lib::run()` starts Tauri;
- the primary process keeps the mutex handle alive for the full runtime;
- the secondary process returns before the Tauri library runtime starts;
- a failed signal produces a visible native startup error rather than duplicate initialization.

## Physical Windows matrix

Run every applicable row on supported Windows 10 and Windows 11 candidates.

| Scenario | Required variations | Pass condition |
| --- | --- | --- |
| Normal first launch | Standard user, clean session | Exactly one process and one tray icon appear; shortcut and notes work. |
| Second launch while hidden | Start menu, shortcut, executable | Existing process receives the launch, opens through the normal note flow, and no second resident process or tray icon remains. |
| Second launch while editor visible | Same target and a different target | Existing editor responds deterministically without duplicate windows, hooks, or storage writers. |
| Rapid repeated launch | 2, 5, 10, and 20 near-simultaneous starts | One process survives; all secondary processes exit; one tray icon and one hotkey remain. |
| Startup race | Launch again immediately after the first executable starts | Secondary waits only within the bounded discovery window and signals the first process once its HWND exists. |
| Signal failure | Simulated inaccessible/stuck first process | Secondary shows an actionable native error and does not continue into app initialization. |
| Standard/elevated boundary | Standard and elevated launch combinations | Behavior is documented and deterministic; no silent second writer starts. |
| Close versus Quit | Close editor repeatedly, then tray Quit | Close hides without ending the process; Quit removes process, tray icon, hotkey, hooks, and mutex. |
| Restart after Quit | Immediate and delayed restart | New primary starts normally with one process and no stale mutex state. |
| Repeated lifecycle | At least 50 start/quit cycles | Process, handle, thread, tray, hotkey, and hook counts return to baseline without cumulative leaks. |
| Sleep/resume | Editor hidden and visible | No duplicate tray icon, hotkey, hook set, or process appears after resume. |
| Lock/unlock | Editor hidden and visible | Existing process remains singular and usable without stale routing. |
| Windows sign-out/shutdown | Clean and pending-note scenarios | Process exits; notes follow the documented durability rule; no partial database replaces the last durable state. |
| Installer upgrade | App hidden and editor visible | Installer/updater stops or coordinates with the one process, replaces files safely, and restarts according to policy. |
| Repair/uninstall | App running and stopped | No orphan process, tray icon, startup entry, hook, or locked binary remains. |

## Core repeated-launch procedure

1. Start the exact candidate build and wait for the tray icon.
2. Record Skribli process, top-level window, handle, and thread counts.
3. Focus a supported target application.
4. Launch Skribli again using the selected matrix method.
5. Confirm the original process opens or repositions the compact editor through the same target-capture path as **Ctrl + Shift + Space**.
6. Confirm the secondary process exits and no second tray icon, hotkey registration, hook set, or storage writer remains.
7. Repeat rapidly and while the editor is already visible.
8. Quit through the tray and confirm all process-owned resources disappear.
9. Start again and verify the mutex did not remain stale.
10. Record exact evidence identity and results.

## Pending-write shutdown procedure

1. Open a note in the exact candidate build.
2. Type a privacy-safe draft and trigger the documented saving state.
3. Exercise normal tray Quit, Windows sign-out, Windows restart, forced process termination, and installer-upgrade paths separately.
4. Reopen Skribli and compare the restored note against the last state that the UI truthfully reported as durable.
5. Verify that no partial or corrupt primary storage file replaced the last valid generation.
6. Record the storage revision, recovery behavior, and exact binary hash without including note content in public evidence.

## Failure handling

A release-blocking failure includes:

- more than one resident Skribli process per user session;
- more than one tray icon, hotkey registration, or WinEvent hook set;
- a secondary process loading or writing storage before exiting;
- a second launch opening a parallel UI path instead of the normal shortcut flow;
- a secondary launch silently failing or remaining resident;
- Quit leaving the mutex, process, tray icon, hotkey, hook, or worker threads alive;
- restart being blocked by stale process state;
- installer replacement requiring Task Manager under normal supported conditions;
- shutdown or upgrade losing text that had been reported as durably saved;
- cumulative handle or thread growth across repeated start/quit cycles.

Keep the relevant issue open, attach exact environment and binary identity, and rerun every affected matrix row after the fix.

## Release gate

Parent issue 15 remains open until the applicable physical rows have reviewed evidence tied to the exact release candidate. This runbook defines the procedure; it is not evidence that the scenarios have already passed.
