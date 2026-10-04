import { createHash } from 'node:crypto';

const stripHtmlComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '');
const stripJsComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\r\n]*/g, '$1');

export function validateInterfaceLabRuntime(wrapper, runtimeHtml, runtimeScript) {
  const errors = [];
  const liveWrapper = stripHtmlComments(wrapper);
  const liveHtml = stripHtmlComments(runtimeHtml);
  const liveScript = stripJsComments(runtimeScript);

  if (!/fetch\(['"]\.\/interface-lab-v3\.html['"]/.test(liveWrapper)) {
    errors.push('the wrapper must fetch the v3 studio document.');
  }
  if (!/runtime\.src\s*=\s*['"]\.\/interface-lab-v3\.js['"]/.test(liveWrapper)) {
    errors.push('the wrapper must load the v3 runtime script.');
  }
  if (!/href\s*=\s*['"]\.\/interface-lab-v3\.css['"]/.test(liveHtml)) {
    errors.push('the studio document must load its v3 stylesheet.');
  }

  const requiredHtmlControls = [
    'data-studio="notes"',
    'data-studio="widgets"',
    'data-studio="screens"',
    'data-studio="system"',
    'data-studio-panel="notes"',
    'data-note-view="anatomy"',
    'data-note-view="heavy"',
    'data-tool="attach"',
    'data-tool="draw"',
    'data-tool="remind"',
    'id="scaleSelect"',
    'id="runtimeSelect"',
  ];
  for (const marker of requiredHtmlControls) {
    if (!liveHtml.includes(marker)) errors.push(`the loaded studio is missing live control ${marker}.`);
  }

  for (const requiredRuntime of [
    "$$('[data-studio]')",
    "$$('[data-note-view]')",
    "$('#scaleSelect')",
    "$('#runtimeSelect')",
  ]) {
    if (!liveScript.includes(requiredRuntime)) errors.push(`the v3 runtime is missing live binding ${requiredRuntime}.`);
  }

  return errors;
}

export function validateInterfaceLabAssetHashes(manifest, assets) {
  const errors = [];
  const requiredPaths = ['interface-lab-v3.html', 'interface-lab-v3.js', 'interface-lab-v3.css'];
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.assets)) {
    return ['the loaded asset manifest is missing or has an unsupported schema.'];
  }
  for (const path of requiredPaths) {
    const expected = manifest.assets.find((asset) => asset.path === path)?.sha256;
    const content = assets[path];
    if (!/^[a-f0-9]{64}$/i.test(expected ?? '') || content === undefined) {
      errors.push(`the loaded asset manifest is missing ${path}.`);
      continue;
    }
    const actual = createHash('sha256').update(content).digest('hex');
    if (actual !== expected.toLowerCase()) errors.push(`the loaded asset hash does not match ${path}.`);
  }
  return errors;
}
