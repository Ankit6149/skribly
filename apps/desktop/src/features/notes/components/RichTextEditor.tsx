import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import { Bold, Highlighter, List, ListChecks, ListOrdered, Paperclip, Italic, Underline, Palette, Heading2, Quote, Minus, CalendarDays, Bell, PenLine, Type, Eraser, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { SkribAttachment } from '../persistence/richContentStore';
import { InlineAttachment, INLINE_ATTACHMENT_MIME } from './InlineAttachment';
import { ATTACHMENT_ATTRIBUTE, ATTACHMENT_SIZE_ATTRIBUTE, ATTACHMENT_SELECTOR, canonicalAttachmentHtml, createAttachmentReference, editorPlainText, moveAttachmentByBlock, readAttachmentDrag, readAttachmentSize } from '../model/inlineAttachmentModel';

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
  onRequestDraw?: (() => void) | undefined;
  onRequestReminder?: (() => void) | undefined;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  attachments?: SkribAttachment[];
}

const NO_ATTACHMENTS: SkribAttachment[] = [];

const SAFE_ELEMENTS = new Set(['DIV', 'P', 'H2', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'SPAN', 'FONT', 'BLOCKQUOTE', 'HR', 'UL', 'OL', 'LI', 'INPUT']);
export const NOTE_TEXT_COLORS = ['#262923', '#925043', '#3f645c', '#486b8c', '#735c96'] as const;
export const NOTE_HIGHLIGHT_COLORS = ['#f8df78', '#ffd7c4', '#cfe5d7', '#d5e5f5', '#e4d9f0'] as const;
const COLOR_NAMES = ['Ink', 'Terracotta', 'Forest', 'Blue', 'Plum'];
const HIGHLIGHT_NAMES = ['Yellow', 'Peach', 'Mint', 'Sky', 'Lavender'];
function safeColor(value: string, choices: readonly string[]): string | undefined {
  const probe = document.createElement('span');
  probe.style.color = value;
  const canonical = probe.style.color;
  return choices.find((choice) => { probe.style.color = choice; return canonical && probe.style.color === canonical; });
}

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

    const color = safeColor(node.style.color || node.getAttribute('color') || '', NOTE_TEXT_COLORS);
    const background = safeColor(node.style.backgroundColor, NOTE_HIGHLIGHT_COLORS);
    const tag = node.tagName;
    if (!SAFE_ELEMENTS.has(tag)) {
      const fragment = document.createDocumentFragment();
      node.childNodes.forEach((child) => { const clean = cleanNode(child); if (clean) fragment.appendChild(clean); });
      return fragment;
    }
    const normalizedTag = tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag === 'FONT' ? 'span' : tag.toLowerCase();
    const clean = document.createElement(normalizedTag);
    if (color) clean.style.color = color;
    if (background) clean.style.backgroundColor = background;
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
  if (!output.textContent?.replace(/\u200b/g, '').trim() && !output.querySelector('ul[data-checklist] li') && !output.querySelector(ATTACHMENT_SELECTOR) && !output.querySelector('hr')) return '';
  return output.innerHTML;
}

