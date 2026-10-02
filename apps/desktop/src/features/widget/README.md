# Widget feature

This directory is the canonical home for the global/context widget domain and lifecycle logic.

Current ownership:

- `lifecycle/` — native-window observation, context presence timing, paint acknowledgement helpers, and note-opening coordination;
- `model/` — pure grouping/context matching/count logic.

The legacy `features/rail/` folder still owns the large React rendering components during migration. Its model/lifecycle files are compatibility re-exports until `ContextRail.tsx` is decomposed in a later PR.
