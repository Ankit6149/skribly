# lib

Temporary compatibility exports and legacy shared types during repository hygiene.

New generic frontend helpers belong under `src/shared/`. Feature-specific logic belongs with its owning feature.

Current exceptions:

- `geometry.ts` still mixes native-window and note-domain types and will be split in a dedicated hygiene PR;
- compatibility exports remain here while callers/tests migrate.
