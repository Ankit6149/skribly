// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { AppAppearancePreferences } from './AppAppearancePreferences';
const native = vi.hoisted(() => ({ invoke:vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke:native.invoke }));

it('keeps font feedback beside the font and retries failed app choices in place', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT:true });
  localStorage.clear();
  native.invoke.mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue([{ target_process_name:'Code.exe' }]);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AppAppearancePreferences />));
    const font = host.querySelector<HTMLSelectElement>('[aria-label="Note font"]')!;
    await act(async () => { font.value='system'; font.dispatchEvent(new Event('change',{bubbles:true})); });
    expect(host.querySelector('.note-font-settings [role="status"]')?.textContent).toContain('Note font saved');
    expect(host.querySelector('.app-logo-settings [role="status"]')?.textContent).toContain('could not load');
    const retry = Array.from(host.querySelectorAll('button')).find((button) => button.textContent==='Retry app choices')!;
    await act(async () => retry.click());
    const apps = host.querySelector<HTMLSelectElement>('[aria-label="Application logo to customize"]')!;
    expect(apps.disabled).toBe(false); expect(apps.textContent).toContain('code.exe');
    expect(native.invoke).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); host.remove(); localStorage.clear(); }
});
