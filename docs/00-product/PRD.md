# Product requirements document

> **Status: long-term product vision, not the current release contract.**  
> The current Windows MVP behavior and release sequence are defined by [issue #34](https://github.com/Ankit6149/skribly/issues/34), [issue #20](https://github.com/Ankit6149/skribly/issues/20), and the [product backlog/contribution map](../06-planning/PRODUCT_BACKLOG_AND_CONTRIBUTION_MAP.md).  
> Further annotations, browser integration, macOS, revision history, and sync are tracked under [issue #46](https://github.com/Ankit6149/skribly/issues/46) and must not be treated as implemented or approved release scope.

**Product:** Skribli  
**Current release target:** account-connected, local-content Windows contextual Skribs with typing, drawing, local attachments, and one-time reminders
**Future platforms/capabilities:** separate gated roadmaps  
**Distribution:** direct installer after signed release and runtime acceptance  
**Business model:** one server-owned seven-day free trial for each account/device; payments remain deferred

## 1. Core job

When a user notices something worth remembering inside an application, webpage, file, folder, or screen context, Skribli should let them capture it quickly and restore it safely when the intended context returns.

For the current Windows MVP, an active contextual Skrib can contain typed text, editable drawing strokes, approved local attachments, and a one-time local reminder. It is edited through a compact window that can temporarily expand for richer tools, collapse to one movable dot, and be recovered through a non-floating library and calendar surface. This implementation slice must not redefine the product as merely a notes app.

## 2. Current Windows MVP objects

The supported contextual Skrib has two coordinated local persistence parts:

- Rust-owned typed text, colour, context, position, and lifecycle metadata in the authoritative versioned JSON store;
- WebView-owned editable pen/highlighter/eraser strokes, approved image/video/document attachments, and one-time reminder state in local IndexedDB.

Each newly created Skrib rotates through the website's exact yellow, peach, mint, sky, and lavender pastels. The user can change the active Skrib to any of those five colours. Only one native editor or collapsed dot can be active on screen at a time in this release; the library still preserves all saved records.

Arrows, shapes, pins, labels, checklists, recurring reminders, screenshot pins, and richer screen/application/page/file/folder contexts require separate acceptance work.

The exact fields, one-versus-many behavior, create/open semantics, close behavior, archive/trash rules, and context identity are decided and implemented through #20, #14, #18, #21, and #60 where applicable.

## 3. Current creation flow

The current intended flow is:

1. The user focuses the application where the thought belongs.
2. The user invokes the configured global shortcut.
3. Skribli captures a supported foreground context before taking focus.
4. A compact editor opens near the target on the correct display.
5. The user types, draws with a touchpad/touch/pen, attaches an approved local file, or schedules one reminder. Drawing, Files, and Reminder use a bounded expanded workspace rather than a full-screen surface.
6. New notes receive the next pastel in the five-colour rotation, and the user can choose another approved pastel.
7. The application reports truthful saving/saved/error state for the Rust-owned note record and clear local feedback for rich content.
8. Done/Close/Escape collapses the editor to a movable dot only after the latest typed draft is durable, or keeps it open with recovery when native persistence fails.
9. Clicking or moving the dot restores or repositions the same active Skrib; editor and dot positions persist and are clamped to the target monitor's work area.
10. The user can later recover every note through the non-floating All Skribs library, with linked reminders also visible in its local calendar.

This flow must not require a permanently interactive full-screen overlay. The current release may keep the one active contextual note visible as a compact movable dot.

## 4. Current context behavior

- Whole-application/window/document-context matching is hardened before browser-element anchoring.
- Context capture fails closed for unsupported or ambiguous targets.
- Confidence and recovery are visible rather than hidden.
- A stale previous target is never silently reused.
- Re-anchor, move, detach, and context-rule management are tracked under #61.
- Sensitive-context exclusions and privacy-lock behavior are tracked under #84.
- Browser URL/DOM anchoring is deferred to #67.

## 5. Current editing and lifecycle behavior

The implemented Windows foundation creates one note for zero active context matches, reopens the deterministic existing match, serializes/coalesces draft writes, flushes before collapse, and moves saved notes into reversible Trash. A note that has drawing, attachments, or a reminder is retained even when its typed text is empty. Restore preserves the same native record; permanent deletion exists only inside Trash after note-specific confirmation and initiates local rich-content/reminder cleanup.

Parent #20 remains open for archive, broader context/lifecycle consistency, supported-field and appearance decisions, Settings/privacy entry points, usability evidence, and exact release-candidate validation.

Persistent note revision history and cross-session undo/redo are deferred to #83. The MVP must remain architecturally compatible with bounded future history but does not need to ship it.

## 6. All Skribs library and backups

The implemented library is one normal non-floating recovery surface opened from the tray. It provides deterministic ordering, Unicode-normalized search across current fields, rich-content summaries, Notes and Trash views, a one-time-reminder calendar and agenda, reversible restore, selected/all portable export, and strict import preview with duplicate/conflict handling, rollback backup, and atomic apply.

The native versioned JSON export/import currently covers the Rust-owned Skrib record only. Editable ink, attachment blobs, and reminder state remain in IndexedDB and are **not yet included in portable JSON export/import**. Remaining #21/#61/#79 work includes rich-content/reminder portability, context-safe open/re-anchor, archive, richer filters, scalable indexing/index recovery, and physical release-candidate evidence.

Internal crash-recovery generations are owned by #14. Verified user-controlled backups, restore preview, retention, and clean-device disaster recovery are owned by #82. Portable export, internal recovery, and recurring backup must remain distinct concepts in product copy and implementation.

## 7. Privacy and trust baseline

- a verified account is mandatory for trial and write access;
- existing local Skrib content remains readable and exportable after sign-out, temporary connectivity loss, or trial expiry;
- changing accounts or reinstalling on the same Windows device does not restart its server-owned trial;
- the account service stores only identity, entitlement/trial, a one-way device claim, app version, and explicit update preference—never Skrib content;
- no screenshot capture, OCR, or keystroke-content collection in the Windows MVP;
- context/window metadata is minimized and used only for approved matching behavior;
- no undeclared network activity; account and entitlement traffic is declared and isolated behind a replaceable service adapter;
- update, licence, extension, feedback, and future sync traffic must appear in the canonical network/capability registry;
- diagnostics exclude note content and sensitive context data by default;
- permissions and data locations are visible through #80;
- users can quickly hide visible note content, and screen-sharing/capture limitations are explained truthfully through #84;
- local storage is not described as encrypted unless a separately reviewed encryption feature actually provides it.

## 8. Quality and compatibility requirements

- no silent data loss under interrupted writes;
- one process, tray icon, hotkey, and hook set per user session;
- exact final text is durable before close;
- internal recovery and user backups pass forced-failure and clean-device restore evidence;
- idle CPU and memory remain within #76 budgets;
- multi-monitor and mixed-DPI behavior passes #19/#24 evidence;
- keyboard, screen-reader, high-contrast, reduced-motion, and text-scaling flows pass #31;
- install, repair, upgrade, uninstall, update, rollback, and recovery preserve data exactly as documented;
- supported Windows versions, architectures, hardware tiers, runtimes, applications, RDP/VM behavior, and known limitations are defined and evidence-backed through #85;
- signed reproducible installers before public distribution.

## 9. Current expressive tools and remaining limits

The current Windows v0 includes:

- editable pen and highlighter strokes plus an eraser, usable with mouse, touchpad, touch, or pen input;
- approved local image, video, and document attachments with per-file/per-note limits and local previews where supported;
- one-time local reminders, upcoming/overdue/completed/dismissed states, a linked month calendar and agenda, and Windows notifications when operating-system permission is available;
- website-aligned yellow, peach, mint, sky, and lavender note colours plus themed scrollbars and Kalam for handwritten note content.

The current expressive data remains local to the installed WebView profile and is not yet part of native portable JSON export/import. Only one native contextual editor or dot can be visible at a time. Recurring reminders, cloud scheduling, arrows, shapes, pins, labels, checklists, screenshot capture, local revision history/cross-session undo-redo, and browser URL/DOM anchoring remain deferred. No expressive tool may reintroduce a screen-blocking global overlay.

## 10. Deferred platforms and services

- macOS is tracked by #68 and is not currently implemented.
- Optional end-to-end encrypted sync is research under #69.
- Cloud sync, collaboration, mobile, AI, OCR, plugins, and a marketplace require separate approved issue sets.

## 11. Commercial status

Public downloads and payments remain disabled until the relevant #34 gates pass.

A one-time purchase, paid updates, Merchant of Record, store distribution, and self-managed checkout remain business decisions rather than current promises. Account/device trial enforcement is current under #28; payment entitlement remains tracked by #27 and must not be implemented ahead of product readiness.
