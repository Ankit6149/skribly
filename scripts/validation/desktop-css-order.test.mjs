import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { validateDesktopStylePrecedence } from './desktop-css-order.mjs';

const root = resolve(import.meta.dirname, '../..');
const productionEntry = `
import { App } from './App';
import '../styles/global.css';
import '../styles/startup-recovery.css';
import '../styles/website-theme.css';
import '../features/notes/styles/living-paper-polish.css';
`;

test('production entrypoint keeps feature graph before theme and final note polish after theme', async () => {
  const valid = await validateDesktopStylePrecedence(root, productionEntry);
  assert.deepEqual(valid.errors, []);
  assert.ok(valid.appCssGraph.some((path) => path.endsWith('library.css')));
  assert.ok(valid.appCssGraph.some((path) => path.endsWith('widget.css')));
});

test('moving App below theme imports is rejected', async () => {
  const mutated = productionEntry.replace(
    `import { App } from './App';\n`,
    ''
  ) + `import { App } from './App';\n`;
  const result = await validateDesktopStylePrecedence(root, mutated);
  assert.ok(result.errors.some((error) => error.includes('before direct style imports')));
});

test('adding feature CSS after the final polish stylesheet is rejected', async () => {
  const mutated = productionEntry.replace(
    `import '../features/notes/styles/living-paper-polish.css';`,
    `import '../features/notes/styles/living-paper-polish.css';\nimport '../features/library/styles/library.css';`
  );
  const result = await validateDesktopStylePrecedence(root, mutated);
  assert.ok(result.errors.some((error) => error.includes('final production stylesheet')));
});
