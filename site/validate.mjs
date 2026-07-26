import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const requiredFiles = [
  'index.html',
  'answers.html',
  'privacy.html',
  'release-notes.html',
  'download-unavailable.html',
  'download-success.html',
  'styles.css',
  'success.css',
  'app.js',
  'success.js',
  'commerce-config.js',
  'vercel.json',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'api/download.js',
  'api/checkout.js',
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
    failures.push(`${htmlFile} must not expose the source repository as the customer journey.`);
  }

  const references = [...html.matchAll(/(?:href|src)="(\.\/[^"?#]*)(?:[?#][^"]*)?"/g)].map(
    (match) => match[1]
  );
  for (const reference of references) {
    if (reference === './' || reference === '.') continue;
    const absolute = resolve(root, reference);
    try {
      await access(absolute);
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

const config = await readFile(join(root, 'commerce-config.js'), 'utf8');
const secretAssignmentPattern =
  /(?:secret|private[_-]?key|api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/i;
if (secretAssignmentPattern.test(config)) {
  failures.push('commerce-config.js appears to contain a secret-like field. Public config must contain no secrets.');
}
if (!config.includes("mode: 'controlled_trial'")) {
  failures.push('The site must use controlled_trial mode rather than a public repository release page.');
}
if (!config.includes("endpoint: '/api/download'")) {
  failures.push('The public download must route through /api/download.');
}
if (!config.includes("endpoint: '/api/checkout'")) {
  failures.push('Checkout must route through the provider-neutral /api/checkout endpoint.');
}
if (!config.includes('enforcedInApp: false')) {
  failures.push('The beta must state truthfully whether the trial is enforced in the desktop app.');
}

const landing = await readFile(join(root, 'index.html'), 'utf8');
for (const requiredSection of ['how-it-works', 'features', 'privacy', 'pricing', 'download']) {
  if (!landing.includes(`id="${requiredSection}"`)) {
    failures.push(`Landing page is missing required section #${requiredSection}.`);
  }
}
for (const requiredText of [
  'PERSONAL WINDOWS LICENCE',
  'data-founder-price>999',
  'href="/api/download"',
  'href="/release-notes"',
  'href="/privacy"',
  'href="/answers"',
  'data-skribly-schema',
]) {
  if (!landing.includes(requiredText)) {
    failures.push(`Landing page is missing required commercial/search marker: ${requiredText}`);
  }
}
if (/Founder Alpha|data-founder-price>499/i.test(landing)) {
  failures.push('Landing page contains obsolete Founder Alpha or ₹499 copy.');
}

const app = await readFile(join(root, 'app.js'), 'utf8');
if (!app.includes("'/api/download'") || !app.includes("'/api/checkout'")) {
  failures.push('The customer journey must use same-site download and checkout routes.');
}

const downloadApi = await readFile(join(root, 'api/download.js'), 'utf8');
for (const privateDeliveryMarker of [
  'SKRIBLY_GITHUB_TOKEN',
  "application/octet-stream",
  "redirect: 'manual'",
  'asset.url',
]) {
  if (!downloadApi.includes(privateDeliveryMarker)) {
    failures.push(`The download route is missing private-release delivery support: ${privateDeliveryMarker}`);
  }
}
if (downloadApi.includes('response.redirect(302, asset.browser_download_url)')) {
  failures.push('The private release path must not always send customers to browser_download_url.');
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
for (const fact of ['contextual notes', 'Windows', 'seven-day full trial', 'one-time']) {
  if (!llms.toLowerCase().includes(fact.toLowerCase())) {
    failures.push(`llms.txt is missing a core answer-engine fact: ${fact}.`);
  }
}

if (failures.length > 0) {
  console.error('Skribli site validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Skribli site validation passed (${requiredFiles.length} required files checked).`);
