import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContextPresence } from './contextPresence';

afterEach(() => vi.useRealTimers());

describe('quiet contextual presence', () => {
  it('folds an arrival after three seconds without restarting for same-context refreshes', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const presence = createContextPresence(request);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
    vi.advanceTimersByTime(2_500);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
    vi.advanceTimersByTime(500);
    expect(request).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('gives a genuine new arrival its own reading time', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const presence = createContextPresence(request);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
    vi.advanceTimersByTime(2_000);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 2 });
    vi.advanceTimersByTime(2_999);
    expect(request).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(request).toHaveBeenCalledWith(false);
  });

  it('keeps the label available until both pointer and keyboard focus leave', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const presence = createContextPresence(request);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
    presence.pointer(true);
    presence.focus(true);
    presence.pointer(false);
    vi.advanceTimersByTime(10_000);
    expect(request).not.toHaveBeenCalledWith(false);
    presence.focus(false);
    vi.advanceTimersByTime(249);
    expect(request).not.toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(1);
    expect(request).toHaveBeenLastCalledWith(false);
  });

  it('cancels leave grace when the pointer comes back', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const presence = createContextPresence(request);
    presence.pointer(true); presence.pointer(false);
    vi.advanceTimersByTime(200);
    presence.pointer(true);
    vi.advanceTimersByTime(1_000);
    expect(request).not.toHaveBeenCalledWith(false);
  });

  it('does not collapse a list while reading or after disposal', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const presence = createContextPresence(request);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
    presence.sync({ expanded: true, revealed: true, arrivalRevision: 1 });
    vi.advanceTimersByTime(4_000);
    expect(request).not.toHaveBeenCalled();
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 2 });
    presence.dispose();
    presence.pointer(true);
    vi.advanceTimersByTime(4_000);
    expect(request).not.toHaveBeenCalled();
  });

  it('Escape immediately hides the peek and cancels its timer', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const presence = createContextPresence(request);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
    presence.escape();
    vi.advanceTimersByTime(4_000);
    expect(request).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('does not shrink under a held pointer and clears removed-launcher interaction on list open', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const presence = createContextPresence(request);
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
    presence.hold(true);
    vi.advanceTimersByTime(4_000);
    expect(request).not.toHaveBeenCalled();
    presence.pointer(true);
    presence.focus(true);
    presence.sync({ expanded: true, revealed: false, arrivalRevision: 1 });
    presence.sync({ expanded: false, revealed: true, arrivalRevision: 2 });
    vi.advanceTimersByTime(3_000);
    expect(request).toHaveBeenCalledExactlyOnceWith(false);
  });
});
