# Contributing to Skribly

Skribly is currently a private founder-led project.

## Working rules

- Do not expand scope beyond the active milestone.
- Preserve the local-first and lightweight constraints.
- Never add screen capture, OCR, telemetry, cloud sync, or AI features without an explicit architecture decision record.
- Keep shared product logic cross-platform; isolate Windows/macOS code behind platform interfaces.
- Do not introduce a second UI framework.
- Every feature that runs in the background must include idle CPU and memory measurements.
- Add migrations for persistent schema changes; never silently rewrite user data.
- Accessibility permission must never be described as permission to read user content.

## Branching

- `main`: release-quality work
- `spike/*`: disposable technical experiments
- `feature/*`: scoped production work
- `fix/*`: defects

## Definition of done

A change is not done until it includes relevant tests, documentation updates, privacy impact review, cross-platform behavior notes, and performance measurements where applicable.
