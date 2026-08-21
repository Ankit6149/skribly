import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const failures = [];

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

async function exists(relativePath) {
  try {
    await access(path.join(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

const nativeImport = await read('apps/desktop/src-tauri/src/desktop/library_import.rs');
const desktopModules = await read('apps/desktop/src-tauri/src/desktop/mod.rs');
const tray = await read('apps/desktop/src-tauri/src/desktop/tray.rs');
const frontendImport = await read('apps/desktop/src/features/library/libraryImport.ts');
const frontendTests = await read('apps/desktop/src/features/library/libraryImport.test.ts');
const importPanel = await read('apps/desktop/src/features/library/LibraryImportPanel.tsx');
const libraryHost = await read('apps/desktop/src/features/library/LibraryHost.tsx');
const importStyles = await read('apps/desktop/src/styles/import.css');
const adr = await read('docs/02-engineering/ADR-0004-portable-import-transaction.md');
const acceptance = await read('docs/04-operations/PORTABLE_IMPORT_ACCEPTANCE.md');
const privacy = await read('site/privacy.html');
const releaseNotes = await read('site/release-notes.html');

for (const marker of [
  'pub mod library_import;',
]) {
  if (!desktopModules.includes(marker)) failures.push(`Desktop import module is missing: ${marker}`);
}
for (const marker of [
  'install_library_import_bridge(app)?',
]) {
  if (!tray.includes(marker)) failures.push(`Native import bridge is not installed: ${marker}`);
}

for (const marker of [
  'LIBRARY_IMPORT_PREVIEW_REQUEST_EVENT',
  'LIBRARY_IMPORT_PREVIEW_RESULT_EVENT',
  'LIBRARY_IMPORT_APPLY_REQUEST_EVENT',
  'LIBRARY_IMPORT_APPLY_RESULT_EVENT',
  'const MAX_IMPORT_BYTES: usize = 10 * 1024 * 1024;',
  'const MAX_IMPORT_NOTES: usize = 50_000;',
  '#[serde(rename_all = "camelCase", deny_unknown_fields)]',
  'struct PortableSkribNote',
  'Schema 1 deliberately preserves SkribNote',
  '#[serde(deny_unknown_fields)]',
  'struct PortableImportEnvelope',
  'enum ImportConflictMode',
  'Skip',
  'Replace',
  'fn parse_import(',
  'fn validate_portable_note(',
  'fn build_import_plan(',
  'fn merge_import_plan(',
  'fn validate_expected_revision(',
  'fn persist_import_collection(',
  'write_library_export(',
  'verify_rollback_backup(',
  '.join("import-backups")',
  'LibraryExportScope::AllRecords',
  'MIN_PORTABLE_IMPORT_SCHEMA_VERSION',
  'LibraryExportContentCoverage::default()',
  'crate::core::license::require_global_write_access()',
  'storage.is_writable()',
  'request.expected_fingerprint',
  'request.expected_revision',
  '.mutation_lock',
  'state.coordinator.replace_all_skribs(previous_notes)',
  'Local notes were restored',
]) {
  if (!nativeImport.includes(marker)) failures.push(`Native import contract is missing: ${marker}`);
}

for (const forbidden of [
  'focus_external_window',
  'set_active_target',
  'reposition_compact_window',
  'target_title.contains',
  'process_name.contains',
]) {
  if (nativeImport.includes(forbidden)) {
    failures.push(`Portable import must not target or guess applications: ${forbidden}`);
  }
}

for (const testName of [
  'parses_active_and_trashed_notes_from_the_export_format',
  'rejects_future_schema_duplicate_ids_and_unknown_fields',
  'rejects_unsafe_note_content_without_partial_results',
  'planning_distinguishes_new_identical_and_conflicting_ids',
  'fingerprint_changes_when_the_exact_file_changes',
  'preview_is_deterministic_and_bounds_conflict_details',
  'skip_mode_adds_new_records_and_preserves_existing_conflicts',
  'replace_mode_changes_only_the_same_conflicting_ids',
  'revision_changes_require_a_new_preview',
  'persisted_import_restores_the_complete_coordinator_on_save_failure',
  'persisted_import_saves_the_complete_merged_collection',
  'rollback_backup_is_read_back_and_rejects_tampering',
]) {
  if (!nativeImport.includes(testName)) failures.push(`Native import test is missing: ${testName}`);
}

for (const marker of [
  'MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024',
  "export type ImportConflictMode = 'skip' | 'replace'",
  'isImportPreviewResult',
  'isImportApplyResult',
  'validateImportFileMetadata',
  'createImportPreviewRequest',
  'createImportApplyRequest',
  'Object.keys(record).every((key) => keys.has(key))',
  'expectedFingerprint: preview.fingerprint',
  'expectedRevision: preview.currentRevision',
]) {
  if (!frontendImport.includes(marker)) failures.push(`Frontend import contract is missing: ${marker}`);
}
for (const testName of [
  'accepts the exact native preview shape',
  'rejects expanded or contradictory preview results',
  'accepts successful and failed apply results',
  'rejects ambiguous or privacy-expanded apply results',
  'creates apply requests from the exact preview fingerprint and revision',
  'rejects non-JSON, empty, and oversized files',
]) {
  if (!frontendTests.includes(testName)) failures.push(`Frontend import test is missing: ${testName}`);
}

for (const marker of [
  'type="file"',
  'accept=".json,application/json"',
  'Preview import',
  'Nothing changes until you apply the preview.',
  'Skip conflicts',
  'Safest default. Existing local records remain unchanged.',
  'Replace the same IDs',
  'Apply verified import',
  'A complete rollback backup is written before local Skribs change.',
  'Preview only',
  'Import applied safely',
  'No local records changed, so no rollback backup was required.',
  'IMPORT_RESPONSE_TIMEOUT_MS',
]) {
  if (!importPanel.includes(marker)) failures.push(`Import panel behavior is missing: ${marker}`);
}
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'axios', 'focus_target_window', 'set_active_target']) {
  if (importPanel.includes(forbidden)) failures.push(`Import panel must remain local-only: ${forbidden}`);
}

for (const marker of [
  '<LibraryImportPanel canApply={canMutate}',
  'handleImportApplied',
  'Read-only: notes, previews, and exports remain available',
  'Restoring and importing change only local records',
]) {
  if (!libraryHost.includes(marker)) failures.push(`All Skribs import integration is missing: ${marker}`);
}

for (const marker of [
  '.library-import-panel',
  '.library-import-summary',
  '.library-import-conflicts',
  '.library-import-conflict-details',
  '.library-import-complete',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  if (!importStyles.includes(marker)) failures.push(`Import accessibility style is missing: ${marker}`);
}

for (const marker of [
  'Mandatory preview',
  'Apply also requires the storage revision returned by preview.',
  'write and durably verify a complete pre-import backup',
  'Skip conflicts',
  'Replace the same IDs',
  'Issue #21 remains open',
]) {
  if (!adr.includes(marker)) failures.push(`Import ADR is missing: ${marker}`);
}
for (const marker of [
  'Physical Windows acceptance matrix',
  'Local note changes after preview',
  'Backup creation fails',
  'Storage save fails after in-memory merge',
  'Read-only storage or expired licence',
  'Issue #21 remains open',
]) {
  if (!acceptance.includes(marker)) failures.push(`Import acceptance contract is missing: ${marker}`);
}

for (const marker of [
  'portable JSON import',
  'preview',
  'does not upload',
  'Public downloads are disabled.',
]) {
  if (!privacy.toLowerCase().includes(marker.toLowerCase())) {
    failures.push(`Privacy import truth is missing: ${marker}`);
  }
}
for (const marker of [
  'Portable JSON import',
  'mandatory preview',
  'rollback backup',
  'Public downloads are disabled.',
]) {
  if (!releaseNotes.includes(marker)) failures.push(`Development-note import truth is missing: ${marker}`);
}

for (const temporaryPath of [
  '.github/workflows/temp-import-finalize.yml',
  '.github/workflows/temp-import-format.yml',
  '.github/workflows/temp-import-hardening.yml',
  '.github/workflows/temp-import-release-gate.yml',
  '.github/workflows/temp-import-rescue.yml',
]) {
  if (await exists(temporaryPath)) failures.push(`Temporary import workflow remains: ${temporaryPath}`);
}

if (failures.length > 0) {
  console.error('Portable import validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Portable import validation passed.');
