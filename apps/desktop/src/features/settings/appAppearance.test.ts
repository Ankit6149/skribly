// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readAppAppearance, saveAppAppearance } from './appAppearance';
const key = 'skribli.app-appearance.v1';
beforeEach(() => { window.localStorage.clear(); readAppAppearance(); });
describe('local app logo preferences', () => {
  it('persists the color choice and a bounded raster override', () => {
    saveAppAppearance({ version: 1, quietIcons: false, customIcons: { 'code.exe': 'data:image/png;base64,YQ==' } });
    expect(readAppAppearance()).toEqual({ version: 1, quietIcons: false, customIcons: { 'code.exe': 'data:image/png;base64,YQ==' } });
  });
  it('rejects remote URLs, SVG and oversized overrides without losing the color choice', () => {
    window.localStorage.setItem(key, JSON.stringify({ version: 1, quietIcons: false, customIcons: {
      'remote.exe': 'https://example.invalid/logo.png', 'svg.exe': 'data:image/svg+xml;base64,YQ==',
      'large.exe': `data:image/png;base64,${'a'.repeat(180_001)}`,
    } }));
    expect(readAppAppearance().customIcons).toEqual({});
    expect(readAppAppearance().quietIcons).toBe(false);
  });
  it('falls back safely without rewriting unsupported versions', () => {
    const raw = JSON.stringify({ version: 2, quietIcons: false, customIcons: {} });
    window.localStorage.setItem(key, raw);
    expect(readAppAppearance().quietIcons).toBe(true);
    expect(window.localStorage.getItem(key)).toBe(raw);
  });
});
