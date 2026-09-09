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

## Base execution write-back

When an `ARC-###` issue is part of the execution and Linear MCP/access is available:

1. Read the Linear issue before changing code. Use its durable outcome, constraints, acceptance criteria, latest execution report, relations, attachments, and current review/acceptance boundary as context.
2. Preserve the executor explicitly chosen by the user; do not silently delegate elsewhere.
3. Stop at an execution proposal when the issue requires owner approval, destructive or security-sensitive work, release/signing/publication, or another explicit approval boundary.
4. After meaningful work, write a dated execution report to the same Linear issue with: execution summary; what happened; what changed; findings; why; evidence; impact; verification; remaining gaps/uncertainty; next recommended execution; human decision required; executor.
5. Keep Linear status truthful. A built installer, merged PR, or green CI result does not close an issue when real Windows owner/runtime acceptance still remains.
6. If Linear write access is unavailable, return the same structured report and explicitly mark `Linear write-back pending` rather than pretending Base was updated.

A meaningful execution must leave the Linear issue more understandable than before it ran.