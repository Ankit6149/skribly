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
  'styles.css',
  'ux-polish.css',
  'landing-typography.css',
  'site-refresh.css',
  'product-truth.css',
  'app.js',
  'commerce-config.js',
  'vercel.json',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'api/download.js',
  'assets/skribly-icon.svg',
  'assets/skribly-social-card.svg',
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
];

for (const htmlFile of htmlFiles) {
  const html = await readFile(join(root, htmlFile), 'utf8');
  if (!html.includes('<meta name="viewport"')) {
    failures.push(`${htmlFile} is missing a viewport meta tag.`);
  }
  if (!html.includes('skribly-icon.svg')) {
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
  'app.js',
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
  /\btrial\b/i,
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
if (!config.includes("status: 'release_candidate_validation'")) {
  failures.push('Site config must identify release-candidate validation.');
}
if (!config.includes("mode: 'pre_release_hold'")) {
  failures.push('Site config must keep downloads in pre_release_hold mode.');
}
if (!config.includes('enabled: false')) {
  failures.push('Site config must disable installer access.');
}
if (/endpoint:\s*['"]\/api\/(download|checkout)/i.test(config)) {
  failures.push('Site config must not expose an active installer or commercial endpoint.');
}

const landing = await readFile(join(root, 'index.html'), 'utf8');
for (const requiredSection of ['how-it-works', 'principles', 'features', 'audience', 'status']) {
  if (!landing.includes(`id="${requiredSection}"`)) {
    failures.push(`Landing page is missing required section #${requiredSection}.`);
  }
}

const requiredLandingTruth = [
  'release candidate in validation',
  'Downloads unavailable',
  'No floating remainder',
  'NEW NOTE FOR',
  'Saved locally',
  'Editor fully hides',
  'leaves no dot, tab, checklist, or floating widget after it closes.',
  'Floating dots, attached tabs, checklists',
  'Pre-release validation',
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

if (/href="\/api\/download"/i.test(landing)) {
  failures.push('Landing page must not contain an active installer link.');
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
  'Downloads unavailable',
  'Windows validation active',
  "payload.softwareVersion = 'Pre-release validation'",
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
if (/\/api\/(download|checkout)/i.test(app)) {
  failures.push('Landing script must not wire active installer or commercial routes.');
}

const answers = await readFile(join(root, 'answers.html'), 'utf8');
for (const fact of [
  'creates one empty note',
  'reopens that note',
  'Nothing from Skribli remains floating',
  'full-screen interactive overlay',
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
  'portable JSON import with mandatory preview and rollback backup',
]) {
  if (!privacy.includes(fact)) failures.push(`Privacy page is missing current limitation: ${fact}.`);
}

const downloadApi = await readFile(join(root, 'api/download.js'), 'utf8');
if (!downloadApi.includes("X-Skribli-Download-Status', 'pre-release-hold'")) {
  failures.push('Download route must expose the pre-release-hold status header.');
}
if (!downloadApi.includes('/download-unavailable?reason=validation')) {
  failures.push('Download route must redirect to the validation status page.');
}
if (/browser_download_url|api\.github\.com\/repos\/Ankit6149\/skribly\/releases/i.test(downloadApi)) {
  failures.push('Download route must not resolve a release asset during the pre-release hold.');
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
  'contextual typed-notes',
  'Windows',
  'Public downloads: disabled',
  'local-first',
  'does not ship floating note dots',
]) {
  if (!llms.toLowerCase().includes(fact.toLowerCase())) {
    failures.push(`llms.txt is missing current product fact: ${fact}.`);
  }
}

if (failures.length > 0) {
  console.error('Skribli site validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Skribli site validation passed (${requiredFiles.length} required files checked).`);
