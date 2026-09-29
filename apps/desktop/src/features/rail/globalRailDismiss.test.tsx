// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  listeners: new Map<string, (event?: { payload: unknown }) => void>(),
  stateListener: undefined as undefined | ((state: unknown) => void),
  invoke: vi.fn(),
  emitTo: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, callback: (payload?: { payload: unknown }) => void) => {
    native.listeners.set(event, callback);
    return () => { native.listeners.delete(event); };
  }),
  emitTo: native.emitTo,
}));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    listen: async (_event: string, callback: ({ payload }: { payload: unknown }) => void) => {
      native.stateListener = (state) => callback({ payload: state });
      return () => { native.stateListener = undefined; };
    },
    startDragging: vi.fn(async () => undefined),
  }),
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('__TAURI_INTERNALS__', {});
  native.listeners.clear();
  native.stateListener = undefined;
  native.invoke.mockImplementation(async (command: string, args?: { expanded?: boolean }) => {
    if (command === 'get_rail_window_state') return {
      contextual: false, expanded: true, revision: 1, dockSide: 'right',
    };
    if (command === 'get_all_skribs' || command === 'get_context_rail_notes') return [];
    if (command === 'get_open_skrib_note_id') return null;
    if (command === 'set_context_rail_expanded') {
      native.stateListener?.({ contextual: false, expanded: args?.expanded, revision: 2, dockSide: 'right' });
    }
    return undefined;
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  native.invoke.mockReset();
});

describe('global widget light dismissal', () => {
  it('returns to the compact widget after native focus loss', async () => {
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });

    expect(container.querySelector('.global-shelf')).not.toBeNull();

    await act(async () => { native.listeners.get('skribly://global-rail-dismiss')?.(); });
    const surface = container.querySelector('.global-shelf.is-closing');
    expect(surface).not.toBeNull();
    expect(native.invoke).not.toHaveBeenCalledWith('set_context_rail_expanded', expect.anything());
    await act(async () => {
      const end = new Event('animationend', { bubbles: true });
      Object.defineProperty(end, 'animationName', { value: 'global-shelf-out-right' });
      surface?.dispatchEvent(end);
    });

    expect(native.invoke).toHaveBeenCalledWith('set_context_rail_expanded', { contextual: false, expanded: false, noteCount: 0 });
    expect(container.querySelector('[aria-label="Open My Skribs, 0 saved Skribs"]')).not.toBeNull();
  });

  it('does not send a delayed close after native state already collapsed the panel', async () => {
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });

    await act(async () => { native.listeners.get('skribly://global-rail-dismiss')?.(); });
    expect(container.querySelector('.global-shelf.is-closing')).not.toBeNull();
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: false, revision: 2, dockSide: 'right' });
    });

    expect(container.querySelector('[aria-label="Open My Skribs, 0 saved Skribs"]')).not.toBeNull();
    expect(native.invoke).not.toHaveBeenCalledWith('set_context_rail_expanded', expect.anything());
  });

  it('still collapses when WebView does not deliver animationend', async () => {
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });

    await act(async () => { native.listeners.get('skribly://global-rail-dismiss')?.(); });
    expect(container.querySelector('.global-shelf.is-closing')).not.toBeNull();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 390)); });

    expect(native.invoke).toHaveBeenCalledWith('set_context_rail_expanded', { contextual: false, expanded: false, noteCount: 0 });
    expect(container.querySelector('[aria-label="Open My Skribs, 0 saved Skribs"]')).not.toBeNull();
  });

  it('renders the same compact widget outside the panel and sends a close request', async () => {
    const { GlobalPanelHandle } = await import('./GlobalPanelHandle');
    await act(async () => { root.render(<GlobalPanelHandle />); });
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="Close My Skribs panel"]');
    expect(handle?.querySelectorAll('.global-widget-strip')).toHaveLength(3);
    await act(async () => { native.listeners.get('skribly://global-rail-handle-state')?.({ payload: 'left' }); });
    expect(container.querySelector('.dock-left')).not.toBeNull();
    await act(async () => { handle?.click(); });
    expect(native.emitTo).toHaveBeenCalledWith('rail', 'skribly://global-rail-dismiss');
  });
});
