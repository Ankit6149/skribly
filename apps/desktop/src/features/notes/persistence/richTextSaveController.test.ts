import { describe, expect, it, vi } from 'vitest';
import { RichTextSaveController } from './richTextSaveController';

describe('rich draft ownership', () => {
  it('preserves newer B when in-flight A rejects, then saves exactly B on retry', async () => {
    let reject!: (reason: Error) => void;
    const persist = vi.fn().mockImplementationOnce(() => new Promise<void>((_yes, no) => { reject = no; })).mockResolvedValue(undefined);
    const controller = new RichTextSaveController(persist, vi.fn(), 60_000);
    controller.setDraft({ html: '<b>A</b>', plainText: 'A' });
    const failed = controller.flush();
    const newer = { html: '<em>B</em>', plainText: 'B' };
    controller.setDraft(newer);
    reject(new Error('Quota failure'));
    expect(await failed).toBe(false);
    expect(controller.getPending()).toBe(newer);
    expect(await controller.flush()).toBe(true);
    expect(persist.mock.calls.map(([draft]) => draft.plainText)).toEqual(['A', 'B']);
    expect(controller.getPending()).toBeNull();
    controller.suspend();
  });

  it('waits for the whole drain on concurrent flush calls and saves edits accepted during A', async () => {
    let resolve!: () => void;
    const persist = vi.fn().mockImplementationOnce(() => new Promise<void>((yes) => { resolve = yes; })).mockResolvedValue(undefined);
    const controller = new RichTextSaveController(persist, vi.fn(), 60_000);
    controller.setDraft({ html: 'A', plainText: 'A' });
    const first = controller.flush();
    controller.setDraft({ html: 'B', plainText: 'B' });
    const second = controller.flush();
    resolve();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(persist.mock.calls.map(([draft]) => draft.plainText)).toEqual(['A', 'B']);
    controller.suspend();
  });
});
