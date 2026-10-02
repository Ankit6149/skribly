# stores

Compatibility exports for Zustand stores that now belong to product features.

Canonical state ownership:

- Account → `features/account/state/`
- Licensing → `features/licensing/state/`
- Notes/runtime UI → `features/notes/state/`

New production code should import from the owning feature. These shims remain temporarily so structural PRs can stay behavior-neutral while callers/tests migrate.
