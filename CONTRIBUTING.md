# Contributing to Skribli

Skribli is an independently developed proprietary product in active production development. The source is publicly visible, but it is not open source. See [`NOTICE.md`](NOTICE.md).

## Participation model

- Bug reports, reproducible technical findings, and focused product feedback are welcome through GitHub issues.
- Do not post credentials, licence keys, private user data, exploit details, or sensitive logs in public issues.
- External pull requests are accepted only when explicitly invited by the repository owner.
- An invited contribution may require separate written contributor terms before merge.
- Opening an issue or pull request does not grant permission to reuse Skribli source or assets elsewhere.

## Working rules

- Do not expand scope beyond the active milestone or linked issue.
- Preserve the local-first and lightweight constraints.
- Never add screen capture, OCR, telemetry, cloud sync, or AI features without an approved architecture decision record.
- Keep shared product logic cross-platform and isolate platform-specific code behind platform interfaces.
- Do not introduce a second UI framework.
- Every feature that runs in the background must include idle CPU and memory measurements.
- Add migrations for persistent schema changes; never silently rewrite user data.
- Accessibility permission must never be described as permission to read user content.
- Never commit secrets, signing material, customer data, production licence tokens, or private keys.

## Branching

- `main`: protected, releasable integration branch.
- `fix/<issue>-<slug>`: defects and production-safety work.
- `feature/<issue>-<slug>`: approved product work.
- `spike/<slug>`: disposable experiments that must not be released.

Branches are removed only after their pull request is merged or intentionally abandoned. Automation must never delete unrelated branches.

## Pull requests

Every production change must use a pull request linked to its issue. The pull request must include:

- a clear problem statement and bounded scope;
- affected architecture and privacy/security considerations;
- tests run and exact results;
- native Windows evidence when behavior depends on Windows runtime semantics;
- documentation and migration impact;
- rollback or recovery notes for persistent, release, workflow, security, commerce, or licence changes;
- an explicit list of incomplete items.

Changes to `.github/workflows/**`, release/signing code, native security boundaries, storage migrations, commerce, licensing, or legal copy require explicit repository-owner approval and must not be merged solely because CI passes.

## Definition of done

A change is complete only when its acceptance criteria are satisfied and the evidence is attached to the issue or pull request. Relevant tests, documentation updates, privacy impact review, cross-platform behavior notes, and performance measurements must be included.

Partial work must remain open and be documented in the issue with completed, unverified, blocked, and deferred sections.

## Security reports

Follow [`SECURITY.md`](SECURITY.md). Do not open a public issue containing an exploitable vulnerability, private user data, credentials, signing material, or licence secrets.
