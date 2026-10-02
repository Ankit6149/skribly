# Skribli documentation

This directory contains both **current contracts** and **historical evidence**. They must not be treated as equally authoritative.

## Read current documentation first

Start with [current/README.md](current/README.md).

That index identifies the documents that describe the product and architecture that exist now.

## Documentation classes

### Current contracts

Documents that define current product behavior, architecture, decisions, security/privacy boundaries, and release status.

The canonical index is:

- [current/README.md](current/README.md)

### Engineering and acceptance records

Detailed ADRs, Windows runbooks, storage/import contracts, test strategy, release operations, and implementation evidence.

These may be authoritative for their narrow subsystem but should not redefine the whole product.

### Proposals and research

Future design directions, business planning, competitor research, mobile/macOS/sync proposals, and other unapproved work.

These describe options, not shipped capability.

### Historical evidence

Older audits, superseded interaction directions, previous private owner candidates, screenshots, and release notes remain valuable for traceability but must not override current contracts.

## Conflict rule

When two documents disagree:

1. current production code + executable tests define implemented behavior;
2. accepted/current decision records define intended behavior;
3. the current interaction and architecture contracts define the documented product;
4. subsystem acceptance documents define their specific gate;
5. proposals and historical records never override current contracts.

A disagreement between items 1–3 is documentation or implementation drift and must be tracked explicitly rather than silently choosing whichever text is convenient.

## Cleanup in progress

Repository/document hygiene is tracked by [issue #229](https://github.com/Ankit6149/skribly/issues/229).

During the cleanup series, existing document paths remain valid so links and historical evidence do not break. Documents will be classified/moved in bounded pull requests rather than through one destructive rename.
