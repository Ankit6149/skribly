interface PaintClock {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
}

/** Two frame boundaries after React commits. Clipped WebViews can throttle RAF. */
export function afterRailPaint(acknowledge: () => void, clock: PaintClock): () => void {
  let alive = true;
  let frame: number;
  const finish = () => {
    if (!alive) return;
    alive = false;
    clock.cancelFrame(frame); clock.clearTimer(timer); acknowledge();
  };
  const timer = clock.setTimer(finish, 200);
  frame = clock.requestFrame(() => { if (alive) frame = clock.requestFrame(finish); });
  return () => { alive = false; clock.cancelFrame(frame); clock.clearTimer(timer); };
}
