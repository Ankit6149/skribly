import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

const failures = [];
const nativeEntry = await read('apps/desktop/src-tauri/src/lib.rs');
const nativeLifecycle = await read('apps/desktop/src-tauri/src/note_lifecycle.rs');
const overlayHost = await read('apps/desktop/src/features/overlay/OverlayHost.tsx');
const composer = await read('apps/desktop/src/features/skribs/SkribComposer.tsx');
const frontendLifecycle = await read('apps/desktop/src/features/skribs/noteLifecycle.ts');
const lifecycleTests = await read('apps/desktop/src/features/skribs/noteLifecycle.test.ts');
const adr = await read('docs/02-engineering/ADR-0002-canonical-note-open-lifecycle.md');

// Rustfmt may wrap method chains across lines. These structural checks should
// validate the ordering rule, not fail merely because its formatting changed.
const compactNativeLifecycle = nativeLifecycle.replace(/\s+/g, '');

const requiredNativeContract = [
  'mod note_lifecycle;',
  'created_open_request',
  'reopened_open_request',
  'let open_request = if let Some(request)',
  'skribly://open-note-request',
];
for (const claim of requiredNativeContract) {
  if (!nativeEntry.includes(claim)) {
    failures.push(`Native shortcut opening is missing: ${claim}`);
  }
}

const requiredSelectionRules = [
  'pub enum OpenNoteAction',
  'Created',
  'Reopened',
  'pub struct OpenNoteRequest',
  'matching_note_count',
  'right.updated_at.cmp(&left.updated_at)',
  'right.created_at.cmp(&left.created_at)',
  'left.id.cmp(&right.id)',
  'zero_matches_require_creation',
  'many_matches_reopen_the_most_recent_note',
  'ties_are_stable_across_hash_map_iteration_order',
];
for (const claim of requiredSelectionRules) {
  if (!compactNativeLifecycle.includes(claim.replace(/\s+/g, ''))) {
    failures.push(`Native lifecycle selection is missing: ${claim}`);
  }
}

const requiredFrontendContract = [
  "listen<unknown>('skribly://open-note-request'",
  'isOpenNoteRequest(event.payload)',
  'selectRequestedNote(openNoteRequest, skribs)',
  'openComposer(requestedNote.id',
  "setComposerOpenAction(openNoteRequest.action)",
];
for (const claim of requiredFrontendContract) {
  if (!overlayHost.includes(claim)) {
    failures.push(`Frontend explicit-open handling is missing: ${claim}`);
  }
}

const retiredFrontendHeuristics = [
  'knownNoteIdsRef',
  'initialSnapshotTakenRef',
  'const created = skribs.find',
  'const noteToOpen = created ??',
  'sort((a, b) => b.updated_at - a.updated_at)[0]',
];
for (const pattern of retiredFrontendHeuristics) {
  if (overlayHost.includes(pattern)) {
    failures.push(`Retired array-change opening heuristic returned: ${pattern}`);
  }
}

const requiredRequestValidation = [
  "const OPEN_NOTE_REQUEST_KEYS = new Set(['action', 'noteId', 'matchingNoteCount'])",
  'Object.keys(record).some((key) => !OPEN_NOTE_REQUEST_KEYS.has(key))',
  "record.action === 'created' || record.action === 'reopened'",
  'notes.find((note) => note.id === request.noteId)',
];
for (const claim of requiredRequestValidation) {
  if (!frontendLifecycle.includes(claim)) {
    failures.push(`Frontend request validation is missing: ${claim}`);
  }
}

const privateRequestFields = ['targetTitle', 'targetProcess', 'targetPath', 'text', 'geometry'];
for (const field of privateRequestFields) {
  if (frontendLifecycle.includes(`${field}:`)) {
    failures.push(`OpenNoteRequest must not include private field: ${field}`);
  }
}

const requiredFrontendTests = [
  'accepts created and reopened requests',
  'rejects malformed or privacy-unsafe payloads',
  'opens only the exact native-requested note',
  'waits when the state payload has not arrived yet',
  'does nothing without an explicit request',
];
for (const claim of requiredFrontendTests) {
  if (!lifecycleTests.includes(claim)) {
    failures.push(`Frontend lifecycle tests are missing: ${claim}`);
  }
}

const requiredUserClarity = [
  "openAction === 'created'",
  'NEW SKRIB FOR',
  'REOPENED SKRIB FOR',
  'created a new empty Skrib for this application context',
  'reopened the existing Skrib for this application context',
];
for (const claim of requiredUserClarity) {
  if (!composer.includes(claim)) {
    failures.push(`Composer new-versus-reopened clarity is missing: ${claim}`);
  }
}

const requiredAdrClaims = [
  'one active text note per captured application context',
  'updated_at` descending',
  'The request intentionally excludes application titles',
  'Issue #20 remains open',
];
for (const claim of requiredAdrClaims) {
  if (!adr.includes(claim)) {
    failures.push(`Lifecycle ADR is missing required decision: ${claim}`);
  }
}

if (failures.length > 0) {
  console.error('Note lifecycle validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Note lifecycle validation passed.');
