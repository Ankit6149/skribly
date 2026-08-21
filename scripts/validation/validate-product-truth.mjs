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
const windowsEvents = await read('apps/desktop/src-tauri/src/platform/windows_events.rs');
const windowsPlacement = await read('apps/desktop/src-tauri/src/platform/windows_placement.rs');
const windowsTargetCapture = await read(
  'apps/desktop/src-tauri/src/platform/windows_target_capture.rs'
);
const windowsSingleInstance = await read('apps/desktop/src-tauri/src/windows_single_instance.rs');
const tray = await read('apps/desktop/src-tauri/src/desktop/tray.rs');
const overlayHost = await read('apps/desktop/src/features/overlay/OverlayHost.tsx');
const homeHost = await read('apps/desktop/src/features/account/HomeHost.tsx');
const accountClient = await read('apps/desktop/src/features/account/accountClient.ts');
const accountStore = await read('apps/desktop/src/stores/accountStore.ts');
const accountNative = await read('apps/desktop/src-tauri/src/core/account.rs');
const licenseNative = await read('apps/desktop/src-tauri/src/core/license.rs');
const tauriConfig = JSON.parse(await read('apps/desktop/src-tauri/tauri.conf.json'));
const captureErrorSurface = await read(
  'apps/desktop/src/features/overlay/TargetCaptureErrorSurface.tsx'
);
const captureErrorModel = await read(
  'apps/desktop/src/features/overlay/targetCaptureError.ts'
);
const onboardingState = await read(
  'apps/desktop/src/features/onboarding/onboardingState.ts'
);
const onboardingSurface = await read(
  'apps/desktop/src/features/onboarding/OnboardingSurface.tsx'
);
const startupFailureSurface = await read(
  'apps/desktop/src/features/onboarding/StartupFailureSurface.tsx'
);
const guidanceSurface = await read(
  'apps/desktop/src/features/onboarding/guidanceSurface.ts'
);
const placementAcceptance = await read('docs/04-operations/WINDOW_PLACEMENT_ACCEPTANCE.md');
const singleInstanceAcceptance = await read('docs/04-operations/SINGLE_INSTANCE_ACCEPTANCE.md');
const winEventAcceptance = await read('docs/04-operations/WIN_EVENT_ACCEPTANCE.md');
const targetCaptureAcceptance = await read('docs/04-operations/TARGET_CAPTURE_ACCEPTANCE.md');
const firstRunAcceptance = await read('docs/04-operations/FIRST_RUN_ACCEPTANCE.md');
const architecture = await read('docs/02-engineering/ARCHITECTURE.md');
const provisionalStackAdr = await read('docs/02-engineering/adr/ADR-001-provisional-stack.md');
const interactionSpec = await read('docs/01-design/INTERACTION_SPEC.md');
const componentInventory = await read('docs/01-design/COMPONENT_INVENTORY.md');
const designDirection = await read('docs/01-design/DESIGN_DIRECTION.md');
const decisionLog = await read('docs/06-planning/DECISION_LOG.md');
const historicalAudit = await read(
  'docs/06-planning/FULL_PRODUCT_AUDIT_AND_EXECUTION_PLAN.md'
);
const historicalOverlayGate = await read(
  'docs/07-validation/windows-overlay-verification.md'
);

const requiredReadmeClaims = [
  'A normal launch always opens the visible **Skribli Home** window.',
  'The guide creates no sample Skrib and can be reopened later from **Quick guide** in the tray.',
  'A verified account is mandatory for write access',
  'Changing accounts or reinstalling on the same Windows device does not restart that device’s trial.',
  'Skribli collapses the saved note into a movable pastel dot only after the latest draft is durable.',
  'A compact note editor opens inside that target monitor’s usable work area.',
  'Skribli captures the foreground target once, clears any previous runtime target, and revalidates the exact HWND and process identity before using it.',
  'Skribli shows one actionable compact message, clears the previous target, and does not create, reopen, move, or focus a note.',
  'Launching Skribli again in the same Windows user session restores the existing Home window',
  'Windows accessibility events use bounded, non-blocking delivery with callback-side filtering and duplicate coalescing.',
  'The current build leaves one movable collapsed dot for the active Skrib.',
  'ordinary deletion is reversible through Trash',
  'A normal non-floating **All Skribs** window',
  'Reversible Trash with 30-day recovery guidance',
  'Portable JSON import with strict validation',
  'macOS support;',
  'Skribli is **not currently available as a public download**.',
];

