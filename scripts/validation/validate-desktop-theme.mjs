import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const desktopManifest = JSON.parse(read('apps/desktop/package.json'));
const website = read('site/styles.css');
const tokens = read('packages/design-system/src/tokens.css');
const theme = read('apps/desktop/src/styles/website-theme.css');
const globalStyles = read('apps/desktop/src/styles/global.css');
const main = read('apps/desktop/src/main.tsx');

const requiredDependencies = {
  '@fontsource/dm-sans': '5.3.0',
  '@fontsource/manrope': '5.3.0',
  '@fontsource/kalam': '5.3.0',
};

for (const [name, version] of Object.entries(requiredDependencies)) {
  if (desktopManifest.dependencies?.[name] !== version) {
    throw new Error(`Desktop theme requires ${name} ${version}.`);
  }
}

const requiredTokens = [
  '--paper: #fffdf7',
  '--paper-deep: #f5f1e7',
  '--yellow: #f8df78',
  '--peach: #ffd5c4',
  '--mint: #dceadf',
  '--sky: #dce8f7',
  '--lavender: #e8def8',
  '--ink: #262923',
  '--muted: #6d7069',
  '--font-ui: "DM Sans"',
  '--font-display: "Manrope"',
  '--font-hand: "Kalam"',
];

for (const marker of requiredTokens) {
  if (!tokens.includes(marker)) throw new Error(`Desktop design tokens are missing ${marker}.`);
  if (marker.startsWith('--') && !marker.startsWith('--font-') && !website.includes(marker)) {
    throw new Error(`Desktop token ${marker} has drifted from the website palette.`);
  }
}

for (const marker of ['--scrollbar-track:', '--scrollbar-thumb:', '--scrollbar-thumb-hover:']) {
  if (!tokens.includes(marker)) throw new Error(`Desktop design tokens are missing ${marker}`);
}

for (const selector of ['*::-webkit-scrollbar', '*::-webkit-scrollbar-thumb', '*::-webkit-scrollbar-corner']) {
  if (!globalStyles.includes(selector)) throw new Error(`Desktop themed scrollbars are missing ${selector}.`);
}

const requiredThemeSurfaces = [
  '.account-page',
  '.skrib-composer',
  '.composer-textarea',
  '.library-shell',
  '.library-note-row-preview',
  '.library-note-paper p',
  '.library-import-panel',
  '.onboarding-panel',
  '.license-gate-panel',
  '.storage-recovery-panel',
  '.target-capture-error-panel',
  '.startup-failure-panel',
  '.startup-recovery-card',
  '[data-skribli-note-content]',
];

for (const selector of requiredThemeSurfaces) {
  if (!theme.includes(selector)) throw new Error(`Website-aligned theme is missing ${selector}.`);
}

for (const color of ['yellow', 'peach', 'mint', 'sky', 'lavender']) {
  if (!theme.includes(`.skrib-color-${color}`) || !theme.includes(`var(--${color})`)) {
    throw new Error(`Desktop note surfaces are missing the website ${color} pastel.`);
  }
}

if (!/\.composer-textarea,[\s\S]*font-family:\s*var\(--font-hand\)\s*!important/.test(theme)) {
  throw new Error('Sticky-note content must remain pinned to the Kalam handwriting stack.');
}

for (const fontImport of [
  '@fontsource/dm-sans/400.css',
  '@fontsource/manrope/700.css',
  '@fontsource/kalam/400.css',
]) {
  if (!main.includes(fontImport)) throw new Error(`Desktop entrypoint is missing ${fontImport}.`);
}

if (main.lastIndexOf('./styles/website-theme.css') < main.lastIndexOf('./styles/startup-recovery.css')) {
  throw new Error('The website-aligned desktop theme must load after feature styles.');
}

console.log('Desktop theme validated: website tokens, complete surface coverage, and Kalam note content.');
