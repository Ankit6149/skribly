import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { validateInterfaceLabAssetHashes, validateInterfaceLabRuntime } from './interface-lab-contract.mjs';

const validWrapper = `async () => { await fetch('./interface-lab-v3.html'); runtime.src = './interface-lab-v3.js'; }`;
const validHtml = `<link rel="stylesheet" href="./interface-lab-v3.css"><button data-studio="notes"></button><button data-studio="widgets"></button><button data-studio="screens"></button><button data-studio="system"></button><section data-studio-panel="notes"><button data-note-view="anatomy"></button><button data-note-view="heavy"></button><button data-tool="attach"></button><button data-tool="draw"></button><button data-tool="remind"></button><select id="scaleSelect"></select><select id="runtimeSelect"></select></section>`;
const validScript = `$$('[data-studio]'); $$('[data-note-view]'); $('#scaleSelect'); $('#runtimeSelect');`;

test('Interface Lab gate rejects missing live assets even when stale comments name them', () => {
  const errors = validateInterfaceLabRuntime(
    `<!-- fetch('./interface-lab-v3.html'); runtime.src = './interface-lab-v3.js'; -->`,
    `<!-- <link rel="stylesheet" href="./interface-lab-v3.css"> -->`,
    validScript
  );
  assert.ok(errors.some((error) => error.includes('wrapper must fetch')));
  assert.ok(errors.some((error) => error.includes('wrapper must load')));
  assert.ok(errors.some((error) => error.includes('must load its v3 stylesheet')));
});

test('Interface Lab gate rejects comment-only controls in the loaded studio', () => {
  const strippedStudio = validHtml.replace('data-studio="notes"', '');
  const errors = validateInterfaceLabRuntime(validWrapper, `<!-- <button data-studio="notes"> -->${strippedStudio}`, validScript);
  assert.ok(errors.some((error) => error.includes('missing live control data-studio="notes"')));
});

test('Interface Lab gate accepts the real wrapper, loaded controls, and runtime bindings', () => {
  assert.deepEqual(validateInterfaceLabRuntime(validWrapper, validHtml, validScript), []);
});

test('the checked-in Interface Lab studio script operates the actual controls', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('./interface-lab-v3.html', import.meta.url), 'utf8'),
    readFile(new URL('./interface-lab-v3.js', import.meta.url), 'utf8'),
  ]);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://fixture.invalid/interface-lab-v3.html' });
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  dom.window.scrollTo = () => {};
  dom.window.eval(script);

  const widgets = dom.window.document.querySelector('[data-studio="widgets"]');
  widgets.click();
  assert.ok(widgets.classList.contains('is-active'));
  assert.ok(dom.window.document.querySelector('[data-studio-panel="widgets"]').classList.contains('is-active'));

  const scale = dom.window.document.querySelector('#scaleSelect');
  scale.value = '125%';
  scale.dispatchEvent(new dom.window.Event('change'));
  assert.ok(dom.window.document.body.classList.contains('scale-125'));

  const runtime = dom.window.document.querySelector('#runtimeSelect');
  runtime.value = 'offline';
  runtime.dispatchEvent(new dom.window.Event('change'));
  assert.ok(dom.window.document.body.classList.contains('runtime-offline'));
  dom.window.close();
});

test('Interface Lab asset gate rejects changed live HTML/JS/CSS bytes', () => {
  const html = Buffer.from('<main>studio</main>');
  const script = Buffer.from('boot();');
  const css = Buffer.from('.studio{display:block}');
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const manifest = { schema_version: 1, assets: [
    { path: 'interface-lab-v3.html', sha256: digest(html) },
    { path: 'interface-lab-v3.js', sha256: digest(script) },
    { path: 'interface-lab-v3.css', sha256: digest(css) },
  ] };
  assert.deepEqual(validateInterfaceLabAssetHashes(manifest, {
    'interface-lab-v3.html': html,
    'interface-lab-v3.js': script,
    'interface-lab-v3.css': css,
  }), []);
  assert.ok(validateInterfaceLabAssetHashes(manifest, {
    'interface-lab-v3.html': html,
    'interface-lab-v3.js': Buffer.from('missing-control();'),
    'interface-lab-v3.css': css,
  }).some((error) => error.includes('interface-lab-v3.js')));
});

test('Interface Lab integrity hashes exact LF bytes and rejects CRLF conversion for every asset', () => {
  const assets = {
    'interface-lab-v3.html': Buffer.from('<main>studio</main>\n'),
    'interface-lab-v3.js': Buffer.from('boot();\n'),
    'interface-lab-v3.css': Buffer.from('.studio{display:block}\n'),
  };
  const manifest = { schema_version: 1, assets: Object.entries(assets).map(([path, bytes]) => ({
    path, sha256: createHash('sha256').update(bytes).digest('hex'),
  })) };
  assert.deepEqual(validateInterfaceLabAssetHashes(manifest, assets), []);
  for (const [path, bytes] of Object.entries(assets)) {
    const converted = Buffer.from(bytes.toString('utf8').replace(/\n/g, '\r\n'));
    const errors = validateInterfaceLabAssetHashes(manifest, { ...assets, [path]: converted });
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes(path));
  }
});
