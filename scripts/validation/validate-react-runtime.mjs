import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const desktopManifest = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'apps', 'desktop', 'package.json'), 'utf8'),
);
const lockfile = JSON.parse(readFileSync(resolve(repositoryRoot, 'package-lock.json'), 'utf8'));

const reactVersion = desktopManifest.dependencies?.react;
const reactDomVersion = desktopManifest.dependencies?.['react-dom'];
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (!exactVersion.test(reactVersion) || !exactVersion.test(reactDomVersion)) {
  throw new Error('Desktop React packages must use exact versions, not ranges.');
}

if (reactVersion !== reactDomVersion) {
  throw new Error(
    `Desktop React runtime mismatch: react ${reactVersion} does not match react-dom ${reactDomVersion}.`,
  );
}

const runtimePackages = Object.entries(lockfile.packages ?? {}).filter(([path]) =>
  /(?:^|\/)node_modules\/react(?:-dom)?$/.test(path),
);
const mismatches = runtimePackages.filter(([, value]) => value?.version !== reactVersion);

if (mismatches.length > 0) {
  const detail = mismatches.map(([path, value]) => `${path}: ${value?.version ?? 'unknown'}`).join(', ');
  throw new Error(`package-lock.json contains a split React runtime (${detail}). Run npm install.`);
}

console.log(`React runtime validated: react and react-dom ${reactVersion}.`);
