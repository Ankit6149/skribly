# Notes feature

This directory is the canonical home for note **domain and feature logic** as the legacy `features/skribs/` folder is decomposed.

Current ownership:

- `lifecycle/` — save/delete/open lifecycle state and rules;
- `model/` — pure note, ink, inline-attachment and temporary-surface models;
- `persistence/` — note-specific frontend persistence coordination.

React note rendering still lives in `features/skribs/` during the migration. Compatibility exports remain there temporarily so structural PRs do not change runtime behavior.
