// @vitest-environment jsdom
import React, { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor';
import type { SkribAttachment } from '../../lib/richContentStore';

const attachment: SkribAttachment = { id: 'attachment-1', name: 'reference.png', kind: 'image', mimeType: 'image/png', size: 4, createdAt: 1, blob: new Blob(['test']) };
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); Reflect.deleteProperty(document, 'execCommand'); vi.restoreAllMocks(); });

describe('inline attachment editing', () => {
  it('opens the inline file picker from a slash shortcut without a persistent caret rail', async () => {
    const onRequestAttachment = vi.fn();
    await act(async () => root.render(<RichTextEditor noteId="n" initialHtml="<p>Thought</p>"
      disabled={false} drawingEnabled={false} describedBy="status" onChange={() => true}
      onBlur={() => undefined} onPasteFiles={() => undefined} onRequestAttachment={onRequestAttachment} />));
    const editor = container.querySelector('[role="textbox"]') as HTMLDivElement;
    expect(container.querySelector('.composer-caret-tools')).toBeNull();
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', {
      key: '/', ctrlKey: true, bubbles: true, cancelable: true,
    })));
    expect(container.querySelector('[aria-label="Insert in note"]')).not.toBeNull();
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a', bubbles: true, cancelable: true,
    })));
    expect(onRequestAttachment).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-label="Insert in note"]')).toBeNull();
    expect(editor.textContent).toBe('Thought');
  });

  it('removes checklist controls at the current item without deleting its text', async () => {
    const ref = createRef<RichTextEditorHandle>();
    const onChange = vi.fn(() => true);
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    await act(async () => root.render(<RichTextEditor ref={ref} noteId="n"
      initialHtml='<ul data-checklist="true"><li><input type="checkbox"> Keep this task</li></ul>'
      disabled={false} drawingEnabled={false} describedBy="status" onChange={onChange}
      onBlur={() => undefined} onPasteFiles={() => undefined} />));
    const editor = container.querySelector('[role="textbox"]') as HTMLDivElement;
    const taskText = editor.querySelector('li')!.lastChild!;
    const range = document.createRange(); range.setStart(taskText, 4); range.collapse(true);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    await act(async () => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    await act(async () => ref.current!.insertChecklist());
    expect(editor.textContent).toContain('Keep this task');
    expect(editor.querySelector('input[type="checkbox"]')).toBeNull();
    expect(editor.querySelector('[data-checklist]')).toBeNull();
    expect(execCommand).toHaveBeenCalledWith('insertUnorderedList');
    expect(onChange).toHaveBeenCalled();
  });

  it('keeps an undo and redo trail for inline objects and keyboard editing', async () => {
    const ref = createRef<RichTextEditorHandle>();
    const onChange = vi.fn(() => true);
    const onHistoryChange = vi.fn();
    await act(async () => root.render(<RichTextEditor ref={ref} noteId="n" initialHtml="<p>Thought</p>"
      attachments={[attachment]} disabled={false} drawingEnabled={false} describedBy="status"
      onChange={onChange} onHistoryChange={onHistoryChange} onBlur={() => undefined} onPasteFiles={() => undefined} />));
    let placed = false;
    await act(async () => { placed = ref.current!.insertAttachments([attachment]); });
    expect(placed).toBe(true);
    expect(container.querySelectorAll('[data-skrib-attachment]')).toHaveLength(1);
    expect(onHistoryChange).toHaveBeenLastCalledWith(true, false);
    await act(async () => ref.current!.undo());
    expect(container.querySelector('[data-skrib-attachment]')).toBeNull();
    expect(onHistoryChange).toHaveBeenLastCalledWith(false, true);
    await act(async () => ref.current!.redo());
    expect(container.querySelectorAll('[data-skrib-attachment]')).toHaveLength(1);
    await act(async () => container.querySelector('[role="textbox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })));
    expect(container.querySelector('[data-skrib-attachment]')).toBeNull();
  });

  it('undoes highlight and checklist changes without discarding the thought', async () => {
    const ref = createRef<RichTextEditorHandle>();
    const onChange = vi.fn(() => true);
    await act(async () => root.render(<RichTextEditor ref={ref} noteId="n" initialHtml="<p>Thought</p>"
      disabled={false} drawingEnabled={false} describedBy="status" onChange={onChange}
      onBlur={() => undefined} onPasteFiles={() => undefined} />));
    const editor = container.querySelector('[role="textbox"]') as HTMLDivElement;
    await act(async () => {
      editor.innerHTML = '<p><mark>Thought</mark></p>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.innerHTML = '<ul data-checklist="true"><li><input type="checkbox"> Thought</li></ul>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => ref.current!.undo());
    expect(editor.querySelector('mark')?.textContent).toBe('Thought');
    expect(editor.querySelector('[data-checklist]')).toBeNull();
    await act(async () => ref.current!.undo());
    expect(editor.querySelector('mark')).toBeNull();
    expect(editor.textContent).toBe('Thought');
  });
  it('inserts at the saved caret and restores that exact placement after reopening', async () => {
    const ref = createRef<RichTextEditorHandle>();
    let saved = { html: '<p>Before after</p>', plain: 'Before after' };
    const onChange = vi.fn((html: string, plain: string) => { saved = { html, plain }; return true; });
    const render = (html: string) => root.render(<RichTextEditor ref={ref} noteId="n" initialHtml={html} attachments={[attachment]}
      disabled={false} drawingEnabled={false} describedBy="status" onChange={onChange} onBlur={() => undefined} onPasteFiles={() => undefined} />);
    await act(async () => render(saved.html));
    const editor = container.querySelector('[role="textbox"]')!;
    const range = document.createRange(); range.setStart(editor.firstChild!.firstChild!, 7); range.collapse(true);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    await act(async () => editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    await act(async () => ref.current!.insertAttachments([attachment]));
    expect(saved.html).toBe('<p>Before <span data-skrib-attachment="attachment-1" contenteditable="false"></span>after</p>');
    expect(saved.plain).toBe('Before after');
    expect(editor.querySelector('img')?.getAttribute('alt')).toBe('reference.png');
    expect(saved.html).not.toContain('blob:');
    await act(async () => ref.current!.flush());
    expect(saved.plain).toBe('Before after');
    await act(async () => render(saved.html));
    expect(editor.querySelectorAll('[data-skrib-attachment]')).toHaveLength(1);
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => render(saved.html));
    expect(container.querySelector('p')?.firstChild?.textContent).toBe('Before ');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:test');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it.each([
    ['image', 'reference.png', 'image/png'],
    ['video', 'clip.mp4', 'video/mp4'],
    ['document', 'brief.pdf', 'application/pdf'],
  ] as const)('requests removal of an inline %s from its visible cross', async (kind, name, mimeType) => {
    const onDeleteAttachment = vi.fn();
    await act(async () => root.render(<RichTextEditor noteId="n" initialHtml='<p>Thought<span data-skrib-attachment="attachment-1" contenteditable="false"></span></p>'
      attachments={[{ ...attachment, kind, name, mimeType }]} disabled={false} drawingEnabled={false} describedBy="status" onChange={() => true} onBlur={() => undefined} onPasteFiles={() => undefined}
      onDeleteAttachment={onDeleteAttachment} />));
    await act(async () => (container.querySelector(`[aria-label="Remove ${name} from note"]`) as HTMLButtonElement).click());
    expect(onDeleteAttachment).toHaveBeenCalledWith('attachment-1');
    expect(container.querySelector(`[aria-label="Options for ${name}"]`)).not.toBeNull();
  });
  it('removes an empty image paragraph without adding a newline to the note', async () => {
    const ref = createRef<RichTextEditorHandle>();
    const onChange = vi.fn(() => true);
    await act(async () => root.render(<RichTextEditor ref={ref} noteId="n"
      initialHtml='<p>Thought</p><p><span data-skrib-attachment="attachment-1" contenteditable="false"></span></p>'
      attachments={[attachment]} disabled={false} drawingEnabled={false} describedBy="status"
      onChange={onChange} onBlur={() => undefined} onPasteFiles={() => undefined} />));
    await act(async () => ref.current!.removeAttachment('attachment-1'));
    expect(onChange).toHaveBeenLastCalledWith('<p>Thought</p>', 'Thought');
  });

  it('does not insert or move attachments while writing is disabled', async () => {
    const ref = createRef<RichTextEditorHandle>(); const onChange = vi.fn(() => true);
    await act(async () => root.render(<RichTextEditor ref={ref} noteId="n" initialHtml='<p>Read only</p>' attachments={[attachment]}
      disabled drawingEnabled={false} describedBy="status" onChange={onChange} onBlur={() => undefined} onPasteFiles={() => undefined} />));
    await act(async () => ref.current!.insertAttachments([attachment]));
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[data-skrib-attachment]')).toBeNull();
  });
});
