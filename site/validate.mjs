import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(root, '..');
const requiredFiles = [
  'index.html',
  'answers.html',
  'privacy.html',
  'release-notes.html',
  'download-unavailable.html',
  'download-success.html',
  'v0-download.html',
  'interface-lab.html',
  'styles.css',
  'ux-polish.css',
  'landing-typography.css',
  'site-refresh.css',
  'product-truth.css',
  'app.js',
  'v0-download.js',
  'interface-lab.css',
  'interface-lab.js',
  'commerce-config.js',
  'vercel.json',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'assets/skribli-v0-windows.enc',
  'assets/skribly-note-mark-v2.svg',
  'assets/skribly-social-card-v2.svg',
  'assets/phosphor/regular/style.css',
  'assets/phosphor/regular/Phosphor.woff2',
  'assets/phosphor/fill/style.css',
  'assets/phosphor/fill/Phosphor-Fill.woff2',
];

const failures = [];

for (const file of requiredFiles) {
  try {
    await access(join(root, file));
  } catch {
    failures.push(`Missing required site file: ${file}`);
  }
}

const htmlFiles = [
  'index.html',
  'answers.html',
  'privacy.html',
  'release-notes.html',
  'download-unavailable.html',
  'download-success.html',
  'v0-download.html',
  'interface-lab.html',
];

for (const htmlFile of htmlFiles) {
  const html = await readFile(join(root, htmlFile), 'utf8');
  if (!html.includes('<meta name="viewport"')) {
    failures.push(`${htmlFile} is missing a viewport meta tag.`);
  }
  if (!html.includes('skribly-note-mark-v2.svg')) {
    failures.push(`${htmlFile} does not reference the Skribli icon.`);
  }
  if (/github\.com\/Ankit6149\/skribly/i.test(html)) {
    failures.push(`${htmlFile} must not expose the source repository as a customer journey.`);
  }

  const references = [...html.matchAll(/(?:href|src)="(\.\/[^"?#]*)(?:[?#][^"]*)?"/g)].map(
    (match) => match[1]
  );
  for (const reference of references) {
    if (reference === './' || reference === '.') continue;
    try {
      await access(resolve(root, reference));
    } catch {
      failures.push(`${htmlFile} references a missing local file: ${reference}`);
    }
  }
}

for (const canonicalPage of ['index.html', 'answers.html', 'privacy.html', 'release-notes.html']) {
  const html = await readFile(join(root, canonicalPage), 'utf8');
  if (!html.includes('rel="canonical"')) {
    failures.push(`${canonicalPage} is missing a canonical URL.`);
  }
}

const customerFacingTextFiles = [
  'index.html',
  'answers.html',
  'privacy.html',
  'release-notes.html',
  'download-unavailable.html',
  'download-success.html',
  'v0-download.html',
  'app.js',
  'v0-download.js',
  'commerce-config.js',
  'llms.txt',
  'README.md',
];

const forbiddenCommercialPatterns = [
  /founder/i,
  /\balpha\b/i,
  /\bpricing\b/i,
  /\bprice\b/i,
  /₹/,
  /\bcheckout\b/i,
  /\bpurchase\b/i,
  /\blicen[cs]e\b/i,
];

const retiredProductPatterns = [
  /Skribli is in production/i,
  /App in production/i,
  /Windows app\s*·\s*in production/i,
  /Active production development/i,
  /Production notes/i,
  /Production rebuild/i,
  /Selective click-through transparent overlay/i,
  /Close it into context/i,
  /close into a compact attached tab/i,
  /editor becomes a compact attached note/i,
  /empty overlay space (?:must )?remain click-through/i,
  /Everything outside the note remains available to click and use/i,
  /Leaves unrelated screen space interactive/i,
  /Open checklist note/i,
  /WORKFLOW NOTE/i,
];

for (const file of customerFacingTextFiles) {
  const content = await readFile(join(root, file), 'utf8');
  for (const pattern of forbiddenCommercialPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file} contains commercial or legacy language matched by ${pattern}.`);
    }
  }
  for (const pattern of retiredProductPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file} contains retired public product behavior matched by ${pattern}.`);
    }
  }
}

const config = await readFile(join(root, 'commerce-config.js'), 'utf8');
if (!config.includes("status: 'v0_owner_testing'")) {
  failures.push('Site config must identify owner-only v0 testing.');
}
if (!config.includes("mode: 'encrypted_download_key'")) {
  failures.push('Site config must keep downloads behind the encrypted owner key.');
}
if (!config.includes('enabled: true')) {
  failures.push('Site config must enable the owner-only installer journey.');
}
if (!config.includes("endpoint: '/v0-download'")) {
  failures.push('Site config must route owner access to the v0 key page.');
}

