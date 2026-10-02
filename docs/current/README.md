# Current Skribli source-of-truth index

Use this page before reading design explorations, old owner candidates, historical audits, or future proposals.

## Current product

- [Product vision](../00-product/PRODUCT_VISION.md)
- [Product requirements](../00-product/PRD.md)
- [Current Windows interaction specification](../01-design/INTERACTION_SPEC.md)
- [Decision log](../06-planning/DECISION_LOG.md)

## Current engineering

- [Architecture](../02-engineering/ARCHITECTURE.md)
- [Test strategy](../02-engineering/TEST_STRATEGY.md)
- [Privacy and security requirements](../04-legal-privacy/PRIVACY_AND_SECURITY.md)
- [Repository governance](../06-planning/REPOSITORY_GOVERNANCE.md)
- [Target repository structure](REPOSITORY_STRUCTURE.md)

## Current release status

- [v0.1.51 private owner candidate](../04-operations/OWNER_CANDIDATE_V0.1.51.md)
- [Widget surface/motion evidence and remaining gaps](../04-operations/WIDGET_SURFACE_MOTION_2026-10-02.md)
- [Widget visual refinement](../04-operations/WIDGET_VISUAL_POLISH_2026-10-02.md)
- [Private Windows acceptance](../04-operations/PRIVATE_WINDOWS_TEST_ACCEPTANCE.md)

The owner candidate is not a public release. Installed Windows acceptance, signing and broader release gates remain separate.

## Accepted architecture decisions

- [ADR-0001 — hardened JSON storage](../02-engineering/ADR-0001-hardened-json-storage.md)
- [ADR-0002 — note-open lifecycle](../02-engineering/ADR-0002-canonical-note-open-lifecycle.md)
- [ADR-0003 — reversible Trash](../02-engineering/ADR-0003-reversible-trash-lifecycle.md)
- [ADR-0004 — portable import transaction](../02-engineering/ADR-0004-portable-import-transaction.md)

If an ADR conflicts with a later accepted decision or actual current runtime contract, record and repair that drift instead of treating both as simultaneously current.

## Known documentation drift being cleaned

The repository accumulated many design/release documents during rapid iteration. The hygiene program under issue #229 will:

- separate current contracts from historical material;
- reconcile stale version references;
- reconcile superseded shortcut/reminder/widget wording;
- reduce duplicate “final” design documents;
- make one release-status document point to the exact current candidate;
- keep historical evidence auditable without letting it become product truth.
