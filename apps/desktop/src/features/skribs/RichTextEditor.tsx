import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import { Bold, Highlighter, List, ListChecks, ListOrdered, Paperclip } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { SkribAttachment } from '../../lib/richContentStore';
import { InlineAttachment, INLINE_ATTACHMENT_MIME } from './InlineAttachment';
import { ATTACHMENT_ATTRIBUTE, ATTACHMENT_SIZE_ATTRIBUTE, ATTACHMENT_SELECTOR, canonicalAttachmentHtml, createAttachmentReference, editorPlainText, moveAttachmentByBlock, readAttachmentDrag, readAttachmentSize } from './inlineAttachmentModel';

export interface RichTextEditorHandle {
  flush: () => void;
  insertChecklist: () => void;
  insertAttachments: (attachments: SkribAttachment[]) => boolean;
  removeAttachment: (id: string) => void;
  undo: () => void;
  redo: () => void;
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
  onRequestAttachment?: (() => void) | undefined;
  onDeleteAttachment?: ((id: string) => void) | undefined;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  attachments?: SkribAttachment[];
}

const NO_ATTACHMENTS: SkribAttachment[] = [];

const SAFE_ELEMENTS = new Set(['DIV', 'P', 'H2', 'BR', 'STRONG', 'B', 'MARK', 'UL', 'OL', 'LI', 'INPUT']);

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