const landing = await readFile(join(root, 'index.html'), 'utf8');
for (const requiredSection of ['how-it-works', 'principles', 'features', 'audience', 'status']) {
  if (!landing.includes(`id="${requiredSection}"`)) {
    failures.push(`Landing page is missing required section #${requiredSection}.`);
  }
}

const requiredLandingTruth = [
  'v0 owner test',
  'Owner v0 access',
  'Movable collapsed dot',
  'NEW SKRIB FOR',
  'Saved locally',
  'Saved note folds into a dot',
  'folds a saved note into one movable pastel dot',
  'Multiple simultaneous note windows, screenshot pins, checklists',
  'Owner v0 testing',
  'contextual annotation layer for Windows',
  'A verified account tracks trial access',
  'product-truth.css',
  'data-skribly-schema',
  'href="/release-notes"',
  'href="/privacy"',
  'href="/answers"',
];
for (const requiredText of requiredLandingTruth) {
  if (!landing.includes(requiredText)) {
    failures.push(`Landing page is missing truthful product marker: ${requiredText}`);
  }
}

const retiredLandingMarkers = [
  'data-demo-dot',
  'data-demo-note',
  'demo-dot dot-yellow',
  'demo-dot dot-mint',
  'compact-note',
  'Selective click-through',
];
for (const marker of retiredLandingMarkers) {
  if (landing.includes(marker)) {
    failures.push(`Landing page still renders retired product marker: ${marker}`);
  }
}

if (!/href="\/v0-download"/i.test(landing)) {
  failures.push('Landing page must offer the owner v0 key journey.');
}

const productStyles = await readFile(join(root, 'product-truth.css'), 'utf8');
for (const selector of ['.compact-editor-demo', '.demo-flow', '.demo-done', '.hidden-chip']) {
  if (!productStyles.includes(selector)) {
    failures.push(`Truthful landing demonstration is missing style: ${selector}.`);
  }
}
if (!productStyles.includes('@media (prefers-reduced-motion: reduce)')) {
  failures.push('Truthful landing demonstration must respect reduced-motion preferences.');
}

const app = await readFile(join(root, 'app.js'), 'utf8');
for (const requiredScriptText of [
  'Owner v0 access',
  "payload.softwareVersion = 'v0 owner test'",
]) {
  if (!app.includes(requiredScriptText)) {
    failures.push(`Landing script is missing truthful disabled-state behavior: ${requiredScriptText}`);
  }
}
for (const retiredScriptMarker of ['data-demo-dot', 'data-close-demo', 'data-demo-note']) {
  if (app.includes(retiredScriptMarker)) {
    failures.push(`Landing script still controls retired floating-note demo: ${retiredScriptMarker}`);
  }
}
if (/\/api\/download/i.test(app)) {
  failures.push('Landing script must not bypass the owner v0 sign-in page.');
}

const answers = await readFile(join(root, 'answers.html'), 'utf8');
for (const fact of [
  'creates one empty note',
  'reopens that note',
  'folds it into one movable pastel dot',
  'one active note or dot at a time',
  'Public downloads are disabled',
]) {
  if (!answers.includes(fact)) failures.push(`FAQ is missing current behavior: ${fact}.`);
}

const developmentNotes = await readFile(join(root, 'release-notes.html'), 'utf8');
for (const fact of [
  'Development notes',
  'Implemented foundations',
  'The exact current workflow',
  'Open release gates',
  'Public downloads are disabled',
]) {
  if (!developmentNotes.includes(fact)) {
    failures.push(`Development notes are missing required section or fact: ${fact}.`);
  }
}

const privacy = await readFile(join(root, 'privacy.html'), 'utf8');
for (const fact of [
  'The current shortcut path does not record your screen.',
  'Public downloads are disabled.',
  'portable JSON import with mandatory preview and rollback',
  'This Skrib content is not uploaded to the account service.',
  'Changing account or reinstalling on the same device does not restart the device trial.',
]) {
  if (!privacy.includes(fact)) failures.push(`Privacy page is missing current limitation: ${fact}.`);
}

const ownerDownloadPage = await readFile(join(root, 'v0-download.html'), 'utf8');
for (const marker of ['data-v0-key-form', 'data-v0-key-status', './v0-download.js']) {
  if (!ownerDownloadPage.includes(marker)) failures.push(`Owner v0 page is missing: ${marker}`);
}
if (/type="email"|current-password|Supabase/i.test(ownerDownloadPage)) {
  failures.push('Owner v0 page must ask only for the download key.');
}

