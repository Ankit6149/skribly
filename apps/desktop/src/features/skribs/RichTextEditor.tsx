import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import {
  Bell,
  Bold,
  Highlighter,
  List,
  ListChecks,
  ListOrdered,
  Paperclip,
  PenLine,
  Plus,
} from 'lucide-react';

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
  onReminder: () => void;
  onInk: () => void;
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
  {
    noteId,
    initialHtml,
    disabled,
    drawingEnabled,
    describedBy,
    onChange,
    onBlur,
    onPasteFiles,
    onAttach,
    onReminder,
    onInk,
  },
  forwardedRef
) {
  const shellRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastAcceptedHtml = useRef(initialHtml);
  const [formatBubble, setFormatBubble] = useState<{ left: number; top: number } | null>(null);
  const [insertMenu, setInsertMenu] = useState<{ left: number; top: number } | null>(null);

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

  useEffect(() => {
    if (!disabled && !drawingEnabled) return;
    setFormatBubble(null);
    setInsertMenu(null);
  }, [disabled, drawingEnabled]);

  const relativePointForRange = (range: Range, preferAbove = false) => {
    const shell = shellRef.current?.getBoundingClientRect();
    const rect = range.getBoundingClientRect();
    if (!shell || (!rect.width && !rect.height)) return { left: 24, top: 54 };
    const left = Math.max(12, Math.min(rect.left - shell.left, shell.width - 190));
    const rawTop = preferAbove ? rect.top - shell.top - 44 : rect.bottom - shell.top + 7;
    const top = Math.max(8, Math.min(rawTop, shell.height - 56));
    return { left, top };
  };

  const selectionInsideEditor = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return { selection, range };
  };

  const updateFormatBubble = () => {
    if (disabled || drawingEnabled) {
      setFormatBubble(null);
      return;
    }
    const current = selectionInsideEditor();
    if (!current || current.selection.isCollapsed) {
      setFormatBubble(null);
      return;
    }
    setInsertMenu(null);
    setFormatBubble(relativePointForRange(current.range, true));
  };

  const openInsertMenu = () => {
    if (disabled || drawingEnabled) return;
    const current = selectionInsideEditor();
    if (!current) {
      setInsertMenu({ left: 24, top: 54 });
      return;
    }
    setFormatBubble(null);
    setInsertMenu(relativePointForRange(current.range));
  };

  const shouldOpenSlashMenu = () => {
    const current = selectionInsideEditor();
    if (!current || !current.selection.isCollapsed) return false;
    const { startContainer, startOffset } = current.range;
    if (startContainer.nodeType !== Node.TEXT_NODE || startOffset === 0) return true;
    const previous = startContainer.textContent?.charAt(startOffset - 1) ?? '';
    return /\s/u.test(previous);
  };

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
    setFormatBubble(null);
  };

  const insertChecklist = () => {
    if (disabled || drawingEnabled) return;
    setInsertMenu(null);
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
    <div ref={shellRef} className="composer-rich-editor-shell">
      {formatBubble && (
        <div
          className="composer-format-bar visible"
          aria-label="Text formatting"
          style={{ left: formatBubble.left, top: formatBubble.top }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <button type="button" onClick={() => runCommand('bold')} disabled={disabled || drawingEnabled} aria-label="Bold selected text" title="Bold"><Bold size={14} /></button>
          <button type="button" onClick={() => runCommand('backColor', '#f8df78')} disabled={disabled || drawingEnabled} aria-label="Highlight selected text" title="Highlight"><Highlighter size={14} /></button>
          <button type="button" onClick={() => runCommand('insertUnorderedList')} disabled={disabled || drawingEnabled} aria-label="Bulleted list" title="Bulleted list"><List size={14} /></button>
          <button type="button" onClick={() => runCommand('insertOrderedList')} disabled={disabled || drawingEnabled} aria-label="Numbered list" title="Numbered list"><ListOrdered size={14} /></button>
          <button type="button" onClick={insertChecklist} disabled={disabled || drawingEnabled} aria-label="Checklist" title="Checklist"><ListChecks size={14} /></button>
        </div>
      )}

      {insertMenu && (
        <div
          className="composer-insert-menu"
          role="menu"
          aria-label="Insert into this Skrib"
          style={{ left: insertMenu.left, top: insertMenu.top }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <button type="button" role="menuitem" onClick={() => { setInsertMenu(null); onAttach(); }}>
            <Paperclip size={14} aria-hidden="true" />
            <span><strong>Photo or file</strong><small>Attach from this device</small></span>
          </button>
          <button type="button" role="menuitem" onClick={insertChecklist}>
            <ListChecks size={14} aria-hidden="true" />
            <span><strong>Checklist</strong><small>Make this thought actionable</small></span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setInsertMenu(null); onReminder(); }}>
            <Bell size={14} aria-hidden="true" />
            <span><strong>Reminder</strong><small>Bring this thought back</small></span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setInsertMenu(null); onInk(); }}>
            <PenLine size={14} aria-hidden="true" />
            <span><strong>Ink</strong><small>Write or highlight on the paper</small></span>
          </button>
        </div>
      )}

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
        onInput={(event) => {
          handleInput(event);
          setInsertMenu(null);
        }}
        onClick={(event) => {
          if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
            event.target.toggleAttribute('checked', event.target.checked);
            emitChange();
          }
          window.setTimeout(updateFormatBubble, 0);
        }}
        onMouseUp={() => window.setTimeout(updateFormatBubble, 0)}
        onKeyUp={() => window.setTimeout(updateFormatBubble, 0)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && (insertMenu || formatBubble)) {
            event.preventDefault();
            setInsertMenu(null);
            setFormatBubble(null);
            return;
          }
          const commandShortcut = (event.ctrlKey || event.metaKey) && event.key === '/';
          const slashAtInsertionPoint =
            event.key === '/' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            shouldOpenSlashMenu();
          if (commandShortcut || slashAtInsertionPoint) {
            event.preventDefault();
            openInsertMenu();
          }
        }}
        onBlur={() => {
          setFormatBubble(null);
          onBlur();
        }}
        onPaste={handlePaste}
      />

      <button
        type="button"
        className="composer-inline-attach"
        onClick={onAttach}
        disabled={disabled || drawingEnabled}
        aria-label="Add to this Skrib"
        title="Add photo, file, checklist, reminder, or ink"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          editorRef.current?.focus();
          openInsertMenu();
        }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
});