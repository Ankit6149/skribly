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

const tauriConfig = JSON.parse(await read('apps/desktop/src-tauri/tauri.conf.json'));
const capabilities = JSON.parse(
  await read('apps/desktop/src-tauri/capabilities/default.json')
);
const app = await read('apps/desktop/src/App.tsx');
const tray = await read('apps/desktop/src-tauri/src/desktop/tray.rs');
const nativeLibrary = await read('apps/desktop/src-tauri/src/desktop/library.rs');
const libraryHost = await read('apps/desktop/src/features/library/LibraryHost.tsx');
const libraryModel = await read('apps/desktop/src/features/library/libraryModel.ts');
const libraryModelTests = await read(
  'apps/desktop/src/features/library/libraryModel.test.ts'
);
const libraryExport = await read('apps/desktop/src/features/library/libraryExport.ts');
const libraryExportTests = await read(
  'apps/desktop/src/features/library/libraryExport.test.ts'
);
const uiStore = await read('apps/desktop/src/stores/skribUiStore.ts');
const styles = await read('apps/desktop/src/styles/library.css');
const acceptance = await read('docs/04-operations/ALL_SKRIBS_ACCEPTANCE.md');

const windows = tauriConfig?.app?.windows ?? [];
const mainWindow = windows.find((window) => window.label === 'main');
const libraryWindow = windows.find((window) => window.label === 'library');

if (!mainWindow) failures.push('Tauri config is missing the compact main window.');
if (!libraryWindow) failures.push('Tauri config is missing the normal library window.');
if (windows.filter((window) => window.label === 'library').length !== 1) {
  failures.push('Tauri config must define exactly one library window.');
}

if (libraryWindow) {
  const requiredLibraryConfig = {
    visible: false,
    decorations: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
  };
  for (const [key, expected] of Object.entries(requiredLibraryConfig)) {
    if (libraryWindow[key] !== expected) {
      failures.push(`Library window must set ${key} to ${expected}.`);
    }
  }
  if ((libraryWindow.minWidth ?? 0) < 700 || (libraryWindow.minHeight ?? 0) < 500) {
    failures.push('Library window minimum dimensions must protect the two-pane layout.');
  }
}

for (const label of ['main', 'library']) {
  if (!capabilities.windows?.includes(label)) {
    failures.push(`Desktop capability must include the ${label} window.`);
  }
}

const requiredAppRouting = [
  "windowLabel === 'library'",
  '<LibraryHost />',
  '<OverlayHost />',
  "document.documentElement.dataset.skriblyWindow = windowLabel",
];
for (const marker of requiredAppRouting) {
  if (!app.includes(marker)) failures.push(`App window routing is missing: ${marker}`);
}

const requiredTrayContract = [
  'const ALL_SKRIBS_ID',
  '"All Skribs"',
  'TrayAction::OpenAllSkribs',
  'window.unminimize()',
  'window.show()',
  'window.set_focus()',
  'install_library_bridge(app)',
  'tray_actions_are_classified_without_side_effects',
];
for (const marker of requiredTrayContract) {
  if (!tray.includes(marker)) failures.push(`Tray library contract is missing: ${marker}`);
}

const requiredNativeExport = [
  'LIBRARY_EXPORT_SCHEMA_VERSION: u32 = 1',
  'LibraryExportScope::Selected',
  'LibraryExportScope::CompleteBackup',
  '#[serde(rename_all = "camelCase", deny_unknown_fields)]',
  'OpenOptions::new()',
  '.create_new(true)',
  'file.sync_all()',
  'select_notes_for_export',
  'sort_notes_for_library',
  'repeated_timestamp_never_overwrites_an_existing_export',
  'export_round_trips_versioned_json',
  'CloseRequested',
  'api.prevent_close()',
  'window_to_hide.hide()',
];
for (const marker of requiredNativeExport) {
  if (!nativeLibrary.includes(marker)) {
    failures.push(`Native library/export contract is missing: ${marker}`);
  }
}

