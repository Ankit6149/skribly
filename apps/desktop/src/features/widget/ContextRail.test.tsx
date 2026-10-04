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
  vi.restoreAllMocks();
  native.invoke.mockReset();
});

describe('global widget light dismissal', () => {
  it('acknowledges only the current rendered surface after two frames', async () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let frame = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.set(++frame, callback); return frame;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id); });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 388 } as DOMRect);
    const tick = () => {
      const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(0));
    };
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });
    expect(document.activeElement).toBe(container.querySelector('.global-shelf'));
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: true, revision: 2, surfaceRevision: 10 });
    });
    await act(async () => { tick(); });
    expect(native.invoke).not.toHaveBeenCalledWith('acknowledge_global_rail_surface', expect.anything());
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: false, revision: 3, surfaceRevision: 11 });
    });
    await act(async () => { tick(); tick(); });
    expect(native.invoke).toHaveBeenCalledWith('acknowledge_global_rail_surface', { surfaceRevision: 11 });
    expect(native.invoke).not.toHaveBeenCalledWith('acknowledge_global_rail_surface', { surfaceRevision: 10 });
  });

  it('restores keyboard focus when native opening finishes, so Escape closes immediately', async () => {
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: false, revision: 2 });
    });
    // A real pointer/keyboard open starts with focus on the compact launcher.
    container.querySelector<HTMLButtonElement>('.context-rail-global-widget')?.focus();
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: true, revision: 3, surfaceRevision: 21 });
    });
    const surface = container.querySelector('.global-shelf');
    expect(document.activeElement).not.toBe(surface);
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: true, revision: 4 });
    });
    expect(document.activeElement).toBe(surface);
    await act(async () => {
      surface?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(native.invoke).toHaveBeenCalledWith('set_context_rail_expanded', { contextual: false, expanded: false, noteCount: 0, reducedMotion: false });
  });

  it('returns to the compact widget after native focus loss', async () => {
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });

    expect(container.querySelector('.global-shelf')).not.toBeNull();

    await act(async () => { native.listeners.get('skribly://global-rail-dismiss')?.(); });
    const surface = container.querySelector('.global-shelf.is-closing');
    expect(surface).not.toBeNull();
    expect(native.invoke).toHaveBeenCalledWith('set_context_rail_expanded', { contextual: false, expanded: false, noteCount: 0, reducedMotion: false });
    await act(async () => {
      const end = new Event('animationend', { bubbles: true });
      Object.defineProperty(end, 'animationName', { value: 'global-shelf-out-right' });
      surface?.dispatchEvent(end);
    });

    expect(container.querySelector('.global-shelf.is-closing')).not.toBeNull();
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: false, revision: 2, dockSide: 'right' });
    });
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
    expect(native.invoke.mock.calls.filter(([command]) => command === 'set_context_rail_expanded')).toHaveLength(1);
  });

  it('lets native dismissal complete without a WebView animationend', async () => {
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });

    await act(async () => { native.listeners.get('skribly://global-rail-dismiss')?.(); });
    expect(container.querySelector('.global-shelf.is-closing')).not.toBeNull();
    await act(async () => {
      native.stateListener?.({ contextual: false, expanded: false, revision: 2, dockSide: 'right' });
    });

    expect(native.invoke).toHaveBeenCalledWith('set_context_rail_expanded', { contextual: false, expanded: false, noteCount: 0, reducedMotion: false });
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

  it('creates a detached general Skrib without passing the focused app as context', async () => {
    native.invoke.mockImplementation(async (command: string) => {
      if (command === 'get_rail_window_state') return {
        contextual: false, expanded: true, revision: 1, dockSide: 'right',
      };
      if (command === 'get_all_skribs' || command === 'get_context_rail_notes') return [];
      if (command === 'get_open_skrib_note_id') return null;
      if (command === 'create_general_skrib') return 'skrib-general-1';
      return undefined;
    });
    const { ContextRail } = await import('./ContextRail');
    await act(async () => { root.render(<ContextRail contextual={false} />); });
    const create = container.querySelector<HTMLButtonElement>('[aria-label="New general Skrib"]');
    expect(create).not.toBeNull();
    native.invoke.mockClear();

    await act(async () => { create?.click(); });

    expect(native.invoke).toHaveBeenNthCalledWith(1, 'get_open_skrib_note_id');
    expect(native.invoke).toHaveBeenNthCalledWith(2, 'create_general_skrib');
    expect(native.invoke).toHaveBeenNthCalledWith(3, 'set_context_rail_expanded', {
      contextual: false,
      expanded: false,
      noteCount: 0,
      reducedMotion: false,
    });
  });
});
