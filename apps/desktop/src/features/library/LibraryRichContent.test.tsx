// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryRichContent } from './LibraryRichContent';

const mocks = vi.hoisted(() => ({ getRichContent: vi.fn(), listReminders: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
vi.mock('../notes/persistence/richContentStore', () => ({
  createAttachmentObjectUrl: vi.fn(),
  formatAttachmentSize: (size: number) => `${size} bytes`,
  getRichContent: mocks.getRichContent,
  revokeAttachmentObjectUrl: vi.fn(),
}));
vi.mock('../reminders/persistence/reminderStore', () => ({ listReminders: mocks.listReminders }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.listReminders.mockResolvedValue([]);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('library rich preview ownership', () => {
  it('keeps an older note response and failure from replacing the current note preview', async () => {
    const older = deferred<{ attachments: { id: string; name: string; kind: 'document'; mimeType: string; size: number; createdAt: number; blob: Blob }[]; inkDocument: null }>();
    const current = deferred<{ attachments: { id: string; name: string; kind: 'document'; mimeType: string; size: number; createdAt: number; blob: Blob }[]; inkDocument: null }>();
    mocks.getRichContent.mockImplementation((noteId: string) => noteId === 'older-note' ? older.promise : current.promise);

    await act(async () => root.render(<LibraryRichContent noteId="older-note" />));
    await act(async () => root.render(<LibraryRichContent noteId="current-note" />));
    current.resolve({
      attachments: [{ id: 'current-file', name: 'current-only.pdf', kind: 'document', mimeType: 'application/pdf', size: 12, createdAt: 1, blob: new Blob(['current']) }],
      inkDocument: null,
    });
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('current-only.pdf');

    older.reject(new Error('old read failed'));
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('current-only.pdf');
    expect(container.textContent).not.toContain('old read failed');
    expect(container.textContent).not.toContain('older-file.pdf');
  });
});
