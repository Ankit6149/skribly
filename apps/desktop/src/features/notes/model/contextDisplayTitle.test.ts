import { describe, expect, it } from 'vitest';
import { contextDisplayTitle } from './contextDisplayTitle';

describe('automatic saved-place headings', () => {
  it.each([
    ['SkribComposer.tsx — skribli-desktop — Visual Studio Code', 'Code.exe', 'skribli-desktop'],
    ['● index.ts - Project [WSL: Ubuntu] - Visual Studio Code [Administrator]', 'Code.exe', 'Project [WSL: Ubuntu]'],
    ['Folder with-hyphens — Visual Studio Code', 'Code.exe', 'Folder with-hyphens'],
    ['Issue #66 · GitHub - Google Chrome', 'chrome.exe', 'Issue #66 · GitHub'],
    ['A title – with a dash - Google Chrome', 'chrome.exe', 'A title – with a dash'],
    ['References - File Explorer', 'explorer.exe', 'References'],
    ['Google Chrome', 'chrome.exe', 'Chrome'],
    ['', '', 'General'],
  ])('shows %s as %s', (title, process, expected) => {
    expect(contextDisplayTitle(title, process)).toBe(expected);
  });
});

