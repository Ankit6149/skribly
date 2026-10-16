// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ContextWidgetScopeMenu, GlobalWidgetControls } from './WidgetScopeControls';

describe('widget search and scope access', () => {
  it('focuses search with Ctrl+F, clears a query without losing focus, and exposes selected scope', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    function Harness() {
      const [query, setQuery] = useState('project');
      return <GlobalWidgetControls query={query} scope="all" onQuery={setQuery} onScope={() => undefined} />;
    }
    try {
      await act(async () => root.render(<Harness />));
      const input = host.querySelector('input')!;
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key:'f', ctrlKey:true, cancelable:true })));
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0); expect(input.selectionEnd).toBe(7);
      await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!.click());
      expect(input.value).toBe(''); expect(document.activeElement).toBe(input);
      await act(async () => root.render(<ContextWidgetScopeMenu open scope="archive" activeCount={2} contextCount={1} archivedCount={3} onScope={() => undefined} />));
      expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Archived');
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});
