import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const desktopRoot = resolve(import.meta.dirname, '../../apps/desktop');
const distRoot = join(desktopRoot, 'dist');
const distHtml = await readFile(join(distRoot, 'index.html'), 'utf8');
const entryScripts = [...distHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)].map((match) => match[1]);
if (entryScripts.length === 0) throw new Error('Production entrypoint did not emit a JavaScript entry.');
const entryBundles = await Promise.all(entryScripts.map(async (path) => readFile(join(distRoot, path.replace(/^\//, '')), 'utf8')));
const emittedAssets = await readdir(join(distRoot, 'assets'));
const stylesheetPaths = emittedAssets
  .filter((path) => path.endsWith('.css'))
  .filter((path) => entryBundles.some((bundle) => bundle.includes(path)));
if (stylesheetPaths.length === 0) throw new Error('Production entrypoint did not reference an emitted stylesheet.');

const css = (await Promise.all(stylesheetPaths.map(async (path) => {
  return readFile(join(distRoot, 'assets', path), 'utf8');
}))).join('\n');

function computedSurfaceStyles(stylesheetText) {
  const html = `<!doctype html><html><head><style>${stylesheetText}</style></head><body>
    <div id="root"><main class="app-overlay-root"><article class="skrib-composer skrib-color-yellow"><div class="composer-textarea">Note fixture</div></article></main></div>
    <section class="library-import-panel">Import fixture</section>
  </body></html>`;
  const dom = new JSDOM(html);
  const transparentSurfaces = ['html', 'body', '#root', '.app-overlay-root'].map((selector) => {
    const value = dom.window.getComputedStyle(dom.window.document.querySelector(selector)).backgroundColor;
    return { selector, transparent: value === 'transparent' || value === 'rgba(0, 0, 0, 0)' };
  });
  const noteRadius = dom.window.getComputedStyle(dom.window.document.querySelector('.skrib-composer')).borderRadius;
  const importRadius = dom.window.getComputedStyle(dom.window.document.querySelector('.library-import-panel')).borderRadius;
  dom.window.close();
  return { transparentSurfaces, noteRadius, importRadius };
}

function assertCurrentSurfaceStyles(stylesheetText) {
  const styles = computedSurfaceStyles(stylesheetText);
  for (const surface of styles.transparentSurfaces) {
    assert.equal(surface.transparent, true, `${surface.selector} background must remain transparent`);
  }
  assert.equal(styles.noteRadius, '20px 20px 38px', 'note editor cascade changed');
  assert.equal(styles.importRadius, '28px 28px 46px', 'import panel cascade changed');
}

assertCurrentSurfaceStyles(css);
assert.throws(() => assertCurrentSurfaceStyles(`${css}\n.skrib-composer { border-radius: 3px; }`), /note editor cascade changed/);
assert.throws(
  () => assertCurrentSurfaceStyles(`${css}\nhtml, body, #root, .app-overlay-root { background: rgb(255, 0, 0) !important; }`),
  /background must remain transparent/
);

console.log(`Production CSS fixture validated ${stylesheetPaths.length} stylesheet(s), four transparent surfaces, note/import radii, and deliberate opaque/radius mutations across ${emittedAssets.length} emitted assets.`);
