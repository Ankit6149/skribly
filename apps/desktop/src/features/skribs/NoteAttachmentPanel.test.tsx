// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { removeAttachmentFromNote } from '../../lib/richContentStore';
import { NoteAttachmentPanel } from './NoteAttachmentPanel';

vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(async () => undefined) }));
vi.mock('../../lib/richContentStore', async (original) => ({
  ...await original<typeof import('../../lib/richContentStore')>(),
  getRichContent: vi.fn(async () => ({ attachments: [] })),
  addFilesToNote: vi.fn(async () => [{
    id: 'new-photo', name: 'photo.png', kind: 'image', mimeType: 'image/png',
    size: 4, createdAt: 1, blob: new Blob(['test']),
  }]),
  removeAttachmentFromNote: vi.fn(async () => []),
  createAttachmentObjectUrl: vi.fn(() => 'blob:test'),
  revokeAttachmentObjectUrl: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(removeAttachmentFromNote).mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('attachment collection', () => {
  it('opens the collection if a saved file cannot be placed inline', async () => {
    const onPlaceInline = vi.fn(() => false);
    const onRequestExpand = vi.fn(async () => true);
    await act(async () => root.render(<NoteAttachmentPanel noteId="test-note" compact
      onPlaceInline={onPlaceInline} onRequestExpand={onRequestExpand} />));
    await act(async () => root.render(<NoteAttachmentPanel noteId="test-note" compact
      filesRequest={{ id: 1, files: [new File(['test'], 'photo.png', { type: 'image/png' })] }}
      onPlaceInline={onPlaceInline} onRequestExpand={onRequestExpand} />));
    expect(onPlaceInline).toHaveBeenCalledOnce();
    expect(onRequestExpand).toHaveBeenCalledOnce();
    expect(container.querySelector('.note-attachment-strip')?.getAttribute('data-expanded')).toBe('true');
    expect(container.querySelector('.attachment-drawer-handle')?.textContent).toContain('Hide the collection');
    expect(container.querySelector('.attachment-tray-item strong')?.textContent).toBe('photo.png');
  });

  it('removes a file from storage when its inline image requests removal', async () => {
    const onRemoved = vi.fn();
    const onPlaceInline = vi.fn(() => true);
    await act(async () => root.render(<NoteAttachmentPanel noteId="test-note" compact
      onPlaceInline={onPlaceInline} onRemoved={onRemoved} />));
    await act(async () => root.render(<NoteAttachmentPanel noteId="test-note" compact
      filesRequest={{ id: 1, files: [new File(['test'], 'photo.png', { type: 'image/png' })] }}
      onPlaceInline={onPlaceInline} onRemoved={onRemoved} />));
    expect(container.querySelector('.attachment-drawer-handle')).not.toBeNull();
    await act(async () => root.render(<NoteAttachmentPanel noteId="test-note" compact
      filesRequest={{ id: 1, files: [] }} removeRequest={{ id: 'new-photo', nonce: 1 }}
      onPlaceInline={onPlaceInline} onRemoved={onRemoved} />));
    expect(removeAttachmentFromNote).toHaveBeenCalledWith('test-note', 'new-photo');
    expect(onRemoved).toHaveBeenCalledWith('new-photo');
    expect(container.querySelector('.attachment-drawer-handle')).toBeNull();
  });
});
