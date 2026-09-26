export const ATTACHMENT_ATTRIBUTE = 'data-skrib-attachment';
export const ATTACHMENT_SIZE_ATTRIBUTE = 'data-skrib-attachment-size';
export type InlineAttachmentSize = 'small' | 'medium' | 'large';
export const ATTACHMENT_SELECTOR = `[${ATTACHMENT_ATTRIBUTE}]`;
const SAFE_ATTACHMENT_ID = /^[a-zA-Z0-9_-]{1,180}$/;

export function readAttachmentSize(node: Element): InlineAttachmentSize {
  const size = node.getAttribute(ATTACHMENT_SIZE_ATTRIBUTE);
  return size === 'medium' || size === 'large' ? size : 'small';
}

export function createAttachmentReference(id: string, size: InlineAttachmentSize = 'small'): HTMLSpanElement | null {
  if (!SAFE_ATTACHMENT_ID.test(id)) return null;
  const node = document.createElement('span');
  node.setAttribute(ATTACHMENT_ATTRIBUTE, id);
  if (size !== 'small') node.setAttribute(ATTACHMENT_SIZE_ATTRIBUTE, size);
  node.setAttribute('contenteditable', 'false');
  return node;
}

/** Strip live preview markup/URLs; only the local attachment identity is persisted. */
export function canonicalAttachmentHtml(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(ATTACHMENT_SELECTOR).forEach((node) => {
    const reference = createAttachmentReference(node.getAttribute(ATTACHMENT_ATTRIBUTE) ?? '', readAttachmentSize(node));
    if (reference) node.replaceWith(reference);
    else node.remove();
  });
  return clone.innerHTML;
}

export function editorPlainText(editor: HTMLElement): string {
  const read = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof HTMLElement) || node.hasAttribute(ATTACHMENT_ATTRIBUTE) || node.tagName === 'INPUT') return '';
    if (node.tagName === 'BR') return '\n';
    const text = Array.from(node.childNodes).map(read).join('');
    if (['DIV', 'P', 'H2', 'LI'].includes(node.tagName) && !text && node.querySelector(ATTACHMENT_SELECTOR)) return '';
    return ['DIV', 'P', 'H2', 'LI'].includes(node.tagName) && !text.endsWith('\n') ? `${text}\n` : text;
  };
  return Array.from(editor.childNodes).map(read).join('').replaceAll('\u00a0', ' ').replace(/\n$/, '');
}

export function readAttachmentDrag(raw: string, noteId: string, allowedIds: ReadonlySet<string>): string | null {
  try {
    const value = JSON.parse(raw);
    return value?.noteId === noteId && typeof value.attachmentId === 'string' && allowedIds.has(value.attachmentId)
      ? value.attachmentId : null;
  } catch { return null; }
}

/** Move a reference, not its underlying file, across adjacent text blocks. */
export function moveAttachmentByBlock(editor: HTMLElement, atom: HTMLElement, direction: -1 | 1): boolean {
  if (!editor.contains(atom)) return false;
  let block: Node = atom;
  while (block.parentNode && block.parentNode !== editor) block = block.parentNode;
  const neighbour = direction < 0 ? block.previousSibling : block.nextSibling;
  if (block === atom && !neighbour) return false;
  if (direction < 0) editor.insertBefore(atom, neighbour ?? block);
  else editor.insertBefore(atom, neighbour ? neighbour.nextSibling : block.nextSibling);
  return true;
}
