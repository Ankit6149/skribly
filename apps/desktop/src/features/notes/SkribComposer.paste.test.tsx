// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { SkribComposer } from './SkribComposer';
import { addFilesToNote, getRichContent, replaceRichTextForNote } from './persistence/richContentStore';
import type { SkribNote } from './model/noteTypes';
import { invoke } from '@tauri-apps/api/core';
import { useSkribStore } from './state/skribStore';

const nativeListeners = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => unknown>());
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(async () => undefined), listen: vi.fn(async (name, callback) => {
  nativeListeners.set(name, callback); return () => nativeListeners.delete(name);
}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ scaleFactor: async () => 1, onResized: async () => () => undefined }) }));
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
  it('rejects native prepare in the queued-paste gap, then retains and saves the pasted file', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    URL.createObjectURL = vi.fn(() => 'blob:synthetic'); URL.revokeObjectURL = vi.fn();
    useSkribStore.setState({ isTauriAvailable: true });
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    const note: SkribNote = { id: 'clipboard-transition-gap', target_process_name: 'Code.exe', target_title: 'Synthetic fixture',
      rel_x: 0, rel_y: 0, width: 520, height: 500, text: '', color: 'peach', collapsed: false, created_at: 1, updated_at: 1 };
    let resolveFiles!: (files: Awaited<ReturnType<typeof addFilesToNote>>) => void;
    const actualAdd = vi.mocked(addFilesToNote).getMockImplementation()!;
    vi.mocked(addFilesToNote).mockImplementationOnce((id, files) => new Promise((resolve) => {
      resolveFiles = async () => resolve(await actualAdd(id, files));
    }));
    try {
      await act(async () => root.render(<SkribComposer note={note} target={null} openAction="reopened" />));
      const editor = container.querySelector('[role="textbox"]') as HTMLElement;
      const files = [new File(['%PDF-test'], 'queued.pdf', { type: 'application/pdf' })];
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { files, items: [], getData: () => '' } });
      const prepare = nativeListeners.get('skribly://prepare-native-transition')!;
      await act(async () => {
        editor.dispatchEvent(paste);
        // Same synchronous turn: the attachment child has not run its queued effect yet.
        expect(addFilesToNote).not.toHaveBeenCalledWith(note.id, files);
        await prepare({ payload: { noteId: note.id, requestId: 'gap-prepare', reason: 'close' } });
      });
      expect(invoke).toHaveBeenCalledWith('acknowledge_native_transition', expect.objectContaining({ requestId: 'gap-prepare', saved: false }));
      expect(addFilesToNote).toHaveBeenCalledWith(note.id, files);
      await act(async () => resolveFiles([]));
      expect(editor.querySelector('[data-skrib-attachment]')).not.toBeNull();
      expect((await getRichContent(note.id)).attachments.map((file) => file.name)).toEqual(['queued.pdf']);
      await act(async () => editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
      expect((await getRichContent(note.id)).richText?.html).toContain('data-skrib-attachment');
    } finally { await act(async () => root.unmount()); container.remove(); useSkribStore.setState({ isTauriAvailable: false }); }
  });

  it('reports blocked paste during native quiescence without writing files', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useSkribStore.setState({ isTauriAvailable: true });
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    const note: SkribNote = { id: 'clipboard-quiescent', target_process_name: 'Code.exe', target_title: 'Synthetic fixture',
      rel_x: 0, rel_y: 0, width: 520, height: 500, text: '', color: 'peach', collapsed: false, created_at: 1, updated_at: 1 };
    try {
      await act(async () => root.render(<SkribComposer note={note} target={null} openAction="reopened" />));
      await act(async () => { await nativeListeners.get('skribly://prepare-native-transition')!({ payload: { noteId: note.id, requestId: 'quiescent-prepare', reason: 'shortcut' } }); });
      expect(invoke).toHaveBeenCalledWith('acknowledge_native_transition', expect.objectContaining({ requestId: 'quiescent-prepare', saved: true }));
      const before = vi.mocked(addFilesToNote).mock.calls.length;
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { files: [new File(['%PDF-test'], 'blocked.pdf', { type: 'application/pdf' })], items: [], getData: () => '' } });
      await act(async () => container.querySelector('[role="textbox"]')!.dispatchEvent(paste));
      expect(paste.defaultPrevented).toBe(true);
      expect(vi.mocked(addFilesToNote).mock.calls.length).toBe(before);
      expect(container.textContent).toContain('Your clipboard was not changed; paste again');
      await act(async () => nativeListeners.get('skribly://native-transition-finished')!({ payload: { noteId: note.id, requestId: 'quiescent-prepare', completed: false } }));
      expect(container.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('true');
    } finally { await act(async () => root.unmount()); container.remove(); useSkribStore.setState({ isTauriAvailable: false }); }
  });

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
