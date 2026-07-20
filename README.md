# Skribly

**Leave thoughts exactly where they belong.**

Skribly is a lightweight, local-first desktop annotation layer for Windows and macOS. It lets people place typed notes, handwritten scribbles, arrows, highlights, pins, checklists, and reminders directly on applications, webpages, files, folders, and screen locations. A Skrib disappears when its context goes away and returns when that context comes back.

> Status: product definition and technical spike phase. No production release exists yet.

## Product principles

1. **Context before organization** — the right note appears where it is useful; users should not need to search a notebook first.
2. **Invisible until needed** — idle CPU, memory, visual obstruction, and notification noise must remain low.
3. **Local-first and private** — v1 requires no account, cloud, AI API, or screen recording.
4. **Tactile, playful, refined** — the selected visual direction is **Soft Paper Play**.
5. **Cross-platform honestly** — the product is shared across Windows and macOS, with thin native adapters where operating-system behavior differs.

## Selected design direction

![Skribly Direction 1 — Soft Paper Play](assets/design/direction-1-soft-paper-play.jpg)

The source image is preserved at [`assets/design/direction-1-soft-paper-play.jpg`](assets/design/direction-1-soft-paper-play.jpg). Detailed UI behavior is documented in [`docs/01-design`](docs/01-design/).

## Provisional stack

- Tauri 2 desktop shell
- React + TypeScript + Vite UI
- Rust application core and platform adapters
- SQLite local persistence
- Canvas 2D for freehand ink
- SVG for structured arrows, highlights, and shapes
- Chromium extension for exact webpage/DOM anchoring

This is a **provisional implementation decision**. Before full development, the overlay spike must prove transparent click-through behavior and context restoration on both Windows and macOS. See [`ADR-001`](docs/02-engineering/adr/ADR-001-provisional-stack.md).

## Repository map

```text
skribly/
├── apps/desktop/              Tauri + React desktop application
├── extensions/chromium/       Chrome/Edge/Brave webpage anchoring extension
├── packages/design-system/    Shared Soft Paper Play design tokens
├── packages/shared/           Shared TypeScript models and message contracts
├── assets/design/             Approved product design references
├── docs/                      Product, UX, engineering, business, and legal notes
└── .github/workflows/         Initial CI skeleton
```

## First engineering gate

The first runnable proof must do only this:

1. Open a transparent overlay.
2. Show one yellow Skrib attached to another application window.
3. Allow clicks through empty overlay space.
4. Allow direct interaction with the Skrib.
5. Follow the target window when it moves.
6. Hide when the target minimizes or closes.
7. Return when the same context reopens.
8. Pass on Windows and macOS before broad feature development.

## Important documents

- [Product vision](docs/00-product/PRODUCT_VISION.md)
- [Product requirements](docs/00-product/PRD.md)
- [Design direction](docs/01-design/DESIGN_DIRECTION.md)
- [Complete component inventory](docs/01-design/COMPONENT_INVENTORY.md)
- [Interaction specification](docs/01-design/INTERACTION_SPEC.md)
- [Architecture](docs/02-engineering/ARCHITECTURE.md)
- [Technology options](docs/02-engineering/TECH_STACK_OPTIONS.md)
- [Context anchoring](docs/02-engineering/CONTEXT_ANCHORING.md)
- [Performance budgets](docs/02-engineering/PERFORMANCE_BUDGET.md)
- [Distribution and store costs](docs/03-business/STORE_DISTRIBUTION.md)
- [India GST and tax working notes](docs/03-business/INDIA_GST_TAX_NOTES.md)
- [Roadmap](docs/06-planning/ROADMAP.md)

## Commercial status

This repository is prepared as a **private commercial product repository**. No open-source licence is granted. See [`NOTICE.md`](NOTICE.md).
