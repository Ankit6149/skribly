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
const readme = await read('README.md');
const cargoManifest = await read('apps/desktop/src-tauri/Cargo.toml');
const processEntry = await read('apps/desktop/src-tauri/src/main.rs');
const nativeEntry = await read('apps/desktop/src-tauri/src/lib.rs');
const windowsPlatform = await read('apps/desktop/src-tauri/src/platform/windows.rs');
const windowsPlacement = await read('apps/desktop/src-tauri/src/platform/windows_placement.rs');
const windowsSingleInstance = await read('apps/desktop/src-tauri/src/windows_single_instance.rs');
const placementAcceptance = await read('docs/04-operations/WINDOW_PLACEMENT_ACCEPTANCE.md');
const singleInstanceAcceptance = await read('docs/04-operations/SINGLE_INSTANCE_ACCEPTANCE.md');

const requiredReadmeClaims = [
  'Skribli hides only after the latest non-empty draft is durably saved.',
  'A compact note editor opens inside that target monitor’s usable work area.',
  'Launching Skribli again in the same Windows user session signals the existing process',
  'The current build does **not** leave a floating dot, attached tab, permanent toolbar, or full-screen interactive overlay',
  'macOS support;',
  'Skribli is **not currently available for download**.',
];

for (const claim of requiredReadmeClaims) {
  if (!readme.includes(claim)) {
    failures.push(`README.md is missing required current-product claim: ${claim}`);
  }
}

const retiredReadmeClaims = [
  'Close it into a small attached note tab.',
  'The transparent overlay must remain click-through everywhere except the exact note or editor bounds.',
  'empty overlay space does not capture mouse input',
  'Native `RegisterHotKey`, WinEvent hooks, per-monitor DPI handling, and selective `WM_NCHITTEST` click-through',
];

for (const claim of retiredReadmeClaims) {
  if (readme.includes(claim)) {
    failures.push(`README.md contains retired product behavior: ${claim}`);
  }
}

const expectedCargoDescription = 'description = "Local-first contextual typed notes for Windows"';
if (!cargoManifest.includes(expectedCargoDescription)) {
  failures.push(`Cargo package description must be: ${expectedCargoDescription}`);
}

if (/^description\s*=.*macOS/im.test(cargoManifest)) {
  failures.push('Cargo package description must not claim current macOS support.');
}

const requiredPlacementImplementation = [
  'MonitorFromWindow',
  'MONITOR_DEFAULTTONEAREST',
  'GetMonitorInfoW',
  'monitor_info.rcWork',
  'calculate_compact_window_placement',
  'position_compact_window_for_target',
];
for (const claim of requiredPlacementImplementation) {
  if (!windowsPlacement.includes(claim)) {
    failures.push(`Windows placement implementation is missing required behavior: ${claim}`);
  }
}

const retiredPlacementSymbols = [
  'get_virtual_screen_bounds',
  'verify_overlay_bounds',
  'attempt_overlay_bounds_initialization',
  'initialize_overlay_with_retry',
];
for (const symbol of retiredPlacementSymbols) {
  if (nativeEntry.includes(symbol) || windowsPlatform.includes(symbol)) {
    failures.push(`Retired virtual-desktop placement symbol returned: ${symbol}`);
  }
}

if (!nativeEntry.includes('reposition_compact_window')) {
  failures.push('The native compact editor must expose the reposition command.');
}

if (!placementAcceptance.includes('Parent issue 19 remains open')) {
  failures.push('Placement acceptance documentation must state that physical runtime evidence is still required.');
}

const requiredSingleInstanceImplementation = [
  'CreateMutexW',
  'ERROR_ALREADY_EXISTS',
  'Local\\\\app.skribly.desktop.single-instance.2026-08',
  'EnumWindows',
  'PostMessageW',
  'WM_HOTKEY',
  'GLOBAL_HOTKEY_ID',
  'SingleInstanceOutcome::SecondarySignalled',
];
for (const claim of requiredSingleInstanceImplementation) {
  if (!windowsSingleInstance.includes(claim)) {
    failures.push(`Windows single-instance implementation is missing required behavior: ${claim}`);
  }
}

const guardPosition = processEntry.indexOf('acquire_or_signal_existing');
const runtimePosition = processEntry.indexOf('skribly_lib::run()');
if (guardPosition < 0 || runtimePosition < 0 || guardPosition > runtimePosition) {
  failures.push('The Windows single-instance guard must run before the Tauri library runtime.');
}

if (!processEntry.includes('SingleInstanceOutcome::Primary(guard)')) {
  failures.push('The primary process must retain the single-instance guard for the runtime lifetime.');
}

if (!singleInstanceAcceptance.includes('Parent issue 15 remains open')) {
  failures.push('Single-instance acceptance documentation must state that physical lifecycle evidence is still required.');
}

if (failures.length > 0) {
  console.error('Product truth validation failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Product truth validation passed.');