for (const claim of requiredReadmeClaims) {
  if (!readme.includes(claim)) {
    failures.push(`README.md is missing required current-product claim: ${claim}`);
  }
}

const retiredReadmeClaims = [
  '**Status — active production development**',
  'Close it into a small attached note tab.',
  'The transparent overlay must remain click-through everywhere except the exact note or editor bounds.',
  'empty overlay space does not capture mouse input',
  'Native `RegisterHotKey`, WinEvent hooks, per-monitor DPI handling, and selective `WM_NCHITTEST` click-through',
  'Two-step explicit confirmation before the current irreversible delete operation.',
  'reversible trash, complete All Skribs library, physical Windows acceptance',
];

for (const claim of retiredReadmeClaims) {
  if (readme.includes(claim)) {
    failures.push(`README.md contains retired product behavior: ${claim}`);
  }
}

const requiredCurrentDocumentation = [
  [architecture, 'Windows v0 source of truth', 'architecture'],
  [architecture, 'The durable source of truth is a versioned, integrity-checked local JSON envelope', 'architecture'],
  [architecture, 'one active contextual note/dot with text, drawing, local attachments, one-time reminders, and a linked calendar', 'architecture'],
  [architecture, 'Ink strokes, attachment blobs, and reminder records are not yet included in native portable JSON export/import.', 'architecture'],
  [architecture, 'SQLite is a possible future migration, not the current store.', 'architecture'],
  [provisionalStackAdr, 'Superseded historical spike', 'provisional stack ADR'],
  [interactionSpec, 'canonical Founder Alpha interaction contract', 'interaction specification'],
  [interactionSpec, 'Zero active matches creates one note', 'interaction specification'],
  [interactionSpec, '**Move to Trash** is the ordinary delete action', 'interaction specification'],
  [interactionSpec, 'Portable import', 'interaction specification'],
  [interactionSpec, 'The editor exposes **Type**, **Draw**, **Files**, and **Reminder** tools.', 'interaction specification'],
  [interactionSpec, 'every scrollable desktop surface uses the themed scrollbar tokens', 'interaction specification'],
  [interactionSpec, 'Explicitly deferred interactions', 'interaction specification'],
  [componentInventory, 'Implemented foundations under #21', 'component inventory'],
  [componentInventory, 'strict portable JSON preview', 'component inventory'],
  [componentInventory, 'Remaining work under #21, #61, #79, and #82', 'component inventory'],
  [designDirection, 'there is no interactive full-screen overlay', 'design direction'],
  [designDirection, 'contains no letterform', 'design direction'],
  [decisionLog, 'Founder Alpha is Windows-only', 'decision log'],
  [decisionLog, 'Ordinary deletion moves saved notes to reversible Trash', 'decision log'],
  [decisionLog, 'Portable JSON import requires non-mutating preview', 'decision log'],
  [historicalAudit, 'Historical audit snapshot — not a description of the current code tree.', 'historical audit'],
  [historicalAudit, 'Current reconciliation note — 9 August 2026', 'historical audit'],
  [historicalOverlayGate, 'Superseded architecture — do not use this as the current release checklist.', 'historical overlay gate'],
];

for (const [document, claim, label] of requiredCurrentDocumentation) {
  if (!document.includes(claim)) {
    failures.push(`The ${label} is missing current-product truth: ${claim}`);
  }
}

const forbiddenCurrentDocumentation = [
  [architecture, 'SQLite is the durable source of truth.', 'architecture'],
  [architecture, 'The initial Windows technical proof has been fully implemented:', 'architecture'],
  [architecture, 'Windows and macOS implementations expose the same operations:', 'architecture'],
  [interactionSpec, '- macOS: `Control + Shift + Space`', 'interaction specification'],
  [interactionSpec, 'Tool palette appears near the pointer.', 'interaction specification'],
  [interactionSpec, 'Default overlay state:', 'interaction specification'],
  [componentInventory, '- trash pending;', 'component inventory'],
  [componentInventory, '- import/migration pending;', 'component inventory'],
  [designDirection, 'Empty overlay space must remain click-through.', 'design direction'],
  [designDirection, 'Closing or completing the editor hides the complete editor instead of leaving a collapsed dot or tab.', 'design direction'],
  [decisionLog, 'Windows and macOS are first-class targets | Current', 'decision log'],
];

