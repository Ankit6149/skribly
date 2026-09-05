import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const failures = [];

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

const styles = await read('apps/desktop/src/styles/note-experience.css');
const globalStyles = await read('apps/desktop/src/styles/global.css');
const websiteTheme = await read('apps/desktop/src/styles/website-theme.css');
const composer = await read('apps/desktop/src/features/skribs/SkribComposer.tsx');
const collapsedDot = await read('apps/desktop/src/features/skribs/CollapsedSkribDot.tsx');
const overlayHost = await read('apps/desktop/src/features/overlay/OverlayHost.tsx');
const surfaceSelector = await read(
  'apps/desktop/src/features/onboarding/guidanceSurface.ts'
);
const surfaceTests = await read(
  'apps/desktop/src/features/onboarding/guidanceSurface.test.ts'
);
const nativePlacement = await read(
  'apps/desktop/src-tauri/src/platform/windows_placement.rs'
);
const nativeEntry = await read('apps/desktop/src-tauri/src/lib.rs');
const tauriConfig = JSON.parse(
  await read('apps/desktop/src-tauri/tauri.conf.json')
);
const desktopCapabilities = JSON.parse(
  await read('apps/desktop/src-tauri/capabilities/default.json')
);

for (const marker of [
  '--compact-surface-logical-width: 420px',
  '--compact-surface-logical-height: 360px',
  '--compact-surface-gutter: 4px',
  '--collapsed-dot-surface-size: 44px',
  '--collapsed-dot-diameter: 30px',
  '--collapsed-dot-bubble-left: 5px',
  '--collapsed-dot-bubble-top: 9px',
  '--collapsed-dot-open-size: 20px',
  '--collapsed-dot-open-left: 10px',
  '--collapsed-dot-open-top: 14px',
  '--collapsed-dot-open-notch-width: 2px',
  '--collapsed-dot-open-notch-height: 1px',
  '--collapsed-dot-dismiss-width: 12px',
  '--collapsed-dot-dismiss-height: 12px',
  '--collapsed-dot-dismiss-left: 28px',
  '--collapsed-dot-dismiss-top: 3px',
  'top: var(--collapsed-dot-open-top)',
  'left: var(--collapsed-dot-open-left)',
  'top: var(--collapsed-dot-dismiss-top)',
  'left: var(--collapsed-dot-dismiss-left)',
  'clip-path: polygon(',
  'padding: var(--compact-surface-gutter)',
  '.composer-drag-grip',
  '.collapsed-skrib-bubble',
  '.collapsed-skrib-drag-zone',
  '.collapsed-skrib-drag-top',
  '.collapsed-skrib-drag-left',
  '.collapsed-skrib-drag-right',
  '.collapsed-skrib-drag-bottom',
  '.collapsed-skrib-dismiss',
  ".collapsed-skrib-dot[data-error='dismiss'] .collapsed-skrib-dismiss",
  '.overlay-preparing-surface',
  '.overlay-preparing-note',
  '.overlay-preparing-pulse',
  '@media (prefers-reduced-motion: reduce)',
]) {
  if (!styles.includes(marker)) {
    failures.push(`Compact surface styles are missing: ${marker}`);
  }
}

for (const [source, marker] of [
  [composer, 'data-overlay-surface="composer"'],
  [composer, 'className="composer-drag-grip" data-tauri-drag-region'],
  [composer, "startResizeDragging(direction)"],
  [composer, 'className={`composer-resize-handle ${direction.toLowerCase()}`}'],
  [collapsedDot, 'data-overlay-surface="collapsed"'],
  [collapsedDot, 'className="collapsed-skrib-bubble"'],
  [collapsedDot, 'collapsed-skrib-drag-zone collapsed-skrib-drag-top'],
  [collapsedDot, 'collapsed-skrib-drag-zone collapsed-skrib-drag-left'],
  [collapsedDot, 'collapsed-skrib-drag-zone collapsed-skrib-drag-right'],
  [collapsedDot, 'collapsed-skrib-drag-zone collapsed-skrib-drag-bottom'],
  [collapsedDot, 'aria-label="Hide this floating Skrib"'],
  [collapsedDot, 'data-error={error?.action}'],
  [collapsedDot, 'data-opening={isOpening || undefined}'],
  [collapsedDot, 'aria-busy={isOpening}'],
  [collapsedDot, 'className="sr-only" role="alert"'],
  [collapsedDot, "invokeCommand('dismiss_collapsed_skrib_window', { id })"],
  [collapsedDot, 'event.stopPropagation()'],
  [overlayHost, 'data-overlay-surface="preparing"'],
  [overlayHost, 'aria-label="Skribli is preparing your note"'],
  [overlayHost, 'Getting your note ready…'],
  [surfaceSelector, "return 'preparing'"],
  [surfaceTests, 'never selects a visually empty surface'],
]) {
  if (!source.includes(marker)) failures.push(`Compact surface contract is missing: ${marker}`);
}

