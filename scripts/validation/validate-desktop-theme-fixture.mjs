import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const desktopRoot = resolve(import.meta.dirname, '../../apps/desktop');
const distRoot = join(desktopRoot, 'dist');
const distHtml = await readFile(join(distRoot, 'index.html'), 'utf8');
const stylesheetPaths = [...distHtml.matchAll(/href="([^"]+\.css)"/g)].map((match) => match[1]);
if (stylesheetPaths.length === 0) throw new Error('Production entrypoint did not emit a stylesheet.');

const css = (await Promise.all(stylesheetPaths.map(async (path) => {
  const normalized = path.replace(/^\//, '');
  return readFile(join(distRoot, normalized), 'utf8');
}))).join('\n');

function computedSurfaceStyles(stylesheetText) {
  const html = `<!doctype html><html><head><style>${stylesheetText}</style></head><body>
    <article class="skrib-composer skrib-color-yellow"><div class="composer-textarea">Note fixture</div></article>
    <section class="library-import-panel">Import fixture</section>
  </body></html>`;
  const dom = new JSDOM(html);
  const noteRadius = dom.window.getComputedStyle(dom.window.document.querySelector('.skrib-composer')).borderRadius;
  const importRadius = dom.window.getComputedStyle(dom.window.document.querySelector('.library-import-panel')).borderRadius;
  dom.window.close();
  return { noteRadius, importRadius };
}

function assertCurrentSurfaceStyles(stylesheetText) {
  const styles = computedSurfaceStyles(stylesheetText);
  assert.equal(styles.noteRadius, '14px 14px 20px 14px', 'note editor cascade changed');
  assert.equal(styles.importRadius, '28px 28px 46px 28px', 'import panel cascade changed');
}

assertCurrentSurfaceStyles(css);
assert.throws(() => assertCurrentSurfaceStyles(`${css}\n.skrib-composer { border-radius: 3px; }`), /note editor cascade changed/);

const emittedAssets = await readdir(join(distRoot, 'assets'));
console.log(`Production style fixture validated for ${stylesheetPaths.length} stylesheet(s) and ${emittedAssets.length} emitted assets; deliberate cascade mutation failed.`);
