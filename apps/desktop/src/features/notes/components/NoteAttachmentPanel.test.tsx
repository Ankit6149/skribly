// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addFilesToNote, removeAttachmentFromNote } from '../persistence/richContentStore';
import { NoteAttachmentPanel } from './NoteAttachmentPanel';

vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(async () => undefined) }));
vi.mock('../persistence/richContentStore', async (original) => ({
  ...await original<typeof import('../persistence/richContentStore')>(),
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
  it('settles a failed queued request so its parent can release the reservation', async () => {
    const settled = vi.fn(); const error = vi.fn();
    vi.mocked(addFilesToNote).mockRejectedValueOnce(new Error('Synthetic disk failure'));
    await act(async () => root.render(<NoteAttachmentPanel noteId="old-note" onFilesRequestSettled={settled} onError={error} />));
    await act(async () => root.render(<NoteAttachmentPanel noteId="old-note" onFilesRequestSettled={settled} onError={error}
      filesRequest={{ id: 15, noteId: 'old-note', files: [new File(['test'], 'photo.png', { type: 'image/png' })] }} />));
    expect(error).toHaveBeenCalledWith('Synthetic disk failure');
    expect(settled).toHaveBeenCalledWith(15, 'old-note');
  });

  it('keeps an old-note paste completion out of a newly mounted note', async () => {
    const settled = vi.fn(); const place = vi.fn(() => true);
    let resolve!: (files: Awaited<ReturnType<typeof addFilesToNote>>) => void;
    vi.mocked(addFilesToNote).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const request = { id: 16, noteId: 'old-note', files: [new File(['test'], 'photo.png', { type: 'image/png' })] };
    await act(async () => root.render(<NoteAttachmentPanel noteId="old-note" onFilesRequestSettled={settled} onPlaceInline={place} />));
    await act(async () => root.render(<NoteAttachmentPanel noteId="old-note" filesRequest={request} onFilesRequestSettled={settled} onPlaceInline={place} />));
    await act(async () => root.render(<NoteAttachmentPanel noteId="new-note" onFilesRequestSettled={settled} onPlaceInline={place} />));
    await act(async () => resolve([{ id: 'old-photo', name: 'old-photo.png', kind: 'image', mimeType: 'image/png', size: 4, createdAt: 1, blob: new Blob(['test']) }]));
    expect(place).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('old-photo.png');
    expect(settled).toHaveBeenCalledWith(16, 'old-note');
  });

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
    await act(async () => {
      (container.querySelector('.attachment-tray-remove') as HTMLButtonElement).click();
    });
    expect(removeAttachmentFromNote).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('photo.png');
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Delete file')!.click(); });
    expect(removeAttachmentFromNote).toHaveBeenCalledWith('test-note', 'new-photo');
    expect(container.querySelector('.attachment-tray-item')).toBeNull();
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
    expect(removeAttachmentFromNote).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('photo.png');
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Delete file')!.click(); });
    expect(removeAttachmentFromNote).toHaveBeenCalledWith('test-note', 'new-photo');
    expect(onRemoved).toHaveBeenCalledWith('new-photo');
    expect(container.querySelector('.attachment-drawer-handle')).toBeNull();
  });
});
