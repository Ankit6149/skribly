import { describe, expect, it, vi } from 'vitest';
import { hideOverlayThen } from './overlayWindowLifecycle';

describe('compact overlay window lifecycle', () => {
  it('hides the native window before clearing the visible surface', async () => {
    const calls: string[] = [];

    await hideOverlayThen(
      async () => {
        calls.push('hide');
      },
      () => {
        calls.push('clear');
      }
    );

    expect(calls).toEqual(['hide', 'clear']);
  });

  it('keeps the visible surface mounted when hiding is rejected', async () => {
    const clearSurface = vi.fn();

    await expect(
      hideOverlayThen(async () => {
        throw new Error('hide denied');
      }, clearSurface)
    ).rejects.toThrow('hide denied');

    expect(clearSurface).not.toHaveBeenCalled();
  });
});
