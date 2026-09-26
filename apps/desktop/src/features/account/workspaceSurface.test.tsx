import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HomeSurface, SettingsSurface, WorkspaceSidebar } from './HomeHost';
import { LibraryHost } from '../library/LibraryHost';

vi.mock('../../stores/accountStore', () => ({
  useAccountStore: () => ({
    email: 'owner@example.test', accountRole: 'owner', productUpdatesOptIn: false,
    entitlement: { canWrite: true, mode: 'licensed' }, announcements: [], signOut: vi.fn(),
  }),
}));

describe('quiet desktop workspace structure', () => {
  it('keeps preferences and account actions out of Home', () => {
    const html = renderToStaticMarkup(<HomeSurface onNavigate={vi.fn()} />);
    expect(html).toContain('Back to my apps');
    expect(html).toContain('All Skribs');
    expect(html).toContain('Calendar');
    expect(html).not.toContain('READY · 3 OF 3');
    expect(html).not.toContain('Start a new Skrib every time');
    expect(html).not.toContain('Sign out');
  });

  it('keeps note preferences and sign out reachable in Settings', () => {
    const html = renderToStaticMarkup(<SettingsSurface />);
    expect(html).toContain('Start a new Skrib every time');
    expect(html).toContain('owner@example.test');
    expect(html).toContain('Sign out');
  });

  it('marks Settings as the selected sidebar destination', () => {
    const html = renderToStaticMarkup(<WorkspaceSidebar active="settings" onNavigate={vi.fn()} onShowGuide={vi.fn()} />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('title="Notes and account"');
  });

  it.each(['archive', 'trash'] as const)('renders the requested %s immediately without duplicate navigation', (view) => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(<LibraryHost request={{ view }} onViewChange={onChange} />);
    expect(html).toContain(`<h1 id="library-title">${view === 'archive' ? 'Archive' : 'Trash'}</h1>`);
    expect(html).not.toContain('aria-label="All Skribs lifecycle views"');
    expect(html).toContain('Manage notes');
    expect(html).toContain('Export note records');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('retains lifecycle navigation when the library is used on its own', () => {
    const html = renderToStaticMarkup(<LibraryHost request={{ view: 'notes' }} />);
    expect(html).toContain('aria-label="All Skribs lifecycle views"');
  });
});
