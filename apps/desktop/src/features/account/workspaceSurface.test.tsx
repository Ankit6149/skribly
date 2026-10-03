import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AccountSetupSurface, HomeHost, ReadySurface, SettingsSurface, WorkspaceSidebar } from './HomeHost';
import { LibraryHost } from '../library/LibraryHost';

const accountState = vi.hoisted(() => ({
  phase: 'ready' as string,
  email: 'owner@example.test',
  accountRole: 'owner',
  productUpdatesOptIn: false,
  entitlement: { canWrite: true, mode: 'licensed' },
  announcements: [],
  message: 'Service unavailable',
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  retry: vi.fn(),
  resetToSignIn: vi.fn(),
  clearMessage: vi.fn(),
  init: vi.fn(),
}));
vi.mock('./state/accountStore', () => ({
  useAccountStore: () => accountState,
}));

describe('new desktop workspace integration', () => {
  it('opens the new Ready surface without pulling settings into daily work', () => {
    const html = renderToStaticMarkup(<ReadySurface onNavigate={vi.fn()} />);
    expect(html).toContain('Leave the window. Keep the thought.');
    expect(html).toContain('Find a Skrib');
    expect(html).not.toContain('Start a new Skrib every time');
    expect(html).not.toContain('Sign out');
  });

  it('labels the account check honestly until storage health returns', () => {
    const html = renderToStaticMarkup(<ReadySurface onNavigate={vi.fn()} />);
    expect(html).toContain('Checking local storage');
    expect(html).not.toContain('Local storage verified');
  });

  it('uses ordinary pressed buttons for account mode selection', () => {
    const html = renderToStaticMarkup(<AccountSetupSurface />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('role="tablist"');
  });

  it('keeps local workspace navigation available after an account service error', () => {
    accountState.phase = 'error';
    const html = renderToStaticMarkup(<HomeHost />);
    expect(html).toContain('Local Find and export remain available');
    expect(html).toContain('Find');
    expect(html).not.toContain('Back to sign in');
    accountState.phase = 'ready';
  });

  it('keeps the existing note preference in the new Settings surface', () => {
    const html = renderToStaticMarkup(
      <SettingsSurface onOpenFindView={vi.fn()} onShowGuide={vi.fn()} />
    );
    expect(html).toContain('Everyday behavior');
    expect(html).toContain('Start a new Skrib every time');
    expect(html).toContain('Account &amp; device');
  });

  it('selects one destination in the new sidebar', () => {
    const html = renderToStaticMarkup(
      <WorkspaceSidebar active="settings" onNavigate={vi.fn()} onShowGuide={vi.fn()} />
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('Ready');
    expect(html).toContain('Find');
    expect(html).toContain('Reminders');
    expect(html).toContain('Settings');
  });

  it.each(['archive', 'trash'] as const)('shows a requested %s view without echoing stale navigation', (view) => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(<LibraryHost request={{ view }} onViewChange={onChange} />);
    expect(html).toContain('<h1 id="library-title">Find</h1>');
    expect(html).toContain(`Search ${view === 'archive' ? 'archived' : 'trashed'} notes`);
    expect(html).toContain('aria-label="All Skribs lifecycle views"');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('retains lifecycle navigation when the library is used on its own', () => {
    const html = renderToStaticMarkup(<LibraryHost request={{ view: 'notes' }} />);
    expect(html).toContain('aria-label="All Skribs lifecycle views"');
  });
});
