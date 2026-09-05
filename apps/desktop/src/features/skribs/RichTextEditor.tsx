import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import { Bold, Highlighter, List, ListChecks, ListOrdered, Paperclip } from 'lucide-react';

export interface RichTextEditorHandle {
  flush: () => void;
}

interface RichTextEditorProps {
  noteId: string;
  initialHtml: string;
  disabled: boolean;
  drawingEnabled: boolean;
  describedBy: string;
  onChange: (html: string, plainText: string) => boolean;
  onBlur: () => void;
  onPasteFiles: (files: File[]) => void;
  onAttach: () => void;
}

const SAFE_ELEMENTS = new Set(['DIV', 'P', 'BR', 'STRONG', 'B', 'MARK', 'UL', 'OL', 'LI', 'INPUT']);

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replace(/\r?\n/g, '<br>');
}

export function plainTextToRichHtml(value: string): string {
  return value ? `<div>${escapeHtml(value)}</div>` : '';
}

export function sanitizeRichTextHtml(value: string): string {
  const parsed = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  if (!root) return '';

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return null;

    const isVisualHighlight =
      node.tagName === 'SPAN' &&
      /background(?:-color)?\s*:/i.test(node.getAttribute('style') ?? '');
    const tag = isVisualHighlight ? 'MARK' : node.tagName;
    if (!SAFE_ELEMENTS.has(tag)) {
      const fragment = document.createDocumentFragment();
      node.childNodes.forEach((child) => {
        const clean = cleanNode(child);
        if (clean) fragment.appendChild(clean);
      });
      return fragment;
    }

    const clean = document.createElement(tag === 'B' ? 'strong' : tag.toLowerCase());
    if (tag === 'INPUT') {
      clean.setAttribute('type', 'checkbox');
      clean.setAttribute('contenteditable', 'false');
      if ((node as HTMLInputElement).checked || node.hasAttribute('checked')) clean.setAttribute('checked', '');
      return clean;
    }
    if (tag === 'UL' && node.hasAttribute('data-checklist')) clean.setAttribute('data-checklist', 'true');
    node.childNodes.forEach((child) => {
      const cleanChild = cleanNode(child);
      if (cleanChild) clean.appendChild(cleanChild);
    });
    return clean;
  };

  const output = document.createElement('div');
  root.childNodes.forEach((child) => {
    const clean = cleanNode(child);
    if (clean) output.appendChild(clean);
  });
  return output.innerHTML;
}

function clipboardFiles(event: ClipboardEvent<HTMLDivElement>): File[] {
  return Array.from(event.clipboardData.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { noteId, initialHtml, disabled, drawingEnabled, describedBy, onChange, onBlur, onPasteFiles, onAttach },
  forwardedRef
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastAcceptedHtml = useRef(initialHtml);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = initialHtml || '';
    if (editor.innerHTML !== next) editor.innerHTML = next;
    lastAcceptedHtml.current = next;
  }, [initialHtml, noteId]);

  useEffect(() => {
    if (!disabled) window.setTimeout(() => editorRef.current?.focus(), 0);
  }, [disabled, noteId]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeRichTextHtml(editor.innerHTML);
    const plainText = (editor.innerText ?? '').replaceAll('\u00a0', ' ');
    if (onChange(html, plainText)) {
      lastAcceptedHtml.current = html;
      if (editor.innerHTML !== html) editor.innerHTML = html;
    } else {
      editor.innerHTML = lastAcceptedHtml.current;
    }
  };

  useImperativeHandle(forwardedRef, () => ({ flush: emitChange }));

  const runCommand = (command: string, value?: string) => {
    if (disabled || drawingEnabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  };

  const insertChecklist = () => {
    if (disabled || drawingEnabled) return;
    editorRef.current?.focus();
    document.execCommand('insertUnorderedList');
    const selection = window.getSelection();
    const node = selection?.anchorNode instanceof Element
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
    const list = node?.closest('ul');
    if (list) {
      list.setAttribute('data-checklist', 'true');
      list.querySelectorAll(':scope > li').forEach((item) => {
        if (!item.querySelector(':scope > input[type="checkbox"]')) {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.contentEditable = 'false';
          item.prepend(checkbox, document.createTextNode(' '));
        }
      });
    }
    emitChange();
  };

  const handleInput = (_event: FormEvent<HTMLDivElement>) => emitChange();
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = clipboardFiles(event);
    if (files.length > 0) {
      event.preventDefault();
      onPasteFiles(files);
      return;
    }
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const plain = event.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html ? sanitizeRichTextHtml(html) : escapeHtml(plain));
    emitChange();
  };

  return (
    <div className="composer-rich-editor-shell">
      <div className="composer-format-bar" aria-label="Writing tools">
        <button type="button" onClick={() => runCommand('bold')} disabled={disabled || drawingEnabled} aria-label="Bold selected text" title="Give the selected words a little more weight"><Bold size={14} /></button>
        <button type="button" onClick={() => runCommand('backColor', '#f8df78')} disabled={disabled || drawingEnabled} aria-label="Highlight selected text" title="Keep this part easy to find"><Highlighter size={14} /></button>
        <button type="button" onClick={() => runCommand('insertUnorderedList')} disabled={disabled || drawingEnabled} aria-label="Bulleted list" title="Turn these thoughts into a tidy list"><List size={14} /></button>
        <button type="button" onClick={() => runCommand('insertOrderedList')} disabled={disabled || drawingEnabled} aria-label="Numbered list" title="Put these steps in order"><ListOrdered size={14} /></button>
        <button type="button" onClick={insertChecklist} disabled={disabled || drawingEnabled} aria-label="Checklist" title="Make a list you can tick off"><ListChecks size={14} /></button>
      </div>
      <div
        ref={editorRef}
        className="composer-textarea"
        contentEditable={!disabled && !drawingEnabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-describedby={describedBy}
        data-placeholder="Write the thought before it disappears…"
        spellCheck
        onInput={handleInput}
        onClick={(event) => {
          if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'checkbox') return;
          event.target.toggleAttribute('checked', event.target.checked);
          emitChange();
        }}
        onBlur={onBlur}
        onPaste={handlePaste}
      />
      <button type="button" className="composer-inline-attach" onClick={onAttach} disabled={disabled || drawingEnabled} aria-label="Attach a photo, video, or document" title="Drop a photo, video, or file into this Skrib"><Paperclip size={15} /></button>
    </div>
  );
});
