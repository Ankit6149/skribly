# ADR-0001: Harden the versioned JSON store before adopting SQLite

- **Status:** Accepted for the Windows MVP
- **Date:** 28 July 2026
- **Decision owner:** Ankit Bhardwaj
- **Related issue:** [#14](https://github.com/Ankit6149/skribly/issues/14)

## Context

Skribli currently keeps all active text notes in memory and persists them as one versioned JSON document in the user's application-data directory. The existing write path is unsafe because it deletes the primary file before committing the durable temporary file, ignores backup-copy failures, and treats a missing primary as an empty database even when recovery files exist.

The broader product model is still being simplified. Issues #20, #22, and #23 will decide the final note lifecycle, remove retired overlay fields and APIs, and determine whether dormant IndexedDB attachments are retained or removed. Moving to SQLite before those decisions would freeze unstable tables and migrations, add a new native dependency, and combine a data-loss repair with a domain-model rewrite.

## Decision

The Windows MVP will retain one authoritative Rust-owned JSON store, but the persistence mechanism is replaced with a crash-recoverable storage service.

The service provides:

- a schema-v2 envelope containing schema version, monotonic revision, write timestamp, integrity digest, and notes;
- deterministic migration from the released schema-v1 envelope;
- a durable same-directory temporary generation;
- write-through atomic replacement on Windows;
- two verified known-good backup generations;
- deterministic recovery from primary, temporary, current backup, legacy backup, and older backup files;
- corruption quarantine instead of destructive overwrite;
- fail-closed behavior for unsupported future schemas;
- typed load, save, recovery, migration, and blocked-write outcomes;
- fault-injection and state-matrix tests.

CRC-32 is used as an accidental-corruption digest, not as an authenticity or security boundary. Skribli's local note file is not treated as resistant to deliberate modification by a process running with the user's permissions. Any future authenticity requirement must use a separately reviewed cryptographic design.

## Why not SQLite now

SQLite is not rejected permanently. It is deferred because:

- current note volume is small and loaded fully into memory;
- the canonical note/context/lifecycle schema is not yet approved;
- attachments and rich content are dormant and may be removed;
- the urgent risk is crash recovery, not query performance;
- a database migration would increase the blast radius of a release-blocking repair;
- JSON gives users and support a transparent emergency-recovery format while the product remains pre-release.

## Consequences

### Positive

- The immediate data-loss path is removed without coupling the repair to unrelated product decisions.
- Existing schema-v1 data remains readable and is upgraded through an explicit migration.
- Recovery generations remain inspectable and exportable.
- The app can block writes without overwriting unsupported or unrecoverable data.
- A later SQLite migration can start from a verified, revisioned source format.

### Negative

- Every save still serializes the complete note collection.
- Search, trash, attachments, and large note libraries will eventually need a more granular model.
- Concurrent writers are not supported; issue #15 must enforce a single application instance.
- JSON plus separate IndexedDB rich content is not an acceptable final multi-record architecture.

## SQLite migration triggers

Revisit this decision before public release if any of the following becomes true:

- the approved MVP requires transactional trash, tags, reminders, or attachment records;
- note libraries become large enough that full-document writes or startup parsing are measurable UX problems;
- multiple independent records must commit atomically;
- structured search and indexing become launch requirements;
- the final domain model in #20/#22 is stable enough to define durable tables;
- recovery tests show the hardened JSON design cannot meet the required durability contract.

## Migration requirements when triggered

A future SQLite migration must:

- import every supported JSON schema and verified backup generation;
- never delete the JSON source until the database is committed and verified;
- preserve a user-readable export;
- include downgrade protection and rollback evidence;
- coordinate note and rich-content records transactionally;
- pass the same fault-injection, disk-full, permission, antivirus-lock, and forced-termination matrix required by #14.
