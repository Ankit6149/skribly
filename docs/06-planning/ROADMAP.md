# Skribli roadmap

This file is a navigation summary. The issue tracker is the source of truth for scope, dependencies, acceptance criteria, evidence, and completion status.

## Canonical trackers

- [#34 — Production-readiness execution plan](https://github.com/Ankit6149/skribly/issues/34)
- [#45 — Professional product experience, UI/UX, and design system](https://github.com/Ankit6149/skribly/issues/45)
- [#46 — Future annotation, context, and platform architecture](https://github.com/Ankit6149/skribly/issues/46)
- [#47 — Contributor experience, maintainability, and scalable quality](https://github.com/Ankit6149/skribly/issues/47)
- [`PRODUCT_BACKLOG_AND_CONTRIBUTION_MAP.md`](PRODUCT_BACKLOG_AND_CONTRIBUTION_MAP.md)

## Current product target

The active release target is a local-first Windows contextual typed-note product with:

- a fast global-shortcut capture flow;
- a compact transient editor;
- durable crash-safe local storage;
- one-instance background lifecycle and tray controls;
- fail-closed context matching;
- a normal non-floating library/recovery surface;
- search, export/import, archive, reversible trash, verified backups, and support diagnostics;
- privacy-lock and sensitive-context behavior;
- an evidence-backed Windows compatibility matrix;
- keyboard, screen-reader, high-contrast, reduced-motion, text-scaling, multi-monitor, and mixed-DPI support;
- a signed, reproducible, recoverable installer/update path.

The current release target does not include a permanently interactive full-screen overlay or persistent floating dots/widgets.

## Phase 0 — Safety foundation

Issues #14–#19:

- crash-safe storage and recovery;
- one-instance lifecycle;
- ordered/lossless editing;
- bounded native event processing;
- durable fail-closed context identity;
- monitor/DPI-safe placement.

No public release or feature expansion happens while a P0 issue remains open.

## Phase 1 — Real Windows MVP

Issues #20–#23, #31–#32, #48–#56, #59, #70, #72, #79–#80, #82, and #84–#85:

- canonical product lifecycle;
- library, recovery, export/import, archive, and trash;
- minimal validated native/frontend API;
- removal/isolation of retired prototypes;
- documentation and capability truth;
- user research and information architecture;
- production design system;
- onboarding, Settings, tray, shortcuts, focus, and truthful error states;
- accessibility;
- privacy-safe support diagnostics;
- local search/indexing;
- verified user backups and disaster recovery;
- privacy lock, sensitive-context rules, and screen-sharing behavior;
- permission/network/data transparency;
- documented Windows version, architecture, hardware, and application compatibility.

## Phase 2 — Engineering and release confidence

Issues #24–#25, #30, #33, and #71–#78:

- exact-binary Windows validation;
- signed reproducible releases;
- CI, security, visual, accessibility, performance, and architecture gates;
- repository protection, secrets, backup, and recovery;
- contributor bootstrap and deterministic test harnesses;
- performance budgets;
- update channels and rollback;
- install, repair, upgrade, uninstall, and data-retention behavior.

## Phase 3 — Truthful launch surface

Issues #26 and #29:

- website and download behavior matching the exact binary;
- security, privacy, data handling, support, legal, retention, and incident baseline.

## Phase 4 — Optional commercial system

Issues #27 and #28 only after the product is stable:

- checkout, fulfilment, refunds, chargebacks, reconciliation, and support;
- licence activation, offline entitlement, transfer, revocation, and recovery.

Payments remain disabled until these workflows and the real legal/accounting treatment are verified.

## Phase 5 — Deferred post-MVP capabilities

Tracked under #46:

- versioned multi-annotation domain model;
- re-anchor and context-rule management;
- touch/pen input architecture;
- ink/highlighter;
- shapes, arrows, pins, labels, and checklists;
- reminders;
- attachments;
- local revision history and undo/redo;
- Chromium URL/DOM anchoring;
- macOS;
- optional encrypted sync research.

Collaboration, mobile, AI, OCR, third-party plugins, and marketplace execution are not implementation commitments. They require separate research, security, architecture, and business approval.

## Execution rules

1. Work in dependency order.
2. Do not close partial issues; add a complete progress comment instead.
3. Compilation is not native runtime evidence.
4. Persistent changes require migration, backup, recovery, downgrade, export, deletion, retention, and rollback plans.
5. New permissions, network paths, privacy/capture behavior, capabilities, compatibility claims, public claims, or platforms require reviewed decisions.
6. Deferred code must be excluded from production bundles rather than merely hidden.
7. Contributors should start only from issues marked ready after product and architecture decisions are complete.