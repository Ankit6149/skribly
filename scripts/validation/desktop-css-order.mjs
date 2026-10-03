import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

export function parseStaticImports(source) {
  return [...source.matchAll(/^\s*import\s+(?:(?:[^'";]*?)\s+from\s+)?['"]([^'"]+)['"]\s*;?/gm)]
    .map((match) => match[1]);
}

async function collectFeatureStyles(entryPath, visited = new Set(), styles = []) {
  const entry = resolve(entryPath);
  if (visited.has(entry)) return styles;
  visited.add(entry);

  let source;
  try {
    source = await readFile(entry, 'utf8');
  } catch {
    return styles;
  }

  for (const specifier of parseStaticImports(source)) {
    if (!specifier.startsWith('.')) continue;
    const imported = resolve(dirname(entry), specifier);
    if (extname(specifier) === '.css') {
      if (!styles.includes(imported)) styles.push(imported);
      continue;
    }

    for (const candidate of [imported, `${imported}.tsx`, `${imported}.ts`, `${imported}.jsx`, `${imported}.js`, resolve(imported, 'index.tsx'), resolve(imported, 'index.ts')]) {
      try {
        await readFile(candidate, 'utf8');
        await collectFeatureStyles(candidate, visited, styles);
        break;
      } catch {
        // Continue through the supported extension candidates.
      }
    }
  }
  return styles;
}

export async function validateDesktopStylePrecedence(repositoryRoot, mainSource) {
  const errors = [];
  const imports = parseStaticImports(mainSource);
  const appIndex = imports.indexOf('./App');
  const cssImports = imports.filter((specifier) => specifier.endsWith('.css') && !specifier.startsWith('@fontsource/'));
  const firstCssIndex = imports.findIndex((specifier) => specifier.endsWith('.css') && !specifier.startsWith('@fontsource/'));
  const themeIndex = imports.indexOf('../styles/website-theme.css');
  const recoveryIndex = imports.indexOf('../styles/startup-recovery.css');
  const finalPolishIndex = imports.indexOf('../features/notes/styles/living-paper-polish.css');

  if (appIndex < 0 || firstCssIndex < 0 || appIndex > firstCssIndex) {
    errors.push('App and its transitive feature styles must enter the production graph before direct style imports.');
  }
  if (themeIndex < 0 || recoveryIndex < 0 || themeIndex < recoveryIndex) {
    errors.push('The website theme must load after startup and recovery styles.');
  }
  if (finalPolishIndex < 0 || finalPolishIndex !== imports.length - 1 || finalPolishIndex < themeIndex) {
    errors.push('Living Paper note polish must remain the final production stylesheet after the website theme.');
  }

  if (themeIndex >= 0) {
    const cssAfterThemeBeforeFinal = cssImports.filter((specifier) => {
      const index = imports.indexOf(specifier);
      return index > themeIndex && index !== finalPolishIndex;
    });
    if (cssAfterThemeBeforeFinal.length > 0) {
      errors.push(`Feature CSS after the website theme bypasses the intended precedence: ${cssAfterThemeBeforeFinal.join(', ')}.`);
    }
  }

  const appCssGraph = appIndex >= 0
    ? await collectFeatureStyles(resolve(repositoryRoot, 'apps/desktop/src/app/App.tsx'))
    : [];
  if (appCssGraph.length === 0) errors.push('App feature style graph could not be resolved.');
  if (appCssGraph.some((stylePath) => stylePath.startsWith(resolve(repositoryRoot, 'apps/desktop/src/styles/website-theme.css')))) {
    errors.push('The website theme must not be imported by the App feature graph.');
  }

  return { errors, appCssGraph, imports };
}
