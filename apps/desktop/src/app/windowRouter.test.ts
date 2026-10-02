import { describe, expect, it } from 'vitest';
import { classifyWindow, resolveWindowLabel } from './windowRouter';

describe('resolveWindowLabel', () => {
  it('uses the native label outside development previews', () => {
    expect(
      resolveWindowLabel({
        nativeLabel: 'home',
        isDev: false,
        search: '?skriblyWindow=rail&railMode=context',
      })
    ).toBe('home');
  });

  it('routes development rail previews without changing production labels', () => {
    expect(
      resolveWindowLabel({
        nativeLabel: 'main',
        isDev: true,
        search: '?skriblyWindow=rail',
      })
    ).toBe('rail');

    expect(
      resolveWindowLabel({
        nativeLabel: 'main',
        isDev: true,
        search: '?skriblyWindow=rail&railMode=context',
      })
    ).toBe('context-rail');

    expect(
      resolveWindowLabel({
        nativeLabel: 'main',
        isDev: true,
        search: '?skriblyWindow=global-rail-handle',
      })
    ).toBe('global-rail-handle');
  });

  it('falls back to the native label for unknown preview values', () => {
    expect(
      resolveWindowLabel({
        nativeLabel: 'main',
        isDev: true,
        search: '?skriblyWindow=unknown',
      })
    ).toBe('main');
  });
});

describe('classifyWindow', () => {
  it('classifies native window families for the app shell', () => {
    expect(classifyWindow('home')).toBe('home');
    expect(classifyWindow('rail')).toBe('rail');
    expect(classifyWindow('context-rail')).toBe('rail');
    expect(classifyWindow('global-rail-handle')).toBe('rail');
    expect(classifyWindow('main')).toBe('overlay');
  });
});
