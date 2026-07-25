import { useSkribStore } from '../stores/skribStore';

export interface SkribAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  blob: Blob;
  kind: 'file' | 'image' | 'ink';
}

export interface StoredRichContent {
  noteId: string;
  attachments: SkribAttachment[];
  updatedAt: number;
}

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_NOTE_ATTACHMENT_BYTES = 24 * 1024 * 1024;

const DB_NAME = 'skribly-rich-content';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function validateAttachmentSizes(currentBytes: number, files: Array<Pick<File, 'name' | 'size'>>): number {
  let total = currentBytes;
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} is larger than the 8 MB Founder Alpha limit.`);
    }
    total += file.size;
    if (total > MAX_NOTE_ATTACHMENT_BYTES) {
      throw new Error('This note would exceed the 24 MB local attachment limit.');
    }
  }
  return total;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Local attachment storage is unavailable in this environment.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local attachment storage.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error('Local attachment transaction was cancelled.'));
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error('Local attachment transaction failed.'));
    };
    operation(store, resolve, reject);
  });
}

export async function getRichContent(noteId: string): Promise<StoredRichContent> {
  return runTransaction<StoredRichContent>('readonly', (store, resolve, reject) => {
    const request = store.get(noteId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        request.result ?? {
          noteId,
          attachments: [],
          updatedAt: 0,
        }
      );
  });
}

async function putRichContent(content: StoredRichContent): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(content);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function deleteRichContentRecord(noteId: string): Promise<void> {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(noteId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteRichContent(noteId: string): Promise<boolean> {
  const noteStillExists = useSkribStore.getState().skribs.some((note) => note.id === noteId);
  if (noteStillExists) return false;
  await deleteRichContentRecord(noteId);
  return true;
}

export async function addFilesToNote(noteId: string, files: File[]): Promise<SkribAttachment[]> {
  const content = await getRichContent(noteId);
  const currentBytes = content.attachments.reduce((sum, item) => sum + item.size, 0);
  validateAttachmentSizes(currentBytes, files);

  const accepted = files.map<SkribAttachment>((file) => ({
    id: createId('attachment'),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: Date.now(),
    blob: file,
    kind: file.type.startsWith('image/') ? 'image' : 'file',
  }));

  const attachments = [...content.attachments, ...accepted];
  await putRichContent({ noteId, attachments, updatedAt: Date.now() });
  return attachments;
}

export async function addInkToNote(noteId: string, blob: Blob): Promise<SkribAttachment[]> {
  const content = await getRichContent(noteId);
  const withoutPreviousInk = content.attachments.filter((item) => item.kind !== 'ink');
  validateAttachmentSizes(
    withoutPreviousInk.reduce((sum, item) => sum + item.size, 0),
    [{ name: 'Skribly drawing.png', size: blob.size }]
  );

  const attachment: SkribAttachment = {
    id: createId('ink'),
    name: 'Skribly drawing.png',
    mimeType: 'image/png',
    size: blob.size,
    createdAt: Date.now(),
    blob,
    kind: 'ink',
  };
  const attachments = [...withoutPreviousInk, attachment];
  await putRichContent({ noteId, attachments, updatedAt: Date.now() });
  return attachments;
}

export async function removeAttachmentFromNote(noteId: string, attachmentId: string): Promise<SkribAttachment[]> {
  const content = await getRichContent(noteId);
  const attachments = content.attachments.filter((item) => item.id !== attachmentId);
  if (attachments.length === 0) {
    await deleteRichContentRecord(noteId);
    return [];
  }
  await putRichContent({ noteId, attachments, updatedAt: Date.now() });
  return attachments;
}

export async function countNoteAttachments(noteId: string): Promise<number> {
  try {
    const content = await getRichContent(noteId);
    return content.attachments.length;
  } catch {
    return 0;
  }
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
