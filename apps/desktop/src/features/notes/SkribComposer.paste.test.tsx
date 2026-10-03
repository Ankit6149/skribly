// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { SkribComposer } from './SkribComposer';
import { addFilesToNote, getRichContent, replaceRichTextForNote } from './persistence/richContentStore';
import type { SkribNote } from './model/noteTypes';

vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(async () => undefined), listen: vi.fn(async () => () => undefined) }));
vi.mock('../licensing/state/licenseStore', () => ({ useLicenseStore: (select: (state: unknown) => unknown) => select({ status: { enforcementEnabled: false, canWrite: true } }) }));
vi.mock('../reminders/persistence/reminderStore', async (original) => ({ ...await original<typeof import('../reminders/persistence/reminderStore')>(), listReminders: vi.fn(async () => []) }));
vi.mock('./components/InkCanvas', () => ({ InkCanvas: () => null }));
vi.mock('./persistence/richContentStore', async (original) => {
  const module = await original<typeof import('./persistence/richContentStore')>();
  const repository = module.createRichContentRepository(module.createMemoryRichContentPersistence());
  return { ...module, getRichContent: repository.get, getInkForNote: repository.getInk,
    addFilesToNote: vi.fn(repository.addFiles), replaceRichTextForNote: vi.fn(repository.replaceRichText) };
});

describe('composer clipboard files', () => {
  it('pastes an image and PDF through validation/storage into the saved writing cursor without replacing text', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    URL.createObjectURL = vi.fn(() => 'blob:synthetic'); URL.revokeObjectURL = vi.fn();
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    const note: SkribNote = { id: 'clipboard-note', target_process_name: 'Code.exe', target_title: 'Synthetic fixture',
      rel_x: 0, rel_y: 0, width: 520, height: 500, text: 'Before after', color: 'peach', collapsed: false, created_at: 1, updated_at: 1 };
    try {
      await act(async () => root.render(<React.StrictMode><SkribComposer note={note} target={null} openAction="reopened" /></React.StrictMode>));
      const editor = container.querySelector('[role="textbox"]') as HTMLElement;
      const range = document.createRange(); range.setStart(editor.querySelector('div')!.firstChild!, 7); range.collapse(true);
      window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
      const files = [new File(['image-bytes'], 'synthetic.png', { type: 'image/png' }), new File(['%PDF-test'], 'reference.pdf', { type: 'application/pdf' })];
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { files, items: [], getData: () => '' } });
      await act(async () => editor.dispatchEvent(paste));
      expect(paste.defaultPrevented).toBe(true);
      expect(addFilesToNote).toHaveBeenCalledWith(note.id, files);
      expect(editor.querySelectorAll('[data-skrib-attachment]')).toHaveLength(2);
      expect(editor.querySelector('img')?.getAttribute('alt')).toBe('synthetic.png');
      expect(editor.firstChild?.firstChild?.textContent).toBe('Before ');
      expect(editor.firstChild?.lastChild?.textContent).toBe('after');
      await act(async () => editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
      const saved = await getRichContent(note.id);
      expect(saved.attachments.map((file) => file.name)).toEqual(['synthetic.png', 'reference.pdf']);
      expect(saved.richText?.plainText).toBe('Before after');
      expect(saved.richText?.html).toContain('data-skrib-attachment');
      expect(saved.richText?.html).not.toContain('blob:');
      expect(replaceRichTextForNote).toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
});