const ownerDownloadScript = await readFile(join(root, 'v0-download.js'), 'utf8');
for (const marker of [
  '/assets/skribli-v0-windows.enc',
  "'PBKDF2'",
  "'AES-GCM'",
  '210_000',
  "link.download = 'Skribli_0.1.16_x64-setup.exe'",
]) {
  if (!ownerDownloadScript.includes(marker)) failures.push(`Owner v0 client flow is missing: ${marker}`);
}
if (/supabase|\/api\/download|accessToken/i.test(ownerDownloadScript)) {
  failures.push('Owner v0 client must use only local key decryption.');
}

// The Interface Lab is a present-tense design/review contract, not a compatibility target for
// retired prototype concepts. Validate the surfaces and review fixtures we expect to keep current.
const interfaceLab = await readFile(join(root, 'interface-lab.html'), 'utf8');
const requiredInterfaceLabMarkers = [
  'data-view="overview"',
  'data-view="structure"',
  'data-view="motion"',
  'data-view="note"',
  'data-view="attachments"',
  'data-view="drawing"',
  'data-view="reminder"',
  'data-view="dot"',
  'data-view="rail"',
  'data-view="library"',
  'data-view="calendar"',
  'data-view="home"',
  'data-view="onboarding"',
  'data-view="account"',
  'data-view="recovery"',
  'data-view="matrix"',
  'data-note-tool="attach"',
  'data-note-tool="draw"',
  'data-note-tool="remind"',
  'data-rail-scope="here"',
  'data-rail-scope="all"',
  'id="labScale"',
  'id="labRuntime"',
  './interface-lab.js',
];
for (const marker of requiredInterfaceLabMarkers) {
  if (!interfaceLab.includes(marker)) failures.push(`Interface lab is missing current review marker: ${marker}`);
}
for (const retiredMarker of ['data-resize-corner', 'Pill and rail', 'data-add-attachment="Link"']) {
  if (interfaceLab.includes(retiredMarker)) failures.push(`Interface lab reintroduced retired prototype marker: ${retiredMarker}`);
}

const encryptedArtifact = await readFile(join(root, 'assets/skribli-v0-windows.enc'));
if (encryptedArtifact.length < 2_000_000 || encryptedArtifact.subarray(0, 8).toString('ascii') !== 'SKRV0E01') {
  failures.push('Encrypted v0 Windows artifact is missing or invalid.');
}

const releaseWorkflow = await readFile(join(repoRoot, '.github/workflows/release.yml'), 'utf8');
if (/softprops\/action-gh-release|tauri -- build|branches:\s*\n\s*- main/i.test(releaseWorkflow)) {
  failures.push('Release workflow must not automatically build or publish installers while downloads are disabled.');
}

const robots = await readFile(join(root, 'robots.txt'), 'utf8');
if (!robots.includes('Sitemap:')) failures.push('robots.txt must reference the sitemap.');

const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
for (const route of ['/', '/answers', '/privacy', '/release-notes']) {
  if (!sitemap.includes(`skribly-desktop.vercel.app${route}`)) {
    failures.push(`sitemap.xml is missing ${route}.`);
  }
}

const llms = await readFile(join(root, 'llms.txt'), 'utf8');
for (const fact of [
  'contextual annotation application',
  'Windows',
  'Public downloads: disabled',
  'local-first',
  'does not ship multiple simultaneous note windows/dots',
]) {
  if (!llms.toLowerCase().includes(fact.toLowerCase())) {
    failures.push(`llms.txt is missing current product fact: ${fact}.`);
  }
}

const canonicalMark = await readFile(join(repoRoot, 'assets/branding/skribly-app-icon.svg'), 'utf8');
const deployedMark = await readFile(join(root, 'assets/skribly-note-mark-v2.svg'), 'utf8');
const normalizeSvg = (value) => value.replace(/\r\n?/g, '\n').trim();
if (normalizeSvg(canonicalMark) !== normalizeSvg(deployedMark)) {
  failures.push('The cache-busted landing mark must exactly match the canonical blank folded note.');
}
for (const htmlFile of htmlFiles) {
  const html = await readFile(join(root, htmlFile), 'utf8');
  if (html.includes('skribly-icon.svg')) {
    failures.push(`${htmlFile} still references the stale pre-v2 icon URL.`);
  }
}

if (failures.length > 0) {
  console.error('Skribli site validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Skribli site validation passed (${requiredFiles.length} required files checked).`);
