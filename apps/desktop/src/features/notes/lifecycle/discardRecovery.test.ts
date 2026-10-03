import { describe, expect, it, vi } from 'vitest';
import { discardWithRecovery, type DiscardRecoveryOperations, type NoteDiscardRecovery } from './discardRecovery';

const recovery: NoteDiscardRecovery = {
  version: 1,
  current: { text: 'Kept edits', color: 'mint', reminders: [], rich: { noteId: 'n', attachments: [], updatedAt: 2 } },
  baseline: { text: 'Original', color: 'yellow', reminders: [], rich: { noteId: 'n', attachments: [], updatedAt: 1 } },
};

function operations() {
  return { retain: vi.fn(async () => undefined), restoreRich: vi.fn(async () => undefined),
    restoreReminders: vi.fn(async () => undefined), restoreColor: vi.fn(async () => undefined),
    restoreText: vi.fn(async () => undefined), finish: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) };
}

describe('cross-store discard recovery', () => {
  it('does not start replacements when the durable intent cannot be retained', async () => {
    const ops = operations(); ops.retain.mockRejectedValueOnce(new Error('Quota'));
    await expect(discardWithRecovery(recovery, ops)).rejects.toThrow('Quota');
    expect(ops.restoreRich).not.toHaveBeenCalled(); expect(ops.finish).not.toHaveBeenCalled();
  });
  it.each(['restoreRich', 'restoreReminders', 'restoreColor', 'restoreText', 'clear'] as const)(
    'compensates exact current content when %s fails before commit', async (step) => {
      const ops = operations(); ops[step].mockRejectedValueOnce(new Error('Fault'));
      const result = await discardWithRecovery(recovery, ops);
      expect(result).toMatchObject({ discarded: false, recovered: true, closed: false });
      for (const restore of ['restoreRich', 'restoreReminders', 'restoreColor', 'restoreText'] as const) {
        expect(ops[restore]).toHaveBeenLastCalledWith(recovery.current);
      }
      expect(ops.finish).not.toHaveBeenCalled();
    });
  it('keeps the durable intent when compensation fails, including both blob snapshots', async () => {
    const ops = operations(); ops.restoreReminders.mockRejectedValue(new Error('Unavailable'));
    const result = await discardWithRecovery(recovery, ops);
    expect(result).toMatchObject({ discarded: false, recovered: false });
    expect(ops.retain).toHaveBeenCalledWith(recovery); expect(ops.clear).not.toHaveBeenCalled();
    expect(ops.finish).not.toHaveBeenCalled();
  });
  it('never compensates into a deleted or hidden native record after the durable commit', async () => {
    const ops = operations(); ops.finish.mockRejectedValueOnce(new Error('Window close failed'));
    const result = await discardWithRecovery(recovery, ops);
    expect(result).toMatchObject({ discarded: true, recovered: true, closed: false });
    expect(ops.clear).toHaveBeenCalledOnce();
    for (const restore of ['restoreRich', 'restoreReminders', 'restoreColor', 'restoreText'] as const) {
      expect(ops[restore]).toHaveBeenCalledOnce(); expect(ops[restore]).toHaveBeenCalledWith(recovery.baseline);
    }
  });
});