for (const marker of [
  'pub const COMPACT_WINDOW_LOGICAL_WIDTH: i32 = 420;',
  'pub const COMPACT_WINDOW_LOGICAL_HEIGHT: i32 = 360;',
  'pub const COLLAPSED_NOTE_LOGICAL_SIZE: i32 = 44;',
  'const COLLAPSED_NOTE_MAIN_REGION_LOGICAL_DIAMETER: i32 = 40;',
  'const COLLAPSED_NOTE_BADGE_REGION_LOGICAL_DIAMETER: i32 = 18;',
  'const COLLAPSED_NOTE_BADGE_REGION_LOGICAL_LEFT: i32 = 26;',
  'CreateEllipticRgn',
  'CombineRgn',
  'RGN_OR',
  'CreateRoundRectRgn',
  'SetWindowRgn',
  'native_dot_region_contains',
  'window.set_shadow(false)',
  'native_regions_hug_the_rounded_note_and_collapsed_dot',
  'recovery_surface_restores_compact_logical_dimensions_after_a_dot',
]) {
  if (!nativePlacement.includes(marker)) {
    failures.push(`Native compact surface contract is missing: ${marker}`);
  }
}

for (const marker of [
  'clear_active_target_and_hide_note',
  'VisibleNoteTargetEvent::Disconnect',
  'visible_note_destroy_event_disconnects_instead_of_being_skipped',
  'prepare_standard_compact_surface(&window)',
]) {
  if (!nativeEntry.includes(marker)) {
    failures.push(`Native empty-window lifecycle contract is missing: ${marker}`);
  }
}

const mainWindow = tauriConfig.app?.windows?.find((window) => window.label === 'main');
if (!mainWindow || mainWindow.transparent !== true || mainWindow.shadow !== false) {
  failures.push('The transparent main window must disable the rectangular native shadow.');
}

if (!mainWindow || mainWindow.resizable !== true) {
  failures.push('The note window must remain natively resizable from its corner handles.');
}

if (!desktopCapabilities.permissions?.includes('core:window:allow-start-dragging')) {
  failures.push('Desktop capabilities must allow note and collapsed-dot drag regions to move the window.');
}

if (!desktopCapabilities.permissions?.includes('core:window:allow-start-resize-dragging')) {
  failures.push('Desktop capabilities must allow the note corner handles to start native resizing.');
}

if (!composer.includes("surfaceSize === 'compact'") || !composer.includes("changeSurfaceSize('medium', true)")) {
  failures.push('Opening Calendar from a compact note must use the medium note surface.');
}

if (composer.includes('className="composer-tool-button primary-tool"')) {
  failures.push('Attachments must remain in the writing surface instead of returning to the top command bar.');
}

if (!globalStyles.includes('box-sizing: border-box')) {
  failures.push('Collapsed-control geometry requires global border-box sizing.');
}

function cssPixelVariable(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedName}:\\s*(\\d+(?:\\.\\d+)?)px`));
  if (!match) {
    failures.push(`Collapsed-control geometry is missing ${name}.`);
    return Number.NaN;
  }
  return Number(match[1]);
}

const dotSurfaceSize = cssPixelVariable('--collapsed-dot-surface-size');
const dotDiameter = cssPixelVariable('--collapsed-dot-diameter');
const bubble = {
  name: 'pastel bubble',
  x: cssPixelVariable('--collapsed-dot-bubble-left'),
  y: cssPixelVariable('--collapsed-dot-bubble-top'),
  width: dotDiameter,
  height: dotDiameter,
};
const reopenControl = {
  name: 'reopen',
  x: cssPixelVariable('--collapsed-dot-open-left'),
  y: cssPixelVariable('--collapsed-dot-open-top'),
  width: cssPixelVariable('--collapsed-dot-open-size'),
  height: cssPixelVariable('--collapsed-dot-open-size'),
};
const dismissControl = {
  name: 'dismiss badge',
  x: cssPixelVariable('--collapsed-dot-dismiss-left'),
  y: cssPixelVariable('--collapsed-dot-dismiss-top'),
  width: cssPixelVariable('--collapsed-dot-dismiss-width'),
  height: cssPixelVariable('--collapsed-dot-dismiss-height'),
};
const reopenNotch = {
  width: cssPixelVariable('--collapsed-dot-open-notch-width'),
  height: cssPixelVariable('--collapsed-dot-open-notch-height'),
};

function rectangleIsInside(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(first, second) {
  return first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
}

const nativeSurface = { x: 0, y: 0, width: dotSurfaceSize, height: dotSurfaceSize };
for (const item of [bubble, reopenControl, dismissControl]) {
  if (!rectangleIsInside(nativeSurface, item)) {
    failures.push(`The collapsed ${item.name} extends outside the 44px native surface.`);
  }
}
if (
  bubble.x !== 5 || bubble.y !== 9 || bubble.width !== 30 || bubble.height !== 30 ||
  dismissControl.x !== 28 || dismissControl.y !== 3 ||
  dismissControl.width !== 12 || dismissControl.height !== 12
) {
  failures.push('The collapsed notification geometry must retain its crisp 30px bubble and 12px close badge coordinates.');
}

const bubbleRadius = bubble.width / 2;
const bubbleCenter = { x: bubble.x + bubbleRadius, y: bubble.y + bubbleRadius };
const reopenCorners = [
  [reopenControl.x, reopenControl.y],
  [reopenControl.x + reopenControl.width, reopenControl.y],
  [reopenControl.x, reopenControl.y + reopenControl.height],
  [reopenControl.x + reopenControl.width, reopenControl.y + reopenControl.height],
];
if (!reopenCorners.every(([x, y]) =>
  Math.hypot(x - bubbleCenter.x, y - bubbleCenter.y) <= bubbleRadius
)) {
  failures.push('The transparent reopen control must remain inside the pastel bubble.');
}
if (!rectanglesOverlap(bubble, dismissControl)) {
  failures.push('The close badge must overlap the bubble like a notification dismissal badge.');
}

// The exact requested bounding boxes meet by 3×2px. The reopen clip-path removes that
// corner, leaving two hit rectangles which must not intersect the close badge.
const reopenHitRegions = [
  {
    ...reopenControl,
    width: reopenControl.width - reopenNotch.width,
    height: reopenNotch.height,
  },
  {
    ...reopenControl,
    y: reopenControl.y + reopenNotch.height,
    height: reopenControl.height - reopenNotch.height,
  },
];
if (reopenHitRegions.some((region) => rectanglesOverlap(region, dismissControl))) {
  failures.push('The clipped reopen hit target must not overlap the close badge.');
}

function cssRulePixel(selector, property) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'))?.[1];
  const match = rule?.match(new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)px`));
  if (!match) {
    failures.push(`Collapsed drag geometry is missing ${selector} ${property}.`);
    return Number.NaN;
  }
  return Number(match[1]);
}

