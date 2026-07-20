# ADR-001: Provisional Tauri stack with overlay spike gate

- **Status:** Provisional
- **Date:** 2026-07-20

## Context

Skribly needs a highly polished shared UI, low idle overhead, direct Windows/macOS distribution, free commercial framework licensing, native window observation, and precise transparent overlays. The founder has strong React experience and needs fast iteration.

## Decision

Start the repository with:

- Tauri 2
- React + TypeScript + Vite
- Rust core
- SQLite after the overlay spike
- Canvas 2D + SVG for annotations
- Chromium extension later

## Gate

This decision becomes accepted only after a spike demonstrates on both Windows and macOS:

1. transparent overlay
2. click-through empty regions
3. interactive note region
4. target-window movement following
5. minimize/restore behavior
6. same-context return
7. acceptable idle CPU and memory

## Consequences

- UI iteration is fast.
- Native platform code remains unavoidable.
- The scaffold must not be mistaken for proof that the hardest behavior works.
- Flutter or Avalonia remains a fallback if the spike exposes unacceptable Tauri/webview limits.
