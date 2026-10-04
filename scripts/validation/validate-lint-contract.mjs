import { ESLint } from 'eslint';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: repoRoot });
const sources = await eslint.lintFiles(['apps/desktop/src/**/*.{ts,tsx}']);
const checkedFiles = sources.filter((result) => result.filePath.startsWith(resolve(repoRoot, 'apps/desktop/src')));

if (checkedFiles.length === 0) {
  throw new Error('Required desktop lint gate found no TypeScript or TSX source files.');
}

const invalidHook = await eslint.lintText(
  `import { useState } from 'react';\nexport function InvalidHook({ enabled }: { enabled: boolean }) {\n  if (enabled) useState(0);\n  return null;\n}`,
  { filePath: resolve(repoRoot, 'apps/desktop/src/__lint-invalid-hook-fixture__.tsx') }
);

if (!invalidHook.some((result) => result.messages.some((message) => message.ruleId === 'react-hooks/rules-of-hooks' && message.severity === 2))) {
  throw new Error('Required desktop lint gate did not reject its controlled invalid hook fixture.');
}

const validHook = await eslint.lintText(
  `import { useState } from 'react';\nexport function ValidHook() {\n  const [count] = useState(0);\n  return count;\n}`,
  { filePath: resolve(repoRoot, 'apps/desktop/src/__lint-valid-hook-fixture__.tsx') }
);

if (validHook.some((result) => result.messages.some((message) => message.ruleId === 'react-hooks/rules-of-hooks' && message.severity === 2))) {
  throw new Error('Required desktop lint gate rejected a valid hook fixture.');
}

console.log(`Required desktop lint configuration validated against ${checkedFiles.length} source files and controlled hook fixtures.`);
