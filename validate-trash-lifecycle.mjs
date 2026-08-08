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

const models = await read('apps/desktop/src-tauri/src/core/models.rs');
const storage = await read('apps/desktop/src-tauri/src/core/storage.rs');
const coordinator = await read('apps/desktop/src-tauri/src/core/coordinator.rs');
const nativeEntry = await read('apps/desktop/src-tauri/src/lib.rs');
const nativeLibrary = await read('apps/desktop/src-tauri/src/desktop/library.rs');
const geometry = await read('apps/desktop/src/lib/geometry.ts');
const store = await read('apps/desktop/src/stores/skribStore.ts');
const storeTests = await read('apps/desktop/src/stores/skribStore.test.ts');
const composer = await read('apps/desktop/src/features/skribs/SkribComposer.tsx');
const library = await read('apps/desktop/src/features/library/LibraryHost.tsx');
const lifecycle = await read('apps/desktop/src/features/library/trashLifecycle.ts');
const lifecycleTests = await read('apps/desktop/src/features/library/trashLifecycle.test.ts');
const styles = await read('apps/desktop/src/styles/trash.css');
const adr = await read('docs/02-engineering/ADR-0003-reversible-trash-lifecycle.md');
const acceptance = await read('docs/04-operations/TRASH_ACCEPTANCE.md');
const privacy = await read('site/privacy.html');
const releaseNotes = await read('site/release-notes.html');

for (const marker of [
  'const CURRENT_SCHEMA_VERSION: u32 = 3;',
  'const PREVIOUS_SCHEMA_VERSION: u32 = 2;',
  'selected.migrated_from_schema.is_some()',
  'UnsupportedSchema',
]) {
  if (!storage.includes(marker)) failures.push(`Storage lifecycle contract is missing: ${marker}`);
}

for (const marker of [
  '#[serde(default, skip_serializing_if = "Option::is_none")]',
  'pub deleted_at: Option<u64>',
  'active_note_serialization_preserves_the_schema_v2_integrity_shape',
  'trashed_note_serialization_includes_schema_v3_lifecycle_metadata',
  'legacy_note_without_lifecycle_metadata_deserializes_as_active',
]) {
  if (!models.includes(marker)) failures.push(`Lifecycle model compatibility is missing: ${marker}`);
}

if (!geometry.includes('deleted_at?: number | null')) {
  failures.push('Frontend SkribNote must expose optional lifecycle metadata.');
}

for (const marker of [
  'pub fn trash_skrib(',
  'pub fn restore_skrib(',
  'pub fn permanently_delete_skrib(',
  'pub fn discard_empty_skrib(',
  'note.deleted_at.is_none()',
  '.filter(|note| note.deleted_at.is_none())',
  '.filter(|note| note.deleted_at.is_some())',
  'trash_hides_note_from_context_and_restore_preserves_identity',
  'permanent_delete_is_available_only_after_trash',
  'empty_discard_never_removes_nonempty_or_trashed_notes',
]) {
  if (!coordinator.includes(marker)) failures.push(`Coordinator lifecycle rule is missing: ${marker}`);
}

for (const marker of [
  'fn trash_skrib_note(',
  'fn discard_empty_skrib_note(',
  'fn restore_skrib_note(',
  'fn permanently_delete_skrib_note(',
  'run_persisted_mutation(&state',
  'trash_skrib_note,',
  'restore_skrib_note,',
  'permanently_delete_skrib_note,',
]) {
  if (!nativeEntry.includes(marker)) failures.push(`Native lifecycle command is missing: ${marker}`);
}
for (const retired of ['fn delete_skrib_note(', '.remove_skrib(&id)']) {
  if (nativeEntry.includes(retired)) failures.push(`Retired immediate-delete path returned: ${retired}`);
}

for (const marker of [
  'trashSkrib: (id: string) => Promise<boolean>',
  'discardEmptySkrib: (id: string) => Promise<boolean>',
  "invoke<OverlayStatePayload>('trash_skrib_note'",
  "invoke<OverlayStatePayload>('discard_empty_skrib_note'",
  'previousSkribs',
  'Failed to move Skrib to Trash',
]) {
  if (!store.includes(marker)) failures.push(`Compact store lifecycle is missing: ${marker}`);
}
for (const retired of ["'delete_skrib_note'", 'deleteSkrib:']) {
  if (store.includes(retired)) failures.push(`Retired frontend delete path returned: ${retired}`);
}

for (const testName of [
  'adds a new active skrib note with explicit lifecycle metadata',
  'removes a note from the active compact-editor collection when moving it to Trash',
  'discards a newly created empty note through its separate constrained path',
  'keeps existing notes unchanged when the licence is read only',
  'keeps existing notes unchanged when storage is read only',
]) {
  if (!storeTests.includes(testName)) failures.push(`Store lifecycle test is missing: ${testName}`);
}

