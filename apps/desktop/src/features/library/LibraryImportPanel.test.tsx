// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryImportPanel } from './LibraryImportPanel';

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('library import dialog', () => {
  it('contains focus, closes on Escape, and returns focus to its trigger', async () => {
    await act(async () => root.render(<LibraryImportPanel canApply onApplied={() => undefined} />));
    const trigger = container.querySelector('button') as HTMLButtonElement;
    await act(async () => trigger.click());

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const close = dialog.querySelector('[aria-label="Close import panel"]') as HTMLButtonElement;
    const lastAction = dialog.querySelector('.library-import-file-row button') as HTMLButtonElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(close);
    expect(trigger.hasAttribute('inert')).toBe(true);

    await act(async () => {
      lastAction.focus();
      lastAction.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(close);

    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(trigger.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
