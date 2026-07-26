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
const forbiddenPatterns = [
  /founder/i,
  /\balpha\b/i,
  /\bpricing\b/i,
  /\bprice\b/i,
  /₹/,
  /\bcheckout\b/i,
  /\bpurchase\b/i,
  /\bpaid\b/i,
  /\blicen[cs]e\b/i,
  /\btrial\b/i,
];

for (const file of customerFacingTextFiles) {
  const content = await readFile(join(root, file), 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file} contains commercial or legacy language matched by ${pattern}.`);
    }
  }
}

const config = await readFile(join(root, 'commerce-config.js'), 'utf8');
if (!config.includes("status: 'production_rebuild'")) {
  failures.push('Site config must identify the production rebuild.');
}
if (!config.includes("mode: 'production_hold'")) {
  failures.push('Site config must keep downloads in production_hold mode.');
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
for (const requiredText of [
  'Skribli is in production',
  'Downloads paused',
  'No permanent toolbar',
  'WHO IT HELPS',
  'Ordinary notes remember the text',
  'site-refresh.css',
  'data-skribly-schema',
  'href="/release-notes"',
  'href="/privacy"',
  'href="/answers"',
]) {
  if (!landing.includes(requiredText)) {
    failures.push(`Landing page is missing product marker: ${requiredText}`);
  }
}
if (/href="\/api\/download"/i.test(landing)) {
  failures.push('Landing page must not contain an active installer link.');
}

const refreshStyles = await readFile(join(root, 'site-refresh.css'), 'utf8');
if (!refreshStyles.includes("family=Kalam")) {
  failures.push('Landing refresh must load the handwritten note typeface.');
}
for (const selector of ['.demo-note p', '.handwritten-line', '.hero-scribble']) {
  if (!refreshStyles.includes(selector)) {
    failures.push(`Landing refresh is missing handwritten treatment for ${selector}.`);
  }
}

const app = await readFile(join(root, 'app.js'), 'utf8');
if (!app.includes('Skribli is in production') || !app.includes('Downloads paused')) {
  failures.push('Landing script must keep installer access visibly disabled.');
}
if (/\/api\/(download|checkout)/i.test(app)) {
  failures.push('Landing script must not wire active installer or commercial routes.');
}

const downloadApi = await readFile(join(root, 'api/download.js'), 'utf8');
if (!downloadApi.includes("X-Skribli-Download-Status', 'production-hold'")) {
  failures.push('Download route must expose the production-hold status header.');
}
if (!downloadApi.includes('/download-unavailable?reason=production')) {
  failures.push('Download route must redirect to the production status page.');
}
if (/browser_download_url|api\.github\.com\/repos\/Ankit6149\/skribly\/releases/i.test(downloadApi)) {
  failures.push('Download route must not resolve a release asset during the production hold.');
}

const releaseWorkflow = await readFile(join(repoRoot, '.github/workflows/release.yml'), 'utf8');
if (!releaseWorkflow.includes('Production Hold')) {
  failures.push('Release workflow must be visibly marked as a production hold.');
}
if (/softprops\/action-gh-release|tauri -- build|branches:\s*\n\s*- main/i.test(releaseWorkflow)) {
  failures.push('Release workflow must not automatically build or publish installers during the hold.');
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
for (const fact of ['contextual notes', 'Windows', 'public downloads: paused', 'local-first']) {
  if (!llms.toLowerCase().includes(fact.toLowerCase())) {
    failures.push(`llms.txt is missing a core production fact: ${fact}.`);
  }
}

if (failures.length > 0) {
  console.error('Skribli site validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Skribli site validation passed (${requiredFiles.length} required files checked).`);