for (const [document, claim, label] of forbiddenCurrentDocumentation) {
  if (document.includes(claim)) {
    failures.push(`The ${label} contains superseded current-product behavior: ${claim}`);
  }
}

const expectedCargoDescription = 'description = "Local-first contextual annotations for Windows"';
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
  'FindWindowW',
  'ShowWindow',
  'SetForegroundWindow',
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

const requiredWinEventImplementation = [
  'sync_channel',
  'WIN_EVENT_QUEUE_CAPACITY',
  'try_send',
  'active_target_hwnd',
  'pending: Mutex<HashSet<WinEventKey>>',
  'coalesced',
  'saturated',
  'disconnected',
  'processed',
];
for (const claim of requiredWinEventImplementation) {
  if (!windowsEvents.includes(claim)) {
    failures.push(`Windows event delivery is missing required bounded behavior: ${claim}`);
  }
}

const retiredWinEventPatterns = [
  'std::sync::mpsc::Sender<WinEventNotice>',
  'static EVENT_SENDER',
  'sender.send(notice)',
];
for (const pattern of retiredWinEventPatterns) {
  if (
    nativeEntry.includes(pattern) ||
    windowsPlatform.includes(pattern) ||
    windowsEvents.includes(pattern)
  ) {
    failures.push(`Retired unbounded or blocking WinEvent delivery returned: ${pattern}`);
  }
}

if (!nativeEntry.includes('WinEventPipeline::new(WIN_EVENT_QUEUE_CAPACITY)')) {
  failures.push('The runtime must create the bounded WinEvent pipeline with the approved capacity.');
}

if (!windowsPlatform.includes('deliver_global_win_event')) {
  failures.push('The native WinEvent callback must delegate to the bounded delivery pipeline.');
}

if (!winEventAcceptance.includes('Parent issue 17 remains open')) {
  failures.push('WinEvent acceptance documentation must state that physical runtime evidence is still required.');
}

const requiredTargetCaptureImplementation = [
  'GetForegroundWindow',
  'GetWindowThreadProcessId',
  'CAPTURE_SEQUENCE',
  'capture_foreground_target',
  'revalidate_captured_target',
  'process_identity_matches',
  'TargetCaptureErrorCode',
  'MAX_CAPTURE_AGE',
];
for (const claim of requiredTargetCaptureImplementation) {
  if (!windowsTargetCapture.includes(claim)) {
    failures.push(`Windows target capture is missing required fail-closed behavior: ${claim}`);
  }
}

const requiredShortcutFlow = [
  'native_window_operation_gate.lock()',
  'clear_active_target_and_hide_note_locked(&app_handle_hk, &state_hk);',
  'capture_foreground_target()',
  'revalidate_captured_target(&capture)',
  'present_target_capture_error',
  'skribly://target-capture-error',
  'skribly://target-capture-clear',
];
for (const claim of requiredShortcutFlow) {
  if (!nativeEntry.includes(claim)) {
    failures.push(`The shortcut path is missing required capture safety: ${claim}`);
  }
}

const retryOverlayStart = nativeEntry.indexOf('fn retry_overlay_initialization(');
const retryOverlayEnd = nativeEntry.indexOf('\nfn reposition_compact_window(', retryOverlayStart);
const retryOverlayFlow =
  retryOverlayStart >= 0 && retryOverlayEnd > retryOverlayStart
    ? nativeEntry.slice(retryOverlayStart, retryOverlayEnd)
    : '';
if (
  !retryOverlayFlow.includes('native_window_operation_gate.lock()') ||
  !retryOverlayFlow.includes('initialize_native_overlay(&app_handle, &state, &window)')
) {
  failures.push(
    'Overlay initialization retry must hold the native-window operation gate through HWND initialization.'
  );
}

const retiredTargetFallbacks = [
  '.or_else(|| coordinator_hk.get_active_target())',
  'get_foreground_target_window()\n                                    .or_else',
];
for (const pattern of retiredTargetFallbacks) {
  if (nativeEntry.includes(pattern)) {
    failures.push(`Retired stale-target shortcut fallback returned: ${pattern}`);
  }
}

if (!overlayHost.includes("listen<TargetCaptureErrorPayload>('skribly://target-capture-error'")) {
  failures.push('The hidden compact window must listen for typed target-capture failures.');
}

const requiredCaptureErrorUi = [
  'NO NOTE WAS OPENED',
  'Skribli cleared the previous target',
  'role="alert"',
  'Ctrl',
  'Shift',
  'Space',
];
for (const claim of requiredCaptureErrorUi) {
  if (!captureErrorSurface.includes(claim)) {
    failures.push(`The capture recovery surface is missing required guidance: ${claim}`);
  }
}

