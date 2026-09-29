import { describe, expect, it, vi } from 'vitest';
import { observeRailWindowState, type RailWindowState } from './railWindowState';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() { await Promise.resolve(); await Promise.resolve(); }

describe('native rail window state', () => {
  it('rejects state belonging to the other rail even during the initial read', async () => {
    let publish!: (state: RailWindowState) => void;
    const onState = vi.fn();
    const dispose = observeRailWindowState({
      contextual: true,
      subscribe: async (listener) => { publish = listener; return () => {}; },
      read: async () => ({ contextual: true, expanded: false, revision: 1 }),
      onState, onError: vi.fn(),
    });
    publish({ contextual: false, expanded: true, revision: 100 });
    await settle();
    expect(onState).toHaveBeenCalledOnce();
    publish({ contextual: false, expanded: true, revision: 101 });
    publish({ contextual: true, expanded: true, revision: 2, dockSide: 'left' });
    expect(onState).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenLastCalledWith({ contextual: true, expanded: true, revision: 2, dockSide: 'left' });
    dispose();
  });

  it('rejects delayed native revisions and unlabelled global events', async () => {
    let publish!: (state: RailWindowState) => void;
    const onState = vi.fn();
    const dispose = observeRailWindowState({
      contextual: false,
      subscribe: async (listener) => { publish = listener; return () => {}; },
      read: async () => ({ contextual: false, expanded: false, revision: 5 }),
      onState, onError: vi.fn(),
    });
    await settle();
    publish({ contextual: false, expanded: true, revision: 4 });
    publish({ expanded: true });
    expect(onState).toHaveBeenCalledOnce();
    publish({ contextual: false, expanded: true, revision: 6 });
    expect(onState).toHaveBeenCalledTimes(2);
    dispose();
  });

  it('subscribes before querying and restores an already-expanded rail', async () => {
    const subscription = deferred<() => void>();
    const read = vi.fn(async () => ({ expanded: true }));
    const onState = vi.fn();
    const unlisten = vi.fn();
    const dispose = observeRailWindowState({ subscribe: () => subscription.promise, read, onState, onError: vi.fn() });
    expect(read).not.toHaveBeenCalled();
    subscription.resolve(unlisten);
    await settle();
    expect(onState).toHaveBeenCalledWith({ expanded: true });
    dispose();
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it('does not let a stale snapshot reopen a natively collapsed context bar', async () => {
    const snapshot = deferred<RailWindowState>();
    let publish!: (state: RailWindowState) => void;
    const onState = vi.fn();
    const dispose = observeRailWindowState({
      subscribe: async (listener) => { publish = listener; return () => {}; },
      read: () => snapshot.promise, onState, onError: vi.fn(),
    });
    await settle();
    publish({ expanded: false });
    snapshot.resolve({ expanded: true });
    await settle();
    expect(onState.mock.calls).toEqual([[{ expanded: false }]]);
    publish({ expanded: true });
    expect(onState).toHaveBeenLastCalledWith({ expanded: true });
    dispose();
  });

  it('cleans up a subscription that completes after unmount without querying', async () => {
    const subscription = deferred<() => void>();
    const read = vi.fn(async () => ({ expanded: true }));
    const unlisten = vi.fn();
    const dispose = observeRailWindowState({ subscribe: () => subscription.promise, read, onState: vi.fn(), onError: vi.fn() });
    dispose();
    subscription.resolve(unlisten);
    await settle();
    expect(unlisten).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
  });

  it('ignores pending snapshots and queued events after unmount', async () => {
    const snapshot = deferred<RailWindowState>();
    let publish!: (state: RailWindowState) => void;
    const onState = vi.fn();
    const dispose = observeRailWindowState({
      subscribe: async (listener) => { publish = listener; return () => {}; },
      read: () => snapshot.promise, onState, onError: vi.fn(),
    });
    await settle();
    dispose();
    publish({ expanded: false });
    snapshot.resolve({ expanded: true });
    await settle();
    expect(onState).not.toHaveBeenCalled();
  });

  it('reports read failures without changing the displayed state', async () => {
    const onError = vi.fn();
    const onState = vi.fn();
    const reason = new Error('Native rail unavailable');
    const dispose = observeRailWindowState({
      subscribe: async () => () => {}, read: async () => { throw reason; }, onState, onError,
    });
    await settle();
    expect(onError).toHaveBeenCalledWith(reason);
    expect(onState).not.toHaveBeenCalled();
    dispose();
  });
});