const dragRegions = ['top', 'left', 'right', 'bottom'].map((edge) => {
  const selector = `.collapsed-skrib-drag-${edge}`;
  return {
    name: `${edge} drag region`,
    x: cssRulePixel(selector, 'left'),
    y: cssRulePixel(selector, 'top'),
    width: cssRulePixel(selector, 'width'),
    height: cssRulePixel(selector, 'height'),
  };
});
for (const dragRegion of dragRegions) {
  if (!rectangleIsInside(bubble, dragRegion)) {
    failures.push(`The collapsed ${dragRegion.name} must stay on the pastel bubble.`);
  }
  if (
    rectanglesOverlap(dragRegion, dismissControl) ||
    reopenHitRegions.some((region) => rectanglesOverlap(dragRegion, region))
  ) {
    failures.push(`The collapsed ${dragRegion.name} overlaps a button hit target.`);
  }
}

for (const color of ['yellow', 'peach', 'mint', 'sky', 'lavender', 'rose', 'aqua', 'sand']) {
  if (!styles.includes(`.skrib-color-${color} { --skribli-paper:`)) {
    failures.push(`Collapsed dots must retain the five-note palette; missing ${color}.`);
  }
}

if (overlayHost.includes('return null;')) {
  failures.push('OverlayHost must not leave a visible transparent native window empty.');
}

for (const [source, pattern, message] of [
  [styles, /\.skrib-composer-backdrop\s*\{[^}]*padding:\s*10px/s, '10px composer inset'],
  [styles, /\.collapsed-skrib-dot\s*\{[^}]*\b(?:width|height):\s*60px/s, '60px collapsed dot'],
  [styles, /\.skrib-composer\s*\{[^}]*box-shadow:\s*0\s+24px\s+70px/s, 'oversized composer shadow'],
  [websiteTheme, /\.skrib-composer\s*\{[^}]*box-shadow:\s*0\s+26px\s+70px/s, 'theme override with an oversized composer shadow'],
  [styles, /animation:\s*note-enter/, 'blank first-frame note animation'],
  [styles, /\.collapsed-skrib-drag-ring/, 'fussy dashed collapsed-dot ring'],
  [styles, /\.collapsed-skrib-error\s*\{/, 'clipped outside-dot error badge'],
  [styles, /\.collapsed-skrib-open-indicator/, 'central reopen indicator'],
  [collapsedDot, /collapsed-skrib-open-indicator/, 'central reopen indicator markup'],
  [collapsedDot, />\s*S\s*</, 'toy-like handwritten S in the collapsed control'],
]) {
  if (pattern.test(source)) failures.push(`Compact surface retained ${message}.`);
}

if (failures.length > 0) {
  console.error('Compact transparent-surface validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  'Compact surfaces validated: shaped 420x360 editor, 44px notification surface with a crisp 30px pastel bubble and 12px close badge, non-overlapping controls, and no empty visible fallback.'
);
