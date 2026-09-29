import type { RailWindowState } from './railWindowState';

export const CONTEXT_ARRIVAL_MS = 3_000;
export const CONTEXT_LEAVE_MS = 250;

/** One context presence, never one dot per note. Native events own its geometry. */
export function createContextPresence(requestReveal: (revealed: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let pointer = false;
  let focused = false;
  let held = false;
  let expanded = false;
  let arrivalRevision = -1;

  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const settle = (delay: number) => {
    clear();
    if (disposed || pointer || focused || held || expanded) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed && !pointer && !focused && !held && !expanded) requestReveal(false);
    }, delay);
  };
  const interaction = (kind: 'pointer' | 'focus', active: boolean) => {
    if (disposed) return;
    if (kind === 'pointer') pointer = active; else focused = active;
    if (pointer || focused) { clear(); if (!expanded && !held) requestReveal(true); }
    else settle(CONTEXT_LEAVE_MS);
  };
  return {
    sync(state: RailWindowState) {
      if (disposed) return;
      expanded = state.expanded;
      // The launcher unmounts while the list is open; DOM blur/leave is not
      // guaranteed for a removed button. Do not retain those stale interactions.
      if (expanded) { pointer = false; focused = false; held = false; }
      const arrived = state.arrivalRevision !== undefined && state.arrivalRevision !== arrivalRevision;
      if (state.arrivalRevision !== undefined) arrivalRevision = state.arrivalRevision;
      if (expanded || !state.revealed) clear();
      else if (arrived) settle(CONTEXT_ARRIVAL_MS);
    },
    pointer: (active: boolean) => interaction('pointer', active),
    focus: (active: boolean) => interaction('focus', active),
    hold(active: boolean) {
      held = active;
      if (held) clear();
      else if (pointer || focused) { if (!disposed && !expanded) requestReveal(true); }
      else settle(CONTEXT_LEAVE_MS);
    },
    escape() { clear(); if (!disposed) requestReveal(false); },
    dispose() { disposed = true; clear(); },
  };
}
