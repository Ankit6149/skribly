# Widget feature

This directory is the canonical home for the global/context widget domain and lifecycle logic.

Current ownership:

- `components/` — presentational launcher, header, filter, and Skrib ribbon pieces;
- `lifecycle/` — native-window observation, context presence timing, paint acknowledgement helpers, and note-opening coordination;
- `model/` — pure grouping/context matching/count logic.

The legacy `features/rail/ContextRail.tsx` remains the widget lifecycle/state coordinator during migration. Presentational pieces now live under `features/widget/components/`; legacy model/lifecycle files in `features/rail/` remain compatibility re-exports.