if (!captureErrorModel.includes('processIdentityChanged')) {
  failures.push('The frontend capture-error model must include recycled-process identity failure.');
}

if (!targetCaptureAcceptance.includes('Parent issue 18 remains open')) {
  failures.push('Target-capture acceptance must keep the durable context parent open.');
}

const requiredOnboardingState = [
  'ONBOARDING_VERSION = 2',
  "export type OnboardingStatus = 'unseen' | 'shown' | 'completed'",
  'markOnboardingShown',
  'completeOnboarding',
  "return status === 'unseen'",
];
for (const claim of requiredOnboardingState) {
  if (!onboardingState.includes(claim)) {
    failures.push(`First-run state is missing required versioned behavior: ${claim}`);
  }
}

const requiredOnboardingGuidance = [
  'Your first Skrib takes one shortcut.',
  'Focus the application',
  'Press the shortcut',
  'Type, then choose Done',
  'Private by default',
  'not screen recording',
  'Quit Skribli',
  'Continue to Skribli home',
  'Review later',
];
for (const claim of requiredOnboardingGuidance) {
  if (!onboardingSurface.includes(claim)) {
    failures.push(`First-run guidance is missing required user education: ${claim}`);
  }
}

const requiredStartupFailureUi = [
  'The shortcut is not ready yet.',
  'Your existing local Skribs remain protected.',
  'Retry setup',
  'Hide',
  'role="alert"',
];
for (const claim of requiredStartupFailureUi) {
  if (!startupFailureSurface.includes(claim)) {
    failures.push(`Startup failure guidance is missing required behavior: ${claim}`);
  }
}

const requiredSurfacePriority = [
  "if (input.storageSurface === 'composer') return 'composer'",
  "if (input.storageSurface === 'recovery') return 'recovery'",
  "if (input.initStatus.type === 'Failed') return 'startupFailure'",
  "if (input.hasCaptureError) return 'captureError'",
  "if (input.onboardingVisible) return 'onboarding'",
];
for (const claim of requiredSurfacePriority) {
  if (!guidanceSurface.includes(claim)) {
    failures.push(`Compact-window decision hierarchy is missing: ${claim}`);
  }
}

const requiredOnboardingRuntime = [
  "listen('skribly://show-onboarding'",
  'readOnboardingStatus(window.localStorage)',
  'markOnboardingShown(window.localStorage)',
  'completeOnboarding(window.localStorage)',
  "phase !== 'ready'",
  'setGuideVisible(true)',
];
for (const claim of requiredOnboardingRuntime) {
  if (!homeHost.includes(claim)) {
    failures.push(`The first-run runtime is missing required visible behavior: ${claim}`);
  }
}

const requiredTrayGuide = [
  'QUICK_GUIDE_ID',
  '"Quick guide"',
  'skribly://show-onboarding',
  'get_webview_window("home")',
  'window.show()',
  'window.set_focus()',
  '"Quit Skribli"',
];
for (const claim of requiredTrayGuide) {
  if (!tray.includes(claim)) {
    failures.push(`The tray is missing required onboarding re-entry behavior: ${claim}`);
  }
}

const requiredAccountFirstRuntime = [
  [tauriConfig.app?.windows?.some((window) => window.label === 'home' && window.visible === true), 'a visible Home window'],
  [accountClient.includes('protectedSessionStorage'), 'protected session adapter'],
  [accountNative.includes('CryptProtectData'), 'Windows user-scoped session protection'],
  [accountNative.includes('MachineGuid'), 'stable privacy-minimized device claim'],
  [licenseNative.includes('AccountRequired'), 'account-required native write gate'],
  [licenseNative.includes('offline_until'), 'bounded offline entitlement'],
  [accountStore.includes("phase: 'verificationPending'"), 'verified-email setup state'],
  [homeHost.includes('Changing accounts on this device does not restart its trial.'), 'device trial explanation'],
];
for (const [present, label] of requiredAccountFirstRuntime) {
  if (!present) failures.push(`The account-first launch is missing ${label}.`);
}

if (!firstRunAcceptance.includes('Parent issue 51 remains open')) {
  failures.push('First-run acceptance documentation must keep the broader onboarding parent open.');
}

if (failures.length > 0) {
  console.error('Product truth validation failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Product truth validation passed.');