for (const marker of [
  'trashSkrib,',
  'discardEmptySkrib,',
  'Move this note to Trash?',
  'You can restore it from All Skribs for 30 days.',
  'Move to Trash',
  'The note could not be moved to Trash safely. It remains available.',
]) {
  if (!composer.includes(marker)) failures.push(`Compact editor Trash behavior is missing: ${marker}`);
}
for (const retired of ['Trash is not available in this build', 'Delete this note permanently?']) {
  if (composer.includes(retired)) failures.push(`Retired compact editor copy returned: ${retired}`);
}

for (const marker of [
  "export const TRASH_RETENTION_DAYS = 30",
  "state: 'retained' | 'expired' | 'invalid'",
  "view === 'trash' ? isTrashedNote(note) : !isTrashedNote(note)",
  'Retention period ended — review before permanent deletion',
  'Deletion time unavailable — kept until reviewed',
]) {
  if (!lifecycle.includes(marker)) failures.push(`Trash retention model is missing: ${marker}`);
}
for (const testName of [
  'separates active and trashed notes without mutating input',
  'marks retention ended without automatically deleting anything',
  'handles future timestamps without negative ages',
  'keeps invalid timestamps visible for manual review',
]) {
  if (!lifecycleTests.includes(testName)) failures.push(`Trash retention test is missing: ${testName}`);
}

for (const marker of [
  "useState<LibraryLifecycleView>('notes')",
  "filterNotesForLifecycle(notes, 'notes')",
  "filterNotesForLifecycle(notes, 'trash')",
  'Notes <span>',
  'Trash <span>',
  'Read-only: notes and exports remain available',
  "invoke(command, { id: note.id })",
  "'restore_skrib_note'",
  "'permanently_delete_skrib_note'",
  'Permanently delete “{noteDisplayTitle(selectedNote)}”?',
  'This removes the local record and cannot be undone.',
  'does not purge expired Trash automatically in this release',
  'Export complete backup',
]) {
  if (!library.includes(marker)) failures.push(`All Skribs lifecycle behavior is missing: ${marker}`);
}
for (const forbidden of ["invoke('focus_target_window'", "invoke('set_active_target'"]) {
  if (library.includes(forbidden)) failures.push(`Trash must not target external applications: ${forbidden}`);
}

for (const marker of [
  'let all_notes = state.coordinator.get_all_skribs();',
  'LibraryExportScope::CompleteBackup',
  'notes: Vec<SkribNote>',
]) {
  if (!nativeLibrary.includes(marker)) failures.push(`Lifecycle-aware export is missing: ${marker}`);
}

for (const marker of [
  '.library-lifecycle-tabs',
  '.library-trash-status',
  '.library-permanent-confirmation',
  '.library-button.danger',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  if (!styles.includes(marker)) failures.push(`Trash accessibility style is missing: ${marker}`);
}

for (const marker of [
  'authentic schema-v2 integrity',
  'does **not** run an automatic background purge',
  'Restore clears `deleted_at`',
  'persisted-mutation transaction',
  'Issues #20 and #21 remain open',
]) {
  if (!adr.includes(marker)) failures.push(`Trash ADR is missing: ${marker}`);
}
for (const marker of [
  'Physical Windows acceptance matrix',
  'Storage failure during Move to Trash',
  'Recover from backup generation containing Trash',
  'Upgrade a real schema-v2 database',
  'Issues #20 and #21 remain open',
]) {
  if (!acceptance.includes(marker)) failures.push(`Trash acceptance contract is missing: ${marker}`);
}

for (const marker of [
  'Ordinary Delete moves a saved note into local Trash',
  '30-day recovery period',
  'does not silently purge expired Trash',
  'Public downloads are disabled.',
]) {
  if (!privacy.includes(marker)) failures.push(`Privacy lifecycle truth is missing: ${marker}`);
}
for (const marker of [
  'Reversible 30-day local Trash',
  'Trash behavior in this release candidate',
  'this release does not silently purge them',
  'Add portable import with preview',
  'Public downloads are disabled.',
]) {
  if (!releaseNotes.includes(marker)) failures.push(`Development-note lifecycle truth is missing: ${marker}`);
}

for (const temporaryPath of [
  '.github/workflows/temp-trash-schema.yml',
  '.github/workflows/temp-trash-native-commands.yml',
  '.github/workflows/temp-trash-editor.yml',
  '.github/workflows/temp-v2-trash-migration.yml',
  '.github/workflows/temp-v2-trigger.yml',
]) {
  if (await exists(temporaryPath)) failures.push(`Temporary migration workflow remains: ${temporaryPath}`);
}

if (failures.length > 0) {
  console.error('Reversible Trash validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Reversible Trash validation passed.');
