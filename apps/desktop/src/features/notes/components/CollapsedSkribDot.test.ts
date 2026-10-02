import { describe, expect, it, vi } from 'vitest';
import { dismissCollapsedSkribWindow } from './CollapsedSkribDot';

describe('collapsed Skrib dismissal', () => {
  it('asks the native runtime to dismiss the exact collapsed note', async () => {
    const invokeCommand = vi.fn().mockResolvedValue(undefined);

    await expect(
      dismissCollapsedSkribWindow('note-pastel-5', invokeCommand)
    ).resolves.toEqual({ ok: true });
    expect(invokeCommand).toHaveBeenCalledOnce();
    expect(invokeCommand).toHaveBeenCalledWith('dismiss_collapsed_skrib_window', {
      id: 'note-pastel-5',
    });
  });

  it('returns the visible failure state when native dismissal fails', async () => {
    const invokeCommand = vi.fn().mockRejectedValue(new Error('native dismissal failed'));

    await expect(
      dismissCollapsedSkribWindow('note-pastel-5', invokeCommand)
    ).resolves.toEqual({ ok: false, message: 'Could not hide' });
  });
});