const forbiddenNativeExport = [
  'require_global_write_access',
  'remove_skrib',
  'update_skrib_text',
  'focus_external_window',
];
for (const marker of forbiddenNativeExport) {
  if (nativeLibrary.includes(marker)) {
    failures.push(`Read/export library must not include mutation or focus path: ${marker}`);
  }
}

const requiredLibraryHost = [
  "invoke<SkribNote[]>('get_all_skribs')",
  '.onFocusChanged',
  'filterLibraryNotes(notes, query)',
  'role="listbox"',
  'aria-selected={selected}',
  'READ-ONLY LIBRARY VIEW',
  'Export this note',
  'Export complete backup',
  'All Skribs never launches or guesses the original application',
  'LIBRARY_EXPORT_REQUEST_EVENT',
  'LIBRARY_EXPORT_RESULT_EVENT',
];
for (const marker of requiredLibraryHost) {
  if (!libraryHost.includes(marker)) {
    failures.push(`Library host is missing required behavior: ${marker}`);
  }
}

const forbiddenLibraryHost = [
  "invoke('focus_target_window'",
  "invoke('set_active_target'",
  'position: fixed',
  'alwaysOnTop',
];
for (const marker of forbiddenLibraryHost) {
  if (libraryHost.includes(marker)) {
    failures.push(`Library host must not target or float over applications: ${marker}`);
  }
}

const requiredModelRules = [
  "normalize('NFKC')",
  'right.updated_at - left.updated_at',
  'right.created_at - left.created_at',
  'left.id.localeCompare(right.id)',
  'note.text, note.target_process_name, note.target_title',
];
for (const marker of requiredModelRules) {
  if (!libraryModel.includes(marker)) failures.push(`Library model is missing: ${marker}`);
}

for (const testName of [
  'orders by updated time, created time, then stable ID',
  'searches note text, process, and context title case-insensitively',
  'normalizes equivalent unicode forms',
  'falls back safely when note text is empty',
]) {
  if (!libraryModelTests.includes(testName)) {
    failures.push(`Library model tests are missing: ${testName}`);
  }
}

for (const marker of [
  "const RESULT_KEYS = new Set(['requestId', 'path', 'error'])",
  'Object.keys(record).some((key) => !RESULT_KEYS.has(key))',
  'crypto.randomUUID()',
]) {
  if (!libraryExport.includes(marker)) {
    failures.push(`Frontend export contract is missing: ${marker}`);
  }
}
for (const testName of [
  'accepts successful and failed native results',
  'rejects malformed, ambiguous, or expanded payloads',
  'deduplicates selected note IDs without mutating the input',
]) {
  if (!libraryExportTests.includes(testName)) {
    failures.push(`Frontend export tests are missing: ${testName}`);
  }
}

if (await exists('apps/desktop/src/features/skribs/NotesWidget.tsx')) {
  failures.push('Retired floating NotesWidget.tsx must not exist.');
}
for (const retiredState of [
  'previewNoteId',
  'isNotesWidgetOpen',
  'widgetNoteId',
  'openNotesWidget',
  'toggleNotesWidget',
]) {
  if (uiStore.includes(retiredState)) {
    failures.push(`Retired floating widget state returned: ${retiredState}`);
  }
}

for (const marker of [
  "html[data-skribly-window='library']",
  '.library-workspace',
  '.library-note-row.selected',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  if (!styles.includes(marker)) failures.push(`Library styles are missing: ${marker}`);
}

for (const marker of [
  'two separate Windows surfaces',
  'never becomes a floating widget',
  'create_new` semantics',
  'Physical Windows acceptance matrix',
  'Issues #21, #49, and #53 remain open',
]) {
  if (!acceptance.includes(marker)) {
    failures.push(`All Skribs acceptance contract is missing: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('All Skribs validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('All Skribs validation passed.');