function clipboardFiles(event: ClipboardEvent<HTMLDivElement>): File[] {
  const direct = Array.from(event.clipboardData.files ?? []);
  if (direct.length) return direct;
  return Array.from(event.clipboardData.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { noteId, initialHtml, disabled, drawingEnabled, describedBy, onChange, onBlur, onPasteFiles, onRequestAttachment, onRequestDraw, onRequestReminder, onHistoryChange, attachments = NO_ATTACHMENTS },
  forwardedRef
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const formatBarRef = useRef<HTMLDivElement>(null);
  const [formatPalette, setFormatPalette] = useState<'text' | 'highlight' | null>(null);
  const lastAcceptedHtml = useRef(initialHtml);
  const [formatBarVisible, setFormatBarVisible] = useState(false);
  const [formatBarAnchor, setFormatBarAnchor] = useState({ top: 8, left: 48 });
  const [checklistAtCaret, setChecklistAtCaret] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashMenuAnchor, setSlashMenuAnchor] = useState({ top: 44, left: 48 });
  const slashTriggerRange = useRef<Range | null>(null);
  const pendingSlashInput = useRef(false);
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
      slashTriggerRange.current = null;
      pendingSlashInput.current = false;
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
        top: Math.max(8, Math.min(anchor.top, shell.clientHeight - 276)),
        left: Math.max(8, Math.min(anchor.left, shell.clientWidth - 202)),
      }));
      setFormatBarAnchor((anchor) => ({
        top: Math.max(4, Math.min(anchor.top, shell.clientHeight - 40)),
        left: Math.max(8, Math.min(anchor.left, shell.clientWidth - 294)),
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
    slashTriggerRange.current = null;
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
        const above = selected.top - shell.top - 76;
        const preferred = above >= 4 ? above : selected.bottom - shell.top + 8;
        setFormatBarAnchor({
          top: Math.max(4, Math.min(shell.height - 76, preferred)),
          left: Math.max(8, Math.min(shell.width - 294, selected.left - shell.left)),
        });
      }
    }
    const visible = inside && !selection.isCollapsed && !disabled && !drawingEnabled;
    setFormatBarVisible(visible);
    if (!visible) setFormatPalette(null);
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
        top: Math.max(8, Math.min(shell.height - 276, caret.bottom - shell.top + 8)),
        left: Math.max(8, Math.min(shell.width - 202, caret.left - shell.left)),
      });
    }
    setSlashIndex(0);
    setSlashMenuOpen(true);
  };

  const slashActions = [
    { label: checklistAtCaret ? 'Remove checklist' : 'Checklist', icon: ListChecks, run: insertChecklist },
    { label: 'Attach inline', icon: Paperclip, run: () => onRequestAttachment?.() },
    { label: 'Bulleted list', icon: List, run: () => runCommand('insertUnorderedList') },
    { label: 'Numbered list', icon: ListOrdered, run: () => runCommand('insertOrderedList') },
    { label: 'Heading', icon: Heading2, run: () => runCommand('formatBlock', 'h2') },
    { label: 'Quote', icon: Quote, run: () => runCommand('formatBlock', 'blockquote') },
    { label: 'Divider', icon: Minus, run: () => runCommand('insertHorizontalRule') },
    { label: 'Today date', icon: CalendarDays, run: () => runCommand('insertText', new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date())) },
    { label: 'Set a reminder', icon: Bell, run: () => onRequestReminder?.(), disabled: !onRequestReminder },
    { label: 'Draw on note', icon: PenLine, run: () => onRequestDraw?.(), disabled: !onRequestDraw },
    { label: 'Plain paragraph', icon: Type, run: () => runCommand('formatBlock', 'div') },
  ];

  const runSlashAction = (index: number) => {
    if (!slashActions[index] || slashActions[index]?.disabled || (index === 1 && !onRequestAttachment)) return;
    setSlashMenuOpen(false);
    const trigger = slashTriggerRange.current;
    slashTriggerRange.current = null;
    if (trigger?.toString() === '/' && editorRef.current?.contains(trigger.commonAncestorContainer)) {
      trigger.deleteContents();
      savedSelection.current = trigger.cloneRange();
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(trigger);
      if (!emitChange()) return;
    }
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

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    if (pendingSlashInput.current) {
      pendingSlashInput.current = false;
      const selection = window.getSelection();
      const caret = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const node = caret?.startContainer;
      const offset = caret?.startOffset ?? 0;
      if (caret?.collapsed && node?.nodeType === Node.TEXT_NODE && offset > 0 &&
        node.textContent?.[offset - 1] === '/' && editorRef.current?.contains(node)) {
        const trigger = document.createRange();
        trigger.setStart(node, offset - 1);
        trigger.setEnd(node, offset);
        slashTriggerRange.current = trigger;
      }
    }
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
        <div ref={formatBarRef} className="composer-format-bar" style={formatBarAnchor} role="group" aria-label="Selected text tools"
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setFormatPalette(null); restoreSelection(); setFormatBarVisible(false); } }}>
          {([
            ['Bold selected text', 'Bold', Bold, 'bold'],
            ['Italic selected text', 'Italic', Italic, 'italic'],
            ['Underline selected text', 'Underline', Underline, 'underline'],
          ] as const).map(([label, title, Icon, command]) => <button key={command} type="button" onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(command)} aria-label={label} title={title}><Icon size={15} aria-hidden="true" /></button>)}
          <span className="composer-format-divider" aria-hidden="true" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setFormatPalette((value) => value === 'text' ? null : 'text')}
            aria-label="Text color" aria-expanded={formatPalette === 'text'} title="Text color"><Palette size={15} aria-hidden="true" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setFormatPalette((value) => value === 'highlight' ? null : 'highlight')}
            aria-label="Highlight color" aria-expanded={formatPalette === 'highlight'} title="Highlight color"><Highlighter size={15} aria-hidden="true" /></button>
          <span className="composer-format-divider" aria-hidden="true" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')} aria-label="Bulleted list" title="Bulleted list"><List size={15} aria-hidden="true" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertOrderedList')} aria-label="Numbered list" title="Numbered list"><ListOrdered size={15} aria-hidden="true" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={insertChecklist} aria-label={checklistAtCaret ? 'Remove checklist' : 'Checklist'} title="Checklist"><ListChecks size={15} aria-hidden="true" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('removeFormat')} aria-label="Clear text formatting" title="Clear formatting"><Eraser size={15} aria-hidden="true" /></button>
          {formatPalette && <div className="composer-format-swatches" role="group" aria-label={formatPalette === 'text' ? 'Text colors' : 'Highlight colors'}>
            {(formatPalette === 'text' ? NOTE_TEXT_COLORS : NOTE_HIGHLIGHT_COLORS).map((color, index) => <button key={color} type="button"
              style={{ '--format-swatch': color } as React.CSSProperties} className="composer-format-swatch"
              aria-label={`${formatPalette === 'text' ? COLOR_NAMES[index] : HIGHLIGHT_NAMES[index]} ${formatPalette === 'text' ? 'text' : 'highlight'}`}
              title={formatPalette === 'text' ? COLOR_NAMES[index] : HIGHLIGHT_NAMES[index]}
              onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand(formatPalette === 'text' ? 'foreColor' : 'hiliteColor', color)} />)}
            {formatPalette === 'highlight' && <button type="button" aria-label="Remove highlight" title="Remove highlight"
              onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('hiliteColor', 'transparent')}><X size={14} aria-hidden="true" /></button>}
          </div>}
        </div>
      )}
      {slashMenuOpen && !disabled && !drawingEnabled && (
        <div className="composer-slash-menu" style={slashMenuAnchor} id={`slash-menu-${noteId}`} role="listbox" aria-label="Insert in note">
          {slashActions.map(({ label, icon: Icon, disabled: unavailable }, index) => (
            <button type="button" role="option" aria-selected={slashIndex === index} key={label} id={`slash-${noteId}-${index}`}
              disabled={unavailable || (label === 'Attach inline' && !onRequestAttachment)}
              onMouseDown={(event) => event.preventDefault()} onClick={() => runSlashAction(index)}>
              <Icon size={15} aria-hidden="true" /><span>{label}</span>
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
        aria-controls={slashMenuOpen ? `slash-menu-${noteId}` : undefined}
        aria-activedescendant={slashMenuOpen ? `slash-${noteId}-${slashIndex}` : undefined}
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
            if (event.key === 'Escape') { event.preventDefault(); setSlashMenuOpen(false); slashTriggerRange.current = null; return; }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setSlashIndex((current) => {
                const next = (current + (event.key === 'ArrowDown' ? 1 : slashActions.length - 1)) % slashActions.length;
                document.getElementById(`slash-${noteId}-${next}`)?.scrollIntoView?.({ block: 'nearest' });
                return next;
              });
              return;
            }
            if (event.key === 'Enter') { event.preventDefault(); runSlashAction(slashIndex); return; }
            setSlashMenuOpen(false);
            slashTriggerRange.current = null;
          }
          if (event.key === '/' && !event.altKey && !event.metaKey && !event.nativeEvent.isComposing) {
            const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
            const node = range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement;
            const block = node?.closest('p, div, li, h2');
            const prefix = range?.cloneRange();
            if (prefix && block?.closest('.composer-textarea') && range?.collapsed) {
              prefix.selectNodeContents(block);
              prefix.setEnd(range.startContainer, range.startOffset);
            }
            if (event.ctrlKey) {
              event.preventDefault();
              slashTriggerRange.current = null;
              openSlashMenu();
              return;
            }
            if (range?.collapsed && (!block || prefix?.toString().trim() === '')) {
              pendingSlashInput.current = true;
              slashTriggerRange.current = null;
              openSlashMenu();
              return;
            }
          }
          if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
          const key = event.key.toLowerCase();
          if (key === 'f' && event.shiftKey && formatBarVisible) {
            event.preventDefault();
            formatBarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
            return;
          }
          if (['b', 'i', 'u'].includes(key)) { event.preventDefault(); runCommand(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline'); return; }
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
            slashTriggerRange.current = null;
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
          onRemoveReference={() => removeAttachment(attachment.id)}
          onMove={(direction) => {
            if (!disabled && !drawingEnabled && editorRef.current && moveAttachmentByBlock(editorRef.current, host, direction)) emitChange();
          }} /> : <span className="inline-attachment-missing">Attachment unavailable · check the tray</span>, host, id ?? undefined);
      })}
    </div>
  );
});
