import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DraftSaveController,
  MAX_NOTE_CHARACTERS,
  countNoteCharacters,
} from './draftSaveController';

afterEach(() => {
  vi.useRealTimers();
});

describe('DraftSaveController', () => {
  it('debounces rapid typing into one persistence request', async () => {
    vi.useFakeTimers();
    const persist = vi.fn(async () => true);
    const controller = new DraftSaveController({ initialText: '', persist, debounceMs: 350 });

    controller.setDraft('o');
    controller.setDraft('or');
    controller.setDraft('ordered');

    await vi.advanceTimersByTimeAsync(349);
    expect(persist).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('ordered');
    expect(controller.getSnapshot().status).toBe('saved');
  });

  it('keeps one write in flight and coalesces newer text into one follow-up', async () => {
    vi.useFakeTimers();
    let resolveFirst: ((saved: boolean) => void) | undefined;
    const writes: string[] = [];
    const persist = vi.fn((draft: string) => {
      writes.push(draft);
      if (writes.length === 1) {
        return new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(true);
    });
    const controller = new DraftSaveController({ initialText: '', persist, debounceMs: 10 });

    controller.setDraft('first');
    await vi.advanceTimersByTimeAsync(10);
    expect(writes).toEqual(['first']);

    controller.setDraft('second');
    controller.setDraft('final');
    const flush = controller.flush();
    expect(writes).toEqual(['first']);

    resolveFirst?.(true);
    await flush;

    expect(writes).toEqual(['first', 'final']);
    expect(controller.getSnapshot()).toMatchObject({
      draft: 'final',
      committed: 'final',
      status: 'saved',
    });
  });

  it('flushes the exact final draft before an immediate close', async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    const controller = new DraftSaveController({
      initialText: 'old',
      debounceMs: 500,
      persist: async (draft) => {
        writes.push(draft);
        return true;
      },
    });

    controller.setDraft('new');
    controller.setDraft('newest');

    await expect(controller.flush()).resolves.toBe(true);
    expect(writes).toEqual(['newest']);
    expect(controller.getSnapshot().committed).toBe('newest');
  });

  it('retains a failed draft and saves it after retry', async () => {
    const persist = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const controller = new DraftSaveController({ initialText: 'old', persist, debounceMs: 1 });

    controller.setDraft('must survive');
    await expect(controller.flush()).resolves.toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      draft: 'must survive',
      committed: 'old',
      status: 'failed',
    });

    await expect(controller.retry()).resolves.toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      draft: 'must survive',
      committed: 'must survive',
      status: 'saved',
    });
  });

  it('cancels an unsent draft when deletion is prepared', async () => {
    vi.useFakeTimers();
    const persist = vi.fn(async () => true);
    const controller = new DraftSaveController({ initialText: 'saved', persist, debounceMs: 100 });

    controller.setDraft('unsent');
    await controller.prepareForDelete();
    await vi.advanceTimersByTimeAsync(100);

    expect(persist).not.toHaveBeenCalled();
  });

  it('waits for an active write before deletion continues', async () => {
    vi.useFakeTimers();
    let resolveWrite: ((saved: boolean) => void) | undefined;
    const controller = new DraftSaveController({
      initialText: '',
      debounceMs: 1,
      persist: () =>
        new Promise<boolean>((resolve) => {
          resolveWrite = resolve;
        }),
    });

    controller.setDraft('in flight');
    await vi.advanceTimersByTimeAsync(1);

    let prepared = false;
    const preparation = controller.prepareForDelete().then(() => {
      prepared = true;
    });
    await Promise.resolve();
    expect(prepared).toBe(false);

    resolveWrite?.(true);
    await preparation;
    expect(prepared).toBe(true);
  });

  it('does not execute a scheduled write after disposal', async () => {
    vi.useFakeTimers();
    const persist = vi.fn(async () => true);
    const controller = new DraftSaveController({ initialText: '', persist, debounceMs: 50 });

    controller.setDraft('discarded with component');
    controller.dispose();
    await vi.advanceTimersByTimeAsync(50);

    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects text beyond the documented character limit', () => {
    const controller = new DraftSaveController({ initialText: '', persist: async () => true });
    const oversized = 'a'.repeat(MAX_NOTE_CHARACTERS + 1);

    const result = controller.setDraft(oversized);

    expect(result.accepted).toBe(false);
    expect(result.error).toContain(MAX_NOTE_CHARACTERS.toLocaleString());
    expect(controller.getSnapshot().draft).toBe('');
    expect(countNoteCharacters('A😀')).toBe(2);
  });
});
