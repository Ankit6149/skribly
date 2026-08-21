# Skribli UI component and product-surface inventory

> **Status:** planning inventory, not a statement that every listed component exists or is approved for the current release.  
> The current product contract is defined by [#20](https://github.com/Ankit6149/skribly/issues/20), the production sequence by [#34](https://github.com/Ankit6149/skribly/issues/34), professional UX by [#45](https://github.com/Ankit6149/skribly/issues/45), and deferred capabilities by [#46](https://github.com/Ankit6149/skribly/issues/46).

This inventory prevents two opposite failures:

1. reducing Skribli to an unconsidered textarea with no recovery, settings, support, or system behavior;
2. treating every old overlay, annotation, browser, or macOS concept as current approved scope.

Production components must be registered through #70 and documented/tested through #50 and #73.

## 1. Current Windows MVP surfaces

### 1.1 Compact contextual editor

Required states and components:

- compact transient window shell;
- target/context summary with privacy-conscious display rules;
- Type, Draw, Files, and Reminder workspaces;
- five-pastel note color selection and automatic creation rotation;
- pen, highlighter, eraser, width/color, undo, and confirmed clear controls;
- bounded image, video, and document attachment picker/previews;
- one-time reminder scheduling and state controls;
- primary Done/Close action;
- delete/trash action according to #20/#21;
- saving, saved, unsaved, failed, recovered, blocked, and read-only status;
- retry and recovery actions;
- keyboard instructions that adapt to configured shortcuts;
- storage-recovery panel when no valid note can be loaded;
- accessible names, live regions, focus boundaries, and system-font fallback;
- high-contrast, reduced-motion, large-text, and solid-background variants.

The editor remains bounded to its native window and does not imply a full-screen interactive overlay, attached tab, or permanent toolbar. Done collapses the one active Skrib into a movable dot; richer modes expand the same window to a moderate monitor-clamped workspace.

### 1.2 All Skribs library

Implemented foundations under #21:

- one normal non-floating application window opened from the tray;
- one reused instance whose title-bar Close hides instead of quitting;
- Unicode-normalized case-insensitive search across text and stored context fields;
- deterministic updated/created/ID ordering;
- privacy-safe read-only note detail;
- Notes and Trash views with counts and lifecycle status;
- local Calendar view with linked reminder agenda and note-color markers;
- read-only drawing, attachment, and reminder summaries in note detail;
- reversible Trash, same-record restore, and note-specific permanent-delete confirmation;
- selected-note and complete versioned JSON export;
- strict portable JSON preview with new/duplicate/conflict counts;
- explicit conflict mode, fingerprint/revision locking, verified rollback backup, and atomic import apply;
- loading, error, empty, no-results, blocked, and read-only states;
- keyboard, live-region, forced-colour, reduced-motion, large-text, and compact responsive behavior.

Remaining work under #21, #61, #79, and #82:

- context-safe open/edit and re-anchor entry points;
- archive/restore;
- richer filters and approved grouping controls;
- scalable indexing, pagination/virtualization, and index rebuilding;
- attachment portability;
- ink and reminder portability in native JSON export/import;
- scheduled/user-selected backups and clean-device disaster recovery;
- exact physical Windows accessibility and release-candidate evidence.

### 1.3 Settings

Owned by #52:

- General;
- Appearance and readability;
- Hotkeys;
- Behavior and focus/fullscreen exceptions;
- Accessibility;
- Privacy and permissions;
- Backups and data access;
- Updates;
- Diagnostics and support;
- About/version/build information.

Each setting needs a typed default, validation, migration, ownership, apply/restart behavior, error state, reset behavior, and documentation. Controls for unavailable capabilities are not shown in production.

### 1.4 Onboarding

Owned by #51:

- truthful value demonstration;
- first-run progress and resumable state;
- shortcut tutorial and registration confirmation;
- hotkey-conflict recovery;
- local-storage and privacy explanation;
- tray, Close versus Quit, library, and diagnostics education;
- supported-target and failure guidance;
- skip, back, restart, and revisit actions;
- keyboard, screen-reader, reduced-motion, and large-text variants.

macOS permissions, browser extension pairing, recurring reminders, and other deferred features are not included in Windows MVP onboarding.

### 1.5 Tray and background status

Owned by #53:

- tray icon and status representation;
- ready, paused, degraded, storage-blocked, hotkey-conflict, read-only, and update states;
- approved new/open-note action;
- All Skribs;
- Settings;
- pause/resume;
- diagnostics/support;
- update status;
- About;
- explicit Quit.

The tray must recover after Explorer restart and must not create duplicate icons.

### 1.6 Recovery, diagnostics, and support

Owned by #14, #56, and #59:

- recoverable-storage summary;
- source/recovery generation status;
- quarantine notice;
- safe data and backup folder access;
- content-free diagnostics preview and export;
- version/build/OS/runtime/capability status;
- hotkey, permission, update, and lifecycle status;
- user-facing error ID and safe troubleshooting path;
- vulnerability/private-reporting guidance;
- explicit opt-in for any attachment or future network submission.

## 2. Shared production design-system components

Owned by #50 and reviewed through #31/#73:

- semantic typography, spacing, surface, border, status, elevation, motion, and z-index tokens;
- buttons, icon buttons, links, inputs, text areas, selects, checkboxes, switches, and shortcut recorders;
- menus, tooltips, popovers, dialogs, banners, toasts, inline errors, and progress indicators;
- lists, rows, cards, filters, tabs only where information architecture requires them;
- empty, loading, skeleton, no-results, failure, recovery, offline, and read-only patterns;
- destructive-action and irreversible-confirmation patterns;
- focus indicators and keyboard-state patterns;
- icons from one approved source/style;
- note theme/color tokens with accessible text contrast;
- system-font and expressive-note-font modes;
- forced-colors, reduced-motion, touch-target, and text-expansion variants.

Every production component requires documented hover, focus, active, pressed, selected, disabled, loading, saving, error, and read-only states where applicable.

## 3. Current contextual states

Current typed notes and context UX may require:

- supported context;
- unsupported target;
- ambiguous context;
- degraded/low-confidence context;
- target closed or unavailable;
- target elevated/protected;
- context changed while editing;
- re-anchor/move/detach recovery entry point;
- app-level versus more precise approved scope;
- archived (deferred; not currently implemented);
- active note;
- trashed note, retention review, restore, and confirmed permanent deletion;
- read-only;
- import preview, conflict review, applying, completed, rollback, and blocked states;
- storage recovery required.

The final state model belongs to #18, #20, #21, and #61. UI code must not invent matching rules.

## 4. Annotation components and remaining extensions

The v0 implements bounded freehand ink, local attachments, and one-time reminders. The remaining items below may not be claimed until their parent foundations and capability gates pass.

### 4.1 Input and creation controls

Tracked by #62–#64:

- richer annotation interaction surface beyond the current note workspace;
- advanced pointer/pen/touch state indicators;
- expanded tool selection beyond Type, Draw, Files, and Reminder;
- shapes/arrows/pins/labels/checklist tools;
- redo and history inspection beyond current undo;
- selection, move, resize, lock, grouping, and z-order controls;
- snap/anchor guides;
- keyboard alternatives.

A floating tool palette and placement dimmer are not approved by this inventory. Their necessity and architecture require product/usability review and must not restore a screen-blocking overlay.

### 4.2 Ink and highlighter internals

Tracked by #63:

- pressure/tilt-aware input where supported;
- selection/lasso if separately approved;
- typed summary/alt text;
- performance and storage-limit states.

### 4.3 Structured annotation objects

Tracked by #64:

- arrow endpoints;
- rectangle/circle/freeform highlight;
- pin/label;
- warning or “continue here” label only if validated;
- checklist rows and completion controls;
- geometry handles and keyboard manipulation;
- accessible object summary and state.

### 4.4 Reminder UI

Tracked by #65:

- notification preview and finer privacy setting;
- snooze and failed-delivery recovery beyond current upcoming, overdue, completed, and dismissed states;
- recurrence;
- richer permission/status guidance;
- locked-screen redaction controls.

### 4.5 Attachment UI

Tracked by #66:

- drag-and-drop and upload/copy progress beyond the current file picker;
- duplicate state;
- missing linked-source state if links are supported;
- low-disk and storage-management state;
- remove/restore/permanent-delete behavior;
- export/import and orphan-cleanup reporting.

## 5. Deferred context and platform surfaces

### 5.1 Re-anchor and rule management

Tracked by #61:

- confidence explanation;
- candidate list;
- re-anchor to current target;
- move to another context;
- detach to broader/local scope;
- undo/revert anchor change;
- matching-rule preview, approval, edit, and delete;
- batch recovery when an application changes.

### 5.2 Browser extension

Tracked by #67:

- explicit desktop pairing;
- permission and site-scope controls;
- URL/DOM anchor selection;
- connection/version status;
- unsupported/protected page state;
- anchor-lost/re-anchor state;
- privacy/incognito controls.

The placeholder extension is not a production component.

### 5.3 macOS

Tracked by #68:

- menu-bar lifecycle;
- Accessibility permission onboarding/status/revocation;
- platform capability differences;
- Spaces/fullscreen/display behavior;
- signed/notarized update and support states.

macOS UI does not appear in Windows builds or public claims before acceptance.

### 5.4 Optional encrypted sync

Research only under #69:

- device authorization;
- key/recovery state;
- sync status and offline queue;
- conflict resolution;
- account/export/deletion/provider-shutdown flows.

No sync component is approved for implementation or marketing yet.

## 6. Explicitly unplanned concepts

The following require new approved research, security, architecture, and business issue sets before they enter this inventory as implementation work:

- collaboration;
- mobile companion applications;
- AI-assisted note generation or classification;
- OCR or handwriting recognition;
- third-party plugins;
- marketplace execution of third-party code.

## 7. Failure-state coverage

Every applicable production or approved future surface must define:

- initial/loading;
- empty/no results;
- progress/saving;
- durable success;
- recoverable failure and retry;
- non-recoverable/blocking failure;
- read-only/degraded mode;
- permission denied/revoked;
- low disk/quota reached;
- migration/import/update in progress;
- unsupported future schema/capability;
- offline or unavailable service where network is optional;
- cancellation and interruption;
- accessible announcement and keyboard recovery.

## 8. Contribution rule

A component is contribution-ready only when:

- its product surface and owner are approved;
- behavior and all required states are documented;
- design tokens and reusable primitives exist;
- data/API contracts are stable;
- accessibility, privacy, performance, and localization requirements are explicit;
- deterministic fixtures/tests can demonstrate the change;
- the capability is enabled for the intended build channel.

Do not implement dormant items merely because they appear in this inventory. Use the linked issue as the source of truth.
