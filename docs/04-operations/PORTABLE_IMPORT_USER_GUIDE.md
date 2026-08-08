# Portable import user guide

Skribli imports only JSON files created by the current **Export this note** or **Export complete backup** actions in All Skribs.

## Preview a file

1. Open the Skribli tray menu and choose **All Skribs**.
2. Choose **Import JSON**.
3. Select one local Skribli `.json` export up to 10 MB.
4. Review the native preview before applying anything.

The preview shows:

- total, active, and Trash records;
- new records;
- exact duplicates that will be skipped;
- stable-ID conflicts;
- warnings when the file is a selected-note export rather than a complete backup.

Preview is available when Skribli is read-only because it does not modify local notes.

## Resolve conflicts

**Skip conflicts** is the safe default. Existing local records with the same ID remain unchanged.

**Replace the same IDs** is an explicit recovery choice. It replaces only stable IDs listed as conflicts in the preview. Skribli does not match records by application title, process, note text, or similarity.

Exact duplicate records are always skipped.

## Apply the import

Choose **Apply verified import** only after reviewing the counts and conflict mode.

Before a real mutation, Skribli writes a complete versioned rollback backup into the local `import-backups` directory. The result shows that path after success.

Apply is rejected when:

- the file changed after preview;
- local notes changed after preview;
- the file is malformed, unsupported, oversized, or contains invalid/duplicate records;
- local storage or licence state is read-only;
- the rollback backup or authoritative save cannot be completed safely.

A failed authoritative save restores the prior in-memory collection. No imported record is silently matched to or opened inside an application.

## After import

All Skribs refreshes its Notes and Trash counts. Imported lifecycle state is preserved, and a new complete export includes the resulting active and trashed records.

Public downloads remain disabled until the exact Windows release candidate completes the broader installer, accessibility, compatibility, support, and physical runtime gates.