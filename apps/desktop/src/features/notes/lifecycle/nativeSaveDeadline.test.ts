import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveBeforeNativeDeadline } from './nativeSaveDeadline';

afterEach(() => vi.useRealTimers());
describe('native save deadline', () => {
  it('returns false before the native 5 s deadline and ignores a late success', async () => {
    vi.useFakeTimers();
    let resolve!: (saved: boolean) => void;
    const result = saveBeforeNativeDeadline(() => new Promise<boolean>((done) => { resolve = done; }));
    await vi.advanceTimersByTimeAsync(3500);
    expect(await result).toBe(false);
    resolve(true);
    expect(await result).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears the deadline when persistence succeeds', async () => {
    vi.useFakeTimers();
    expect(await saveBeforeNativeDeadline(async () => true)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('fails closed on rejected or synchronously thrown writes', async () => {
    expect(await saveBeforeNativeDeadline(async () => { throw new Error('write failed'); })).toBe(false);
    expect(await saveBeforeNativeDeadline(() => { throw new Error('write failed'); })).toBe(false);
  });
});
