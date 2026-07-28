# Product requirements document

> **Status: long-term product vision, not the current release contract.**  
> The current Windows MVP behavior and release sequence are defined by [issue #34](https://github.com/Ankit6149/skribly/issues/34), [issue #20](https://github.com/Ankit6149/skribly/issues/20), and the [product backlog/contribution map](../06-planning/PRODUCT_BACKLOG_AND_CONTRIBUTION_MAP.md).  
> Future annotations, browser integration, macOS, revision history, and sync are tracked under [issue #46](https://github.com/Ankit6149/skribly/issues/46) and must not be treated as implemented or approved release scope.

**Product:** Skribli  
**Current release target:** local-first Windows contextual typed notes  
**Future platforms/capabilities:** separate gated roadmaps  
**Distribution:** direct installer after signed release and runtime acceptance  
**Business model:** undecided until the product and commercial workflows are ready

## 1. Core job

When a user notices something worth remembering inside an application, webpage, file, folder, or screen context, Skribli should let them capture it quickly and restore it safely when the intended context returns.

For the current Windows MVP, this job is limited to typed contextual notes through a compact transient editor and a non-floating recovery/library surface.

## 2. Current Windows MVP objects

The initial supported persistent object is a typed contextual note.

The exact fields, one-versus-many behavior, create/open semantics, close behavior, archive/trash rules, and context identity are decided and implemented through #20, #14, #18, #21, and #60 where applicable.

## 3. Current creation flow

The current intended flow is:

1. The user focuses the application where the thought belongs.
2. The user invokes the configured global shortcut.
3. Skribli captures a supported foreground context before taking focus.
4. A compact editor opens near the target on the correct display.
5. The user types while the application reports truthful saving/saved/error state.
6. Done/Close/Escape hides the editor only after the final draft is durable, or keeps it open with recovery when persistence fails.
7. The user can later recover every note through the non-floating All Skribs library.

This flow must not require a permanently interactive full-screen overlay or persistent floating dots/widgets.

## 4. Current context behavior

- Whole-application/window/document-context matching is hardened before browser-element anchoring.
- Context capture fails closed for unsupported or ambiguous targets.
- Confidence and recovery are visible rather than hidden.
- A stale previous target is never silently reused.
- Re-anchor, move, detach, and context-rule management are tracked under #61.
- Sensitive-context exclusions and privacy-lock behavior are tracked under #84.
- Browser URL/DOM anchoring is deferred to #67.

## 5. Current editing and lifecycle behavior

The final Windows MVP contract is owned by #20. It must define:

- create versus reopen behavior;
- one or multiple notes per context;
- ordering and note switching;
- final-save/close behavior;
- empty-note behavior;
- archive, reversible trash, restore, and permanent deletion;
- supported fields and appearance choices;
- tray, library, Settings, privacy-lock, and recovery entry points.

Persistent note revision history and cross-session undo/redo are deferred to #83. The MVP must remain architecturally compatible with bounded future history but does not need to ship it.

## 6. All Skribs library and backups

The library is a normal non-floating recovery and management surface owned by #21 and #79. It includes, as approved:

- full-text search and filters;
- context-safe open/re-anchor behavior;
- archive and reversible trash;
- versioned export/import;
- read-only access where required;
- accessible keyboard navigation;
- scalable indexing and index recovery.

Internal crash-recovery generations are owned by #14. Verified user-controlled backups, restore preview, retention, and clean-device disaster recovery are owned by #82. Portable export, internal recovery, and recurring backup must remain distinct concepts in product copy and implementation.

## 7. Privacy and trust baseline

- local data remains usable without an account;
- no screenshot capture, OCR, or keystroke-content collection in the Windows MVP;
- context/window metadata is minimized and used only for approved matching behavior;
- no undeclared network activity;
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

## 9. Deferred expressive annotations

The following are long-term possibilities, not current release commitments:

- editable ink and highlighter;
- arrows, shapes, pins, labels, and checklists;
- reminders and notifications;
- secure local attachments;
- touch/pen-specific interaction;
- local revision history and cross-session undo/redo;
- browser URL/DOM anchoring.

They require #60–#67 and #83 and may not reuse the rejected global overlay architecture without a new approved decision.

## 10. Deferred platforms and services

- macOS is tracked by #68 and is not currently implemented.
- Optional end-to-end encrypted sync is research under #69.
- Collaboration, mobile, AI, OCR, plugins, and a marketplace require separate approved issue sets.

## 11. Commercial status

Public downloads and payments remain disabled until the relevant #34 gates pass.

A one-time purchase, paid updates, Merchant of Record, store distribution, self-managed checkout, and licence enforcement remain business decisions rather than current promises. Commerce and licensing are tracked by #27 and #28 and must not be implemented ahead of product readiness.