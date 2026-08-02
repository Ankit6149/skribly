# Windows event-pipeline acceptance

> **Status:** callback filtering, bounded delivery, duplicate coalescing, counters, and deterministic stress tests are implemented in the repository. Parent issue 17 remains open until the physical Windows idle and event-storm matrix is executed against an exact release candidate.

## Purpose

Skribli listens for a narrow set of Windows accessibility events so the compact editor can follow the intended target and react when that target is focused, moved, minimized, restored, or destroyed. Global hooks must remain lightweight while unrelated applications scroll, animate, play video, expose accessibility trees, or move child objects.

This runbook verifies that event delivery remains bounded, relevant target changes remain prompt, hook installation remains singular, and normal background use stays within documented resource limits.

## Evidence identity

Every completed run must record:

- source commit SHA;
- pull request or release-candidate reference;
- executable or installer SHA-256;
- build channel and version;
- Windows edition, version, build, architecture, and user privilege level;
- CPU, memory, handle, thread, hook, event-counter, and queue-counter measurements;
- target and stress applications used;
- duration, expected result, actual result, pass/fail, reviewer, and date;
- privacy-safe profiler, recording, screenshot, or command-output references.

Do not reuse evidence after changes to native hooks, callback filtering, target identity, queue capacity, consumer behavior, Tauri, WebView, Windows support policy, or build configuration.

## Automated contract

The Windows test suite and product-truth checks must prove:

- callback delivery uses a bounded synchronous channel;
- callback delivery uses non-blocking `try_send` rather than `send`;
- top-level foreground events require object ID 0 and child ID 0;
- location, minimize, restore, and destroy events require the active target HWND;
- unrelated child-object and unrelated-window movement is filtered before queue delivery;
- an equivalent `(event class, HWND)` notice is coalesced while one remains queued or processing;
- queue saturation removes the pending key, increments a counter, and never blocks the native callback;
- a disconnected consumer releases the pending key and increments a counter;
- counters include received, filtered, forwarded, coalesced, saturated, disconnected, processed, pending, and capacity;
- expensive title, process, bounds, and context inspection remains in the consumer thread;
- hook retries return the existing complete hook set instead of installing duplicates;
- synthetic duplicate storms cannot grow pending notices beyond queue capacity.

## Physical Windows matrix

Run applicable rows on supported Windows 10 and Windows 11 candidates.

| Scenario | Required variations | Pass condition |
| --- | --- | --- |
| Quiet desktop idle | 30 minutes, editor hidden | Queue returns to zero, CPU remains near the approved idle budget, and handles/threads/hooks remain stable. |
| Editor-visible idle | 30 minutes with a stationary target | No repeated repositioning, queue growth, or unnecessary target inspection occurs. |
| Browser scrolling | Chromium and Firefox-family browser, smooth and rapid scrolling | Child-object/location storms are filtered; note flow and foreground response remain prompt. |
| Video and animation | Full-screen and windowed video, animated website | Queue remains bounded and background CPU does not scale with unrelated animation events. |
| Target movement | Move and resize the active target continuously | Relevant movement remains responsive; duplicates coalesce; editor stays monitor-safe. |
| Non-target movement | Move/resize several unrelated windows | Non-target location events do not enter the queue. |
| Foreground switching | Rapid Alt+Tab across supported and unsupported apps | Foreground notices remain prompt without stale context binding. |
| Accessibility-heavy app | Screen reader, IDE, Office-like app, tree/grid-heavy UI | Child events are filtered and Skribli stays responsive. |
| Event storm | Synthetic or controlled high-rate WinEvent producer | Pending notices never exceed capacity; saturation/coalescing counters explain discarded duplicates or overflow. |
| Target close/minimize/restore | Hidden and visible editor | Close, minimize, and restore remain prompt despite coalescing. |
| Hook retry | Invoke native initialization retry repeatedly | Exactly one complete hook set remains installed. |
| Sleep/resume | Hidden and visible editor | Hooks and queue resume without duplication or stale pending keys. |
| Lock/unlock | Hidden and visible editor | No duplicate hooks, runaway events, or stranded queue state. |
| Remote Desktop | Connect, resize, disconnect, reconnect | Event counters remain bounded and target updates recover safely. |
| Long session | At least four hours representative work | No monotonic queue, memory, handle, thread, or hook growth. |

## Core measurement procedure

1. Start the exact candidate and confirm one Skribli process and tray icon.
2. Record baseline CPU, working set, private bytes, handles, threads, hooks, and WinEvent counters.
3. Execute the selected matrix scenario for its full duration.
4. Record received, filtered, forwarded, coalesced, saturated, disconnected, processed, pending, and capacity values at defined intervals.
5. Confirm pending returns to zero after the scenario settles.
6. Confirm the global shortcut, target capture, save, close, and reposition flows still work.
7. Confirm hook retry or lifecycle transitions do not create a second hook set.
8. Compare resource measurements against the approved performance budgets and baseline candidate.
9. Attach privacy-safe evidence tied to the exact executable or installer hash.

## Required counter interpretation

- **received** may increase during system activity.
- **filtered** should account for unrelated child objects and non-target movement.
- **forwarded** should remain limited to relevant foreground and active-target notices.
- **coalesced** should increase during duplicate movement storms instead of queue depth growing.
- **saturated** should normally remain zero; any increase requires scenario analysis and responsiveness review.
- **disconnected** must remain zero during a healthy running session.
- **processed** should catch up to forwarded after activity settles.
- **pending** must never exceed capacity and should return to zero.

Counters contain no note text, raw titles, paths, URLs, or other private user content.

## Failure handling

A release-blocking failure includes:

- pending notices exceeding configured capacity;
- any blocking send or unbounded queue in the callback path;
- unrelated child-object or non-target movement entering delivery;
- duplicate equivalent notices growing queue depth;
- foreground, target close, minimize, restore, or movement becoming materially delayed;
- repeated initialization creating duplicate hook sets;
- nonzero disconnected counters during a normal session;
- pending keys remaining permanently after processing or disconnection;
- monotonic memory, handle, thread, or hook growth;
- idle CPU or battery impact exceeding the approved budget;
- counters or diagnostics containing private window or note data.

Keep the relevant issue open, attach exact environment and binary identity, and rerun all affected rows after correction.

## Release gate

Parent issue 17 remains open until the applicable physical rows have reviewed evidence tied to the exact release candidate. This document defines the procedure and expected counters; it is not evidence that the scenarios have already passed.
