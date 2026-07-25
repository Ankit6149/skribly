import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const requiredFiles = [
  'index.html',
  'download-success.html',
  'styles.css',
  'success.css',
  'app.js',
  'success.js',
  'commerce-config.js',
  'vercel.json',
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

const htmlFiles = ['index.html', 'download-success.html'];
for (const htmlFile of htmlFiles) {
  const html = await readFile(join(root, htmlFile), 'utf8');
  if (!html.includes('<meta name="viewport"')) {
    failures.push(`${htmlFile} is missing a viewport meta tag.`);
  }
  if (!html.includes('skribly-icon.svg')) {
    failures.push(`${htmlFile} does not reference the Skribly icon.`);
  }

  const references = [...html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)].map((match) => match[1]);
  for (const reference of references) {
    const absolute = resolve(root, reference);
    try {
      await access(absolute);
    } catch {
      failures.push(`${htmlFile} references a missing local file: ${reference}`);
    }
  }
}

const config = await readFile(join(root, 'commerce-config.js'), 'utf8');
if (/secret|private[_-]?key|api[_-]?key\s*:/i.test(config)) {
  failures.push('commerce-config.js appears to contain a secret-like field. Public config must contain no secrets.');
}
if (!config.includes("mode: 'public_release'")) {
  failures.push('Founder Alpha site must remain in public_release mode until gated entitlement delivery exists.');
}
if (!config.includes('checkout.enabled') && !config.includes('enabled: false')) {
  failures.push('commerce-config.js must explicitly define checkout enablement.');
}

const landing = await readFile(join(root, 'index.html'), 'utf8');
for (const requiredSection of ['how-it-works', 'features', 'privacy', 'pricing', 'download']) {
  if (!landing.includes(`id="${requiredSection}"`)) {
    failures.push(`Landing page is missing required section #${requiredSection}.`);
  }
}

if (failures.length > 0) {
  console.error('Skribly site validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Skribly site validation passed (${requiredFiles.length} required files checked).`);