export function sanitizeRichTextHtml(value: string, allowAttachmentReferences = false): string {
  const parsed = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  if (!root) return '';

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return null;

    if (node.hasAttribute(ATTACHMENT_ATTRIBUTE)) {
      return allowAttachmentReferences ? createAttachmentReference(node.getAttribute(ATTACHMENT_ATTRIBUTE) ?? '', readAttachmentSize(node)) : null;
    }

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
  { noteId, initialHtml, disabled, drawingEnabled, describedBy, onChange, onBlur, onPasteFiles, onRequestAttachment, onDeleteAttachment, onHistoryChange, attachments = NO_ATTACHMENTS },
  forwardedRef
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastAcceptedHtml = useRef(initialHtml);
  const [formatBarVisible, setFormatBarVisible] = useState(false);
  const [formatBarAnchor, setFormatBarAnchor] = useState({ top: 8, left: 48 });
  const [checklistAtCaret, setChecklistAtCaret] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashMenuAnchor, setSlashMenuAnchor] = useState({ top: 44, left: 48 });
  const savedSelection = useRef<Range | null>(null);
  const [attachmentHosts, setAttachmentHosts] = useState<HTMLElement[]>([]);
  const activeNoteId = useRef(noteId);
  const commandInProgress = useRef(false);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const notifyHistory = () => onHistoryChange?.(past.current.length > 0, future.current.length > 0);

  const refreshAttachmentHosts = () => {
    const nodes = Array.from(editorRef.current?.querySelectorAll<HTMLElement>(ATTACHMENT_SELECTOR) ?? []);
    nodes.forEach((node) => { node.className = 'inline-attachment'; });
    setAttachmentHosts((previous) => previous.length === nodes.length && previous.every((node, index) => node === nodes[index]) ? previous : nodes);
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = sanitizeRichTextHtml(initialHtml || '', true);
    const changedNote = activeNoteId.current !== noteId;
    if (changedNote || next !== lastAcceptedHtml.current) {
      past.current = [];
      future.current = [];
      notifyHistory();
    }
    if (changedNote || sanitizeRichTextHtml(canonicalAttachmentHtml(editor), true) !== next) {
      editor.innerHTML = next;
      savedSelection.current = null;
      setFormatBarVisible(false);
      setSlashMenuOpen(false);
    }
    activeNoteId.current = noteId;
    lastAcceptedHtml.current = next;
    refreshAttachmentHosts();
  }, [initialHtml, noteId]);

  useEffect(() => {
    if (disabled) return;
    const timer = window.setTimeout(() => editorRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [disabled, noteId]);

  useEffect(() => {
    const keepFloatingToolsInsidePaper = () => {
      const shell = editorRef.current?.parentElement;
      if (!shell) return;
      setSlashMenuAnchor((anchor) => ({
        top: Math.max(8, Math.min(anchor.top, shell.clientHeight - 164)),
        left: Math.max(8, Math.min(anchor.left, shell.clientWidth - 202)),
      }));
      setFormatBarAnchor((anchor) => ({
        top: Math.max(4, Math.min(anchor.top, shell.clientHeight - 40)),
        left: Math.max(8, Math.min(anchor.left, shell.clientWidth - 184)),
      }));
    };
    window.addEventListener('resize', keepFloatingToolsInsidePaper);
    return () => window.removeEventListener('resize', keepFloatingToolsInsidePaper);
  }, []);

  const emitChange = (): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    const html = sanitizeRichTextHtml(canonicalAttachmentHtml(editor), true);
    const plainText = editorPlainText(editor);
    if (html === lastAcceptedHtml.current) return true;
    if (onChange(html, plainText)) {
      past.current.push(lastAcceptedHtml.current);
      if (past.current.length > 80) past.current.shift();
      future.current = [];
      lastAcceptedHtml.current = html;
      notifyHistory();
      refreshAttachmentHosts();
      return true;
    } else {
      editor.innerHTML = lastAcceptedHtml.current;
    }
    refreshAttachmentHosts();
    return false;
  };

  const travelHistory = (direction: 'undo' | 'redo') => {
    if (disabled || drawingEnabled) return;
    const editor = editorRef.current;
    const source = direction === 'undo' ? past.current : future.current;
    const destination = direction === 'undo' ? future.current : past.current;
    const next = source.at(-1);
    if (!editor || next === undefined) return;
    const current = lastAcceptedHtml.current;
    editor.innerHTML = next;
    if (!onChange(next, editorPlainText(editor))) {
      editor.innerHTML = current;
      refreshAttachmentHosts();
      return;
    }
    source.pop();
    destination.push(current);
    lastAcceptedHtml.current = next;
    savedSelection.current = null;
    setFormatBarVisible(false);
    setSlashMenuOpen(false);
    refreshAttachmentHosts();
    notifyHistory();
    editor.focus();
  };

  const updateFormatBarVisibility = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      setFormatBarVisible(false);
      setChecklistAtCaret(false);
      return;
    }
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const inside = editor.contains(range.commonAncestorContainer) && !ancestor?.closest(ATTACHMENT_SELECTOR);
    if (inside) savedSelection.current = range.cloneRange();
    setChecklistAtCaret(Boolean(inside && ancestor?.closest('ul[data-checklist="true"]')));
    if (inside && !selection.isCollapsed) {
      const shell = editor.parentElement?.getBoundingClientRect();
      const selected = range.getBoundingClientRect?.();
      if (shell && selected && selected.width + selected.height > 0) {
        setFormatBarAnchor({
          top: Math.max(4, Math.min(shell.height - 40, selected.top - shell.top - 42)),
          left: Math.max(8, Math.min(shell.width - 184, selected.left - shell.left)),
        });
      }
    }
    setFormatBarVisible(inside && !selection.isCollapsed && !disabled && !drawingEnabled);
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    editor?.focus();
    const range = savedSelection.current;
    if (range && editor?.contains(range.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else if (editor) {
      const end = document.createRange();
      end.selectNodeContents(editor);
      end.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(end);
    }
  };

  const insertAttachments = (items: SkribAttachment[]): boolean => {
    const editor = editorRef.current;
    if (!editor || disabled || drawingEnabled || items.length === 0) return false;
    restoreSelection();
    const range = window.getSelection()?.getRangeAt(0);
    if (!range || !editor.contains(range.commonAncestorContainer)) return false;
    // Moving an existing reference never deletes the original file or selected text.
    range.collapse(false);
    let placed = 0;
    for (const item of items) {
      const existing = Array.from(editor.querySelectorAll<HTMLElement>(ATTACHMENT_SELECTOR)).find((node) => node.getAttribute(ATTACHMENT_ATTRIBUTE) === item.id);
      if (existing?.contains(range.startContainer)) { placed++; continue; }
      const node = existing ?? createAttachmentReference(item.id);
      if (!node) continue;
      range.insertNode(node);
      placed++;
      range.setStartAfter(node);
      range.collapse(true);
    }
    savedSelection.current = range.cloneRange();
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    return placed === items.length && emitChange();
  };

  const removeAttachment = (id: string) => {
    if (disabled || drawingEnabled) return;
    editorRef.current?.querySelectorAll(ATTACHMENT_SELECTOR).forEach((node) => {
      if (node.getAttribute(ATTACHMENT_ATTRIBUTE) !== id) return;
      const parent = node.parentElement;
      node.remove();
      if (parent && ['P', 'DIV'].includes(parent.tagName) && !parent.textContent?.trim() &&
        !parent.querySelector(ATTACHMENT_SELECTOR) && parent !== editorRef.current) parent.remove();
    });
    emitChange();
  };

  const runCommand = (command: string, value?: string) => {
    if (disabled || drawingEnabled) return;
    restoreSelection();
    commandInProgress.current = true;
    try { document.execCommand(command, false, value); }
    finally { commandInProgress.current = false; }
    emitChange();
    updateFormatBarVisibility();
  };

  const insertChecklist = () => {
    if (disabled || drawingEnabled) return;
    restoreSelection();
    const selection = window.getSelection();
    const selectedNode = selection?.anchorNode instanceof Element
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
    const existingList = selectedNode?.closest('ul');
    const existingChecklist = existingList?.hasAttribute('data-checklist');
    commandInProgress.current = true;
    try {
      if (existingChecklist && existingList) {
        existingList.querySelectorAll(':scope > li > input[type="checkbox"]').forEach((input) => input.remove());
        existingList.removeAttribute('data-checklist');
        document.execCommand('insertUnorderedList');
      } else if (!existingList) {
        document.execCommand('insertUnorderedList');
      }
    }
    finally { commandInProgress.current = false; }
    const node = selection?.anchorNode instanceof Element
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
    const list = node?.closest('ul');
    if (!existingChecklist && list && editorRef.current?.contains(list)) {
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
    updateFormatBarVisibility();
  };

  const openSlashMenu = () => {
    updateFormatBarVisibility();
    const editor = editorRef.current;
    const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
    const shell = editor?.parentElement?.getBoundingClientRect();
    const caret = range?.getBoundingClientRect?.();
    if (shell && caret && caret.width + caret.height > 0) {
      setSlashMenuAnchor({
        top: Math.max(8, Math.min(shell.height - 164, caret.bottom - shell.top + 8)),
        left: Math.max(8, Math.min(shell.width - 202, caret.left - shell.left)),
      });
    }
    setSlashIndex(0);
    setSlashMenuOpen(true);
  };

  const slashActions = [
    { label: checklistAtCaret ? 'Remove checklist' : 'Checklist', shortcut: 'C', icon: ListChecks, run: insertChecklist },
    { label: 'Attach inline', shortcut: 'A', icon: Paperclip, run: () => onRequestAttachment?.() },
    { label: 'Bulleted list', shortcut: 'B', icon: List, run: () => runCommand('insertUnorderedList') },
  ];

  const runSlashAction = (index: number) => {
    setSlashMenuOpen(false);
    slashActions[index]?.run();
  };

  useImperativeHandle(forwardedRef, () => ({
    flush: emitChange,
    insertChecklist,
    insertAttachments,
    removeAttachment,
    undo: () => travelHistory('undo'),
    redo: () => travelHistory('redo'),
  }));

  const handleInput = (_event: FormEvent<HTMLDivElement>) => {
    if (!commandInProgress.current) emitChange();
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled || drawingEnabled) { event.preventDefault(); return; }
    const files = clipboardFiles(event);
    if (files.length > 0) {
      event.preventDefault();
      updateFormatBarVisibility();
      onPasteFiles(files);
      return;
    }
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const plain = event.clipboardData.getData('text/plain');
    commandInProgress.current = true;
    try { document.execCommand('insertHTML', false, html ? sanitizeRichTextHtml(html) : escapeHtml(plain)); }
    finally { commandInProgress.current = false; }
    emitChange();
  };

  return (
    <div className="composer-rich-editor-shell">
      {formatBarVisible && !disabled && !drawingEnabled && (
        <div className="composer-format-bar" style={formatBarAnchor} aria-label="Selected text tools">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')} disabled={disabled || drawingEnabled} aria-label="Bold selected text" title="Bold"><Bold size={14} /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('backColor', '#f8df78')} disabled={disabled || drawingEnabled} aria-label="Highlight selected text" title="Highlight"><Highlighter size={14} /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')} disabled={disabled || drawingEnabled} aria-label="Bulleted list" title="Bulleted list"><List size={14} /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertOrderedList')} disabled={disabled || drawingEnabled} aria-label="Numbered list" title="Numbered list"><ListOrdered size={14} /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={insertChecklist} aria-label={checklistAtCaret ? 'Remove checklist' : 'Checklist'} title="Checklist"><ListChecks size={14} /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onRequestAttachment} disabled={!onRequestAttachment} aria-label="Attach inline" title="Attach inline"><Paperclip size={14} /></button>
        </div>
      )}
      {slashMenuOpen && !disabled && !drawingEnabled && (
        <div className="composer-slash-menu" style={slashMenuAnchor} role="listbox" aria-label="Insert in note">
          {slashActions.map(({ label, shortcut, icon: Icon }, index) => (
            <button type="button" role="option" aria-selected={slashIndex === index} key={label}
              disabled={label === 'Attach inline' && !onRequestAttachment}
              onMouseDown={(event) => event.preventDefault()} onClick={() => runSlashAction(index)}>
              <Icon size={15} aria-hidden="true" /><span>{label}</span><kbd>{shortcut}</kbd>
            </button>
          ))}
        </div>
      )}
      <div
        ref={editorRef}
        className="composer-textarea"
        contentEditable={!disabled && !drawingEnabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Skrib text"
        aria-multiline="true"
        aria-describedby={describedBy}
        data-placeholder="Write a thought… Type / for tools"
        spellCheck
        onInput={handleInput}
        onDragOver={(event) => {
          if (!disabled && !drawingEnabled && (event.dataTransfer.types.includes(INLINE_ATTACHMENT_MIME) || event.dataTransfer.types.includes('Files'))) {
            event.preventDefault();
            event.dataTransfer.dropEffect = event.dataTransfer.types.includes(INLINE_ATTACHMENT_MIME) ? 'move' : 'copy';
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled || drawingEnabled) return;
          const editor = editorRef.current;
          if (!editor) return;
          const pointDocument = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
          const range = pointDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
          const ancestor = range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement;
          if (!range || !editor.contains(range.startContainer) || ancestor?.closest(ATTACHMENT_SELECTOR)) return;
          savedSelection.current = range.cloneRange();
          const id = readAttachmentDrag(event.dataTransfer.getData(INLINE_ATTACHMENT_MIME), noteId, new Set(attachments.map((item) => item.id)));
          if (id) insertAttachments(attachments.filter((item) => item.id === id));
          else if (event.dataTransfer.files.length) onPasteFiles(Array.from(event.dataTransfer.files));
        }}
        onMouseUp={updateFormatBarVisibility}
        onKeyUp={updateFormatBarVisibility}
        onFocus={updateFormatBarVisibility}
        onKeyDown={(event) => {
          if (slashMenuOpen) {
            if (event.key === 'Escape') { event.preventDefault(); setSlashMenuOpen(false); return; }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setSlashIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : slashActions.length - 1)) % slashActions.length);
              return;
            }
            if (event.key === 'Enter') { event.preventDefault(); runSlashAction(slashIndex); return; }
            if (['c', 'a', 'b'].includes(event.key.toLowerCase())) {
              event.preventDefault();
              runSlashAction(['c', 'a', 'b'].indexOf(event.key.toLowerCase()));
              return;
            }
            setSlashMenuOpen(false);
          }
          if (event.key === '/' && !event.altKey && !event.shiftKey && !event.metaKey) {
            const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
            const node = range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement;
            const block = node?.closest('p, div, li, h2');
            const prefix = range?.cloneRange();
            if (prefix && block?.closest('.composer-textarea') && range?.collapsed) {
              prefix.selectNodeContents(block);
              prefix.setEnd(range.startContainer, range.startOffset);
            }
            if (event.ctrlKey || (range?.collapsed && (!block || prefix?.toString().trim() === ''))) {
              event.preventDefault(); openSlashMenu(); return;
            }
          }
          if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
          const key = event.key.toLowerCase();
          if (key === 'z' || key === 'y') {
            event.preventDefault();
            travelHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
          }
        }}
        onClick={(event) => {
          if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
            event.target.toggleAttribute('checked', event.target.checked);
            emitChange();
          }
          updateFormatBarVisibility();
        }}
        onBlur={(event) => {
          updateFormatBarVisibility();
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            setFormatBarVisible(false);
            setSlashMenuOpen(false);
          }
          onBlur();
        }}
        onPaste={handlePaste}
      />
      {attachmentHosts.map((host) => {
        const id = host.getAttribute(ATTACHMENT_ATTRIBUTE);
        const attachment = attachments.find((item) => item.id === id);
        return createPortal(attachment ? <InlineAttachment attachment={attachment}
          disabled={disabled || drawingEnabled}
          size={readAttachmentSize(host)}
          onSizeChange={(size) => {
            if (disabled || drawingEnabled) return;
            if (size === 'small') host.removeAttribute(ATTACHMENT_SIZE_ATTRIBUTE);
            else host.setAttribute(ATTACHMENT_SIZE_ATTRIBUTE, size);
            emitChange();
          }}
          onDelete={onDeleteAttachment ? () => onDeleteAttachment(attachment.id) : undefined}
          onMove={(direction) => {
            if (!disabled && !drawingEnabled && editorRef.current && moveAttachmentByBlock(editorRef.current, host, direction)) emitChange();
          }} /> : <span className="inline-attachment-missing">Attachment unavailable · check the tray</span>, host, id ?? undefined);
      })}
    </div>
  );
});
