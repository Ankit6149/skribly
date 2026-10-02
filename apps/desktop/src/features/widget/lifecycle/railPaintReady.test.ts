import { describe, expect, it, vi } from 'vitest';
import { afterRailPaint } from './railPaintReady';

function clock() {
  let id = 0;
  const frames = new Map<number, () => void>();
  const timers = new Map<number, () => void>();
  return {
    requestFrame: (cb: () => void) => { frames.set(++id, cb); return id; },
    cancelFrame: (key: number) => { frames.delete(key); },
    setTimer: (cb: () => void) => { timers.set(++id, cb); return id; },
    clearTimer: (key: number) => { timers.delete(key); },
    frame: () => { const entries = [...frames]; frames.clear(); entries.forEach(([,cb]) => cb()); },
    fallback: () => { [...timers.values()].forEach(cb => cb()); },
  };
}
describe('native rail paint acknowledgement', () => {
  it('waits for two frame boundaries and acknowledges once', () => {
    const scheduler = clock(); const ready = vi.fn();
    afterRailPaint(ready, scheduler);
    scheduler.frame(); expect(ready).not.toHaveBeenCalled();
    scheduler.frame(); expect(ready).toHaveBeenCalledTimes(1);
    scheduler.fallback(); expect(ready).toHaveBeenCalledTimes(1);
  });
  it('cancels stale layout acknowledgements after a newer state or unmount', () => {
    const scheduler = clock(); const ready = vi.fn();
    const cancel = afterRailPaint(ready, scheduler);
    scheduler.frame(); cancel(); scheduler.frame(); scheduler.fallback();
    expect(ready).not.toHaveBeenCalled();
  });
  it('recovers when native clipping throttles frame callbacks', () => {
    const scheduler = clock(); const ready = vi.fn();
    afterRailPaint(ready, scheduler); scheduler.fallback(); scheduler.frame();
    expect(ready).toHaveBeenCalledTimes(1);
  });
});
