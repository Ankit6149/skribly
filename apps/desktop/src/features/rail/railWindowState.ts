export interface RailWindowState {
  expanded: boolean;
  contextual?: boolean;
  revision?: number;
  dockSide?: 'left' | 'right';
  revealed?: boolean;
  arrivalRevision?: number;
}

interface RailWindowStateSource {
  contextual?: boolean;
  subscribe: (onState: (state: RailWindowState) => void) => Promise<() => void>;
  read: () => Promise<RailWindowState>;
  onState: (state: RailWindowState) => void;
  onError: (reason: unknown) => void;
}

/** Native geometry is authoritative, including changes made from Home or focus tracking. */
export function observeRailWindowState(source: RailWindowStateSource): () => void {
  let disposed = false;
  let generation = 0;
  let unlisten: (() => void) | undefined;
  let latestRevision = -1;
  const accept = (state: RailWindowState): boolean => {
    if (source.contextual !== undefined && state.contextual !== source.contextual) return false;
    if (state.revision !== undefined) {
      if (state.revision < latestRevision) return false;
      latestRevision = state.revision;
    }
    return true;
  };

  void (async () => {
    try {
      unlisten = await source.subscribe((state) => {
        if (disposed || !accept(state)) return;
        generation += 1;
        source.onState(state);
      });
      if (disposed) { unlisten(); return; }
      // Subscribe first so an intervening native resize cannot be lost or overwritten.
      const snapshotGeneration = generation;
      const state = await source.read();
      if (!disposed && snapshotGeneration === generation && accept(state)) source.onState(state);
    } catch (reason) {
      if (!disposed) source.onError(reason);
    }
  })();

  return () => { disposed = true; unlisten?.(); };
}
