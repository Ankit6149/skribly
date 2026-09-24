// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { canonicalAttachmentHtml, createAttachmentReference, editorPlainText, moveAttachmentByBlock, readAttachmentDrag } from './inlineAttachmentModel';
import { sanitizeRichTextHtml } from './RichTextEditor';

describe('inline attachment references', () => {
  it('persists only the attachment identity, never live URLs or toolbar labels', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>Before</p><span data-skrib-attachment="attachment-1" class="inline-attachment"><img src="blob:private"><button>Remove</button></span><p>After</p>';
    const html = canonicalAttachmentHtml(editor);
    expect(html).toBe('<p>Before</p><span data-skrib-attachment="attachment-1" contenteditable="false"></span><p>After</p>');
    expect(editorPlainText(editor)).toBe('Before\nAfter');
    expect(sanitizeRichTextHtml(html, true)).toBe(html);
  });
  it('rejects unsafe IDs and strips references from external pasted HTML', () => {
    expect(createAttachmentReference('" onclick="bad')).toBeNull();
    expect(sanitizeRichTextHtml('<b>text</b><span data-skrib-attachment="attachment-1"><img src="https://external.test"></span>'))
      .toBe('<strong>text</strong>');
    expect(sanitizeRichTextHtml('<span data-skrib-attachment="attachment-1" onclick="bad()"><script>bad()</script></span>', true))
      .toBe('<span data-skrib-attachment="attachment-1" contenteditable="false"></span>');
  });
  it('accepts only a known attachment dragged within its own note', () => {
    const allowed = new Set(['attachment-1']);
    expect(readAttachmentDrag('{', 'note-1', allowed)).toBeNull();
    expect(readAttachmentDrag(JSON.stringify({ noteId: 'other', attachmentId: 'attachment-1' }), 'note-1', allowed)).toBeNull();
    expect(readAttachmentDrag(JSON.stringify({ noteId: 'note-1', attachmentId: 'unknown' }), 'note-1', allowed)).toBeNull();
    expect(readAttachmentDrag(JSON.stringify({ noteId: 'note-1', attachmentId: 'attachment-1' }), 'note-1', allowed)).toBe('attachment-1');
  });
  it('keeps paragraph, blank-line and checklist text without attachment controls', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<div>First <strong>thought</strong></div><div><br></div><ul><li><input type="checkbox">Task</li><li>Next</li></ul>';
    expect(editorPlainText(editor)).toBe('First thought\n\nTask\nNext');
  });
  it('moves a reference between paragraphs without moving or removing typed text', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>First</p><p>Second</p>';
    const atom = createAttachmentReference('attachment-1')!;
    editor.firstElementChild!.appendChild(atom);
    expect(moveAttachmentByBlock(editor, atom, 1)).toBe(true);
    expect(editor.lastChild).toBe(atom);
    expect(editorPlainText(editor)).toBe('First\nSecond');
    expect(moveAttachmentByBlock(editor, atom, -1)).toBe(true);
    expect(editor.childNodes[1]).toBe(atom);
    expect(editor.querySelectorAll('[data-skrib-attachment]')).toHaveLength(1);
  });
});
