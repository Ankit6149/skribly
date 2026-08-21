# Portable import known limitations

These limits apply to the current Windows release-candidate implementation.

## Supported today

- JSON files produced by the current **Export this note** and **Export note records** actions; these exclude IndexedDB ink, attachments, and reminders.
- Portable schema version 1.
- Typed-note records with the current active/Trash lifecycle metadata.
- Files up to 10 MB and 50,000 records.
- Exact-duplicate skipping.
- Stable-ID conflict skipping or explicit replacement.
- Mandatory local preview and revision-locked apply.
- A complete durably verified rollback backup before any real mutation.

## Deliberately rejected

- Unknown future schemas or fields.
- Duplicate IDs inside one file.
- Partial best-effort import of malformed records.
- Matching by application title, process name, note text, timestamps, or similarity.
- Automatic context launch, focus, or re-anchor.
- Applying after the file or local storage revision changed following preview.
- Applying while storage or licence state is read-only.

## Deferred work

- Attachments and future annotation variants.
- Archive records.
- Scheduled backups and user-selected backup destinations.
- Automatic rollback execution from an import backup.
- Importing from cloud providers or network locations through a Skribli service.
- Context-safe open-in-application and re-anchor workflows.
- Physical release-candidate evidence across the full Windows environment matrix.

Public downloads remain disabled until these broader release gates, installer validation, accessibility evidence, compatibility documentation, signing, support readiness, and final delivery reconciliation are complete.
