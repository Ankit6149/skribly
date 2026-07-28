# Skribli product backlog and contribution map

**Canonical execution epic:** [#34](https://github.com/Ankit6149/skribly/issues/34)  
**Product experience epic:** [#45](https://github.com/Ankit6149/skribly/issues/45)  
**Future architecture epic:** [#46](https://github.com/Ankit6149/skribly/issues/46)  
**Contributor-quality epic:** [#47](https://github.com/Ankit6149/skribly/issues/47)

## Why this document exists

Skribli is no longer represented by a small list of implementation bugs. A professional desktop product needs coordinated work across data safety, native lifecycle, product behavior, UI/UX, onboarding, settings, accessibility, support, backups, install/update operations, privacy, compatibility, testing, maintainability, and future architecture.

This document explains how the issue tracker is structured, which work is safe to start, and how contributors should avoid making hidden product or architecture decisions.

## Current product direction

The current release target is a local-first Windows contextual typed-note product with a compact transient editor and a non-floating recovery/library surface.

The release target does **not** include a permanently interactive full-screen overlay, floating dots/widgets, ink, arrows, highlights, reminders, browser DOM anchoring, macOS, cloud sync, collaboration, AI, OCR, or a marketplace.

Those ideas are either rejected for the current interaction model or explicitly deferred under #46. Deferred features must not be reintroduced through dormant components, hidden settings, environment flags, website copy, or package metadata.

## Priority and phase model

### P0 — safety and data integrity

P0 work blocks every public build and most feature development:

- #14 crash-safe recoverable storage;
- #15 one-instance lifecycle;
- #16 ordered lossless editing;
- #17 bounded Windows event processing;
- #18 fail-closed context identity;
- #19 monitor/DPI-safe placement.

No issue closes from compilation alone. Native behavior and failure recovery require exact-binary evidence.

### P1 — professional Windows product

P1 work defines and completes the real product:

- #20–#23 product lifecycle, library, API, and retired-code cleanup;
- #31–#33 accessibility, documentation truth, and governance;
- #48–#56 research, navigation, design system, onboarding, settings, tray, shortcuts, focus, and microcopy;
- #59, #70–#80 diagnostics, capability isolation, contributor setup, architecture, test harnesses, performance, update/install behavior, search, and privacy transparency;
- #82 verified user backups and disaster recovery;
- #84 privacy lock, sensitive-context, screen-sharing, and capture behavior;
- #85 evidence-backed Windows compatibility and support matrix.

### P2 — post-MVP quality and approved capabilities

P2 work begins only after its foundations are stable:

- #57 appearance/readability preferences;
- #58 localization/time-zone readiness;
- #62–#68 input, expressive annotations, reminders, attachments, browser precision, and macOS;
- #83 local revision history, undo/redo, and accidental-edit recovery.

### P3 — research only

- #69 optional end-to-end encrypted sync.

P3 is not an implementation commitment.

## Dependency order

Use this order unless an issue explicitly documents a safe parallel path:

1. repository and data safety;
2. one-instance lifecycle and ordered persistence ownership;
3. context identity, event processing, and placement;
4. canonical Windows MVP state model;
5. minimal native/frontend API and retired-code cleanup;
6. information architecture, design system, accessibility, onboarding, settings, tray, shortcuts, focus, privacy lock, and recovery language;
7. library/search/export/import, verified backups, and support/diagnostics;
8. deterministic test harnesses, compatibility evidence, performance budgets, install/update/release operations;
9. website, privacy/security/legal, and optional commerce;
10. deferred annotation, revision-history, and platform capabilities.

## What makes an issue contribution-ready

An issue is ready for outside implementation only when all of the following are true:

- the product or architecture decision is approved;
- parent dependencies are resolved or stable enough to build against;
- affected modules and ownership are identified;
- scope and non-goals are explicit;
- acceptance criteria describe observable outcomes;
- tests and runtime evidence are specified;
- privacy, accessibility, performance, migration, export, and downgrade impacts are covered where relevant;
- the work does not require signing secrets, customer data, commerce credentials, or legal authority;
- partial delivery can be merged safely behind an approved capability boundary, or remains in an open draft PR.

Small size alone does not make an issue a good first issue.

## Contributor-friendly work categories

After parent foundations are approved, good contribution candidates include:

- documentation truth audits and architecture diagrams;
- sanitized deterministic fixtures;
- unit/property tests for approved contracts;
- component-workbench stories;
- keyboard, high-contrast, text-scaling, and screen-reader test cases;
- error-catalogue mappings for existing error codes;
- performance datasets and reproducible benchmarks;
- environment-doctor checks and troubleshooting documentation;
- search ranking/filter fixtures;
- backup manifest and restore fixtures;
- safe decoder/validator tests for approved attachment types;
- native compatibility evidence tied to exact builds.

## Work that requires maintainer approval before implementation

- note lifecycle or shortcut semantics;
- persistent schema, revision-history, backup, or restore changes;
- context matching or stored identity fields;
- Windows hooks, focus, permissions, privacy lock, capture behavior, or background behavior;
- new network access or telemetry;
- new feature flags/capabilities;
- security, cryptography, licence signing, payments, refunds, or customer data;
- installer/update/signing behavior;
- new platforms, extensions, or annotation types;
- product terminology, public claims, compatibility claims, or legal/privacy copy.

## Partial-work rule

Do not close an issue when implementation or evidence is partial.

Every meaningful partial update should receive an issue comment containing:

1. completed scope;
2. exact branch, PR, commit, or artifact;
3. automated checks that passed or failed;
4. native/manual evidence completed;
5. known limitations and unsupported paths;
6. data migration and rollback status;
7. remaining checklist items;
8. blockers or decisions still required.

A passing CI run is evidence for the checks it ran, not proof of complete product behavior.

## Current active execution

The current implementation focus remains #14, crash-safe and recoverable storage. Draft PR #44 must remain open until automated checks and required Windows runtime evidence are complete. The next dependency-ordered issue is #15.

Do not divert implementation effort into P2/P3 capabilities while P0 work remains open.

## Roadmap ownership

- #34 owns release sequencing and go/no-go gates.
- #45 owns professional product experience and UI/UX.
- #46 owns explicitly deferred future capability architecture.
- #47 owns contributor experience, maintainability, and scalable quality.
- #32 owns keeping repository documentation and claims synchronized with these canonical trackers.

When issue scopes change, update the relevant epic and this document in the same reviewed change.