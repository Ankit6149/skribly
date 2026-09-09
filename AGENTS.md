# Skribly agent operating rules

Read `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and the relevant product/design docs before changing behavior. Preserve unrelated founder changes and existing release/security constraints.

## Base / Linear operating contract

Linear is the attention/status projection, not a mirror of GitHub. Do not create a Linear issue for every commit, PR, GitHub issue, Dependabot update, test run, or implementation slice.

When work is associated with a Base Linear issue, preserve its `ARC-###` identifier in branch/PR context and use exactly one lifecycle statement in the PR body:

- `Fixes ARC-123` only when merging the PR fully achieves the Linear issue's intended outcome and no owner test, Windows runtime verification, installer/release step, signing step, or other explicit acceptance action remains.
- `Part of ARC-123` when the PR contributes to the outcome but verification/acceptance still remains. This must not auto-close the Linear issue.
- `No Linear issue — <reason>` only for maintenance that genuinely does not need Base tracking.

Never use `Fixes ARC-...` just because implementation or CI is complete when the actual Windows/user outcome remains unverified. Prefer updating/consolidating an existing Base outcome rather than generating additional tracking work.

## Completion discipline

A code merge is implementation evidence, not automatically product acceptance. For native-window behavior, startup, installer, signing, persistence, overlays, updates, or release paths, record the relevant runtime/build evidence before calling the outcome complete.
