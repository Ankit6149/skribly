import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReadySurface, SettingsSurface, WorkspaceSidebar } from './HomeHost';
import { LibraryHost } from '../library/LibraryHost';

vi.mock('./state/accountStore', () => ({
  useAccountStore: () => ({
    email: 'owner@example.test', accountRole: 'owner', productUpdatesOptIn: false,
    entitlement: { canWrite: true, mode: 'licensed' }, announcements: [], signOut: vi.fn(),
  }),
}));

describe('new desktop workspace integration', () => {
  it('opens the new Ready surface without pulling settings into daily work', () => {
    const html = renderToStaticMarkup(<ReadySurface onNavigate={vi.fn()} />);
    expect(html).toContain('Leave the window. Keep the thought.');
    expect(html).toContain('Find a Skrib');
    expect(html).not.toContain('Start a new Skrib every time');
    expect(html).not.toContain('Sign out');
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
