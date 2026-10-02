# Target repository structure

> **Status:** migration target for repository-hygiene issue #229. This document changes organization only; it does not authorize product-behavior changes.

## Principles

1. A contributor should know where code belongs from the product concept alone.
2. Native windows/surfaces are distinct from reusable product features.
3. Domain behavior must not live inside giant rendering components.
4. Platform-specific Windows code stays behind a native platform boundary.
5. Tests live beside units when practical; installed-platform acceptance remains clearly separate.
6. Component CSS has one canonical owner; patch/override stylesheets are temporary migration debt.
7. Deployment-sensitive roots (`site/`, `supabase/`) stay stable until their external configuration is deliberately migrated.

## Target frontend

```text
apps/desktop/src/
├── app/
│   ├── App.tsx
│   ├── bootstrap.ts
│   ├── main.tsx
│   └── windowRouter.ts
│
├── windows/
│   ├── home/
│   ├── note/
│   ├── widget/
│   └── context-widget/
│
├── features/
│   ├── notes/
│   │   ├── components/
│   │   ├── editor/
│   │   ├── lifecycle/
│   │   ├── persistence/
│   │   └── model/
│   ├── widget/
│   │   ├── components/
│   │   ├── lifecycle/
│   │   └── model/
│   ├── library/
│   ├── reminders/
│   ├── account/
│   ├── licensing/
│   ├── onboarding/
│   └── settings/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── native/
│   ├── types/
│   └── utils/
│
└── styles/
    ├── reset.css
    ├── accessibility.css
    └── tokens.css
```

### Ownership rule

- `windows/`: composition for actual Tauri windows/surfaces.
- `features/`: product capability/domain UI that could be composed by a window.
- `shared/`: code genuinely used across domains.
- feature-specific persistence belongs with the feature until/unless moved behind a unified persistence service.

## Target native structure

```text
apps/desktop/src-tauri/src/
├── main.rs
├── lib.rs
│
├── app/
│   ├── setup.rs
│   └── state.rs
│
├── commands/
│   ├── notes.rs
│   ├── widget.rs
│   ├── library.rs
│   ├── account.rs
│   └── settings.rs
│
├── domain/
│   ├── notes/
│   ├── account/
│   └── licensing/
│
├── windows/
│   ├── note/
│   ├── widget/
│   └── home/
│
├── storage/
│   ├── json_store.rs
│   ├── recovery.rs
│   ├── import.rs
│   └── export.rs
│
└── platform/
    └── windows/
        ├── events.rs
        ├── focus.rs
        ├── icons.rs
        ├── target_capture.rs
        ├── geometry.rs
        └── single_instance.rs
```

### Native ownership rule

- `commands/`: thin Tauri command adapters.
- `domain/`: product rules independent of HWND/WebView details.
- `windows/`: lifecycle/state of Skribli-owned native windows.
- `storage/`: durable local persistence/import/export/recovery.
- `platform/windows/`: Win32 inspection, focus/events, placement and OS integration.
- `lib.rs`: application wiring, not a multi-thousand-line feature coordinator.

## Target CSS ownership

Approved visual rules migrate into their owning feature rather than accumulate in the global `src/styles/` bucket. The runtime import order must remain explicit whenever selector precedence is part of current behavior.

Current migration target:

```text
features/notes/styles/
features/widget/styles/
features/library/styles/
features/account/styles/
```

Global `src/styles/` is reserved for truly application-wide reset/accessibility/theme/recovery concerns. Legacy feature stylesheet paths remain compatibility imports only until the dead-code cleanup phase removes them.

Approved visual rules should migrate into their owning surface/component rather than accumulate in global patch layers.

Examples:

```text
features/notes/components/NotePaper.css
features/notes/components/NoteActions.css
features/widget/components/WidgetPanel.css
windows/home/home.css
```

Shared design tokens remain in `packages/design-system`.

## Migration rules

- One subsystem per PR.
- Preserve behavior during structural moves.
- Move/rename tests with implementation.
- Update imports mechanically first; refactor behavior only in a later PR.
- Run TypeScript, frontend tests/build, Rust formatting/tests, governance/product-truth validators after each migration.
- Do not combine broad CSS visual changes with file movement.
- Do not merge dependency-update PRs through the middle of a high-conflict structural move without rebasing/revalidating them.
