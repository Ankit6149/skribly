import type { NoteDiscardRecovery } from '../lifecycle/discardRecovery';
import { hasMeaningfulRichText } from '../model/richTextPresence';

export type SkribAttachmentKind = 'image' | 'video' | 'document' | 'ink';
export type InkTool = 'pen' | 'highlighter' | 'eraser';

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface InkStroke {
  id: string;
  tool: InkTool;
  color: string;
  width: number;
  points: InkPoint[];
}

export interface SkribInkDocument {
  version: 1;
  strokes: InkStroke[];
  updatedAt: number;
}

export interface SkribAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  blob: Blob;
  kind: SkribAttachmentKind;
}

export type SkribTextSize = 'small' | 'medium' | 'large';

export interface SkribViewPreferences {
  textSize: SkribTextSize;
}

export interface SkribRichTextDocument {
  version: 1;
  html: string;
  plainText: string;
  updatedAt: number;
}

export interface StoredRichContent {
  noteId: string;
  attachments: SkribAttachment[];
  inkDocument?: SkribInkDocument;
  richText?: SkribRichTextDocument;
  view?: SkribViewPreferences;
  updatedAt: number;
  discardRecovery?: NoteDiscardRecovery;
}

export interface AttachmentCandidate {
  name: string;
  size: number;
  type: string;
}

export interface RichContentPersistence {
  get(noteId: string): Promise<StoredRichContent | undefined>;
  put(content: StoredRichContent): Promise<void>;
  delete(noteId: string): Promise<void>;
  listNoteIds(): Promise<string[]>;
  transaction?<T>(operation: (persistence: RichContentPersistence) => Promise<T>): Promise<T>;
}

export interface RichContentRepositoryOptions {
  now?: () => number;
  createId?: (prefix: string) => string;
  noteExists?: (noteId: string) => boolean | Promise<boolean>;
}

export const MAX_IMAGE_ATTACHMENT_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_ATTACHMENT_BYTES = 32 * 1024 * 1024;
export const MAX_DOCUMENT_ATTACHMENT_BYTES = 16 * 1024 * 1024;
export const MAX_INK_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = MAX_VIDEO_ATTACHMENT_BYTES;
export const MAX_NOTE_ATTACHMENT_BYTES = 64 * 1024 * 1024;
export const MAX_NOTE_ATTACHMENTS = 16;
export const MAX_ATTACHMENT_NAME_LENGTH = 180;
export const MAX_INK_STROKES = 256;
export const MAX_INK_POINTS_PER_STROKE = 4096;
export const MAX_INK_POINTS_PER_NOTE = 65_536;
export const MAX_RICH_TEXT_HTML_CHARACTERS = 100_000;

const DB_NAME = 'skribly-rich-content';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/msword',
  'application/pdf',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/markdown',
  'text/plain',
]);

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mov', 'mp4', 'webm']);
const DOCUMENT_EXTENSIONS = new Set([
  'csv',
  'doc',
  'docx',
  'md',
  'pdf',
  'ppt',
  'pptx',
  'rtf',
  'txt',
  'xls',
  'xlsx',
]);
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const SAFE_INK_COLOR = /^#[0-9a-f]{3,8}$/i;

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex < 1 ? '' : name.slice(dotIndex + 1).toLowerCase();
}

function kindForMimeType(mimeType: string): Exclude<SkribAttachmentKind, 'ink'> | null {
  const normalized = mimeType.trim().toLowerCase();
  if (ALLOWED_IMAGE_MIME_TYPES.has(normalized)) return 'image';
  if (ALLOWED_VIDEO_MIME_TYPES.has(normalized)) return 'video';
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(normalized)) return 'document';
  return null;
}

function kindForExtension(name: string): Exclude<SkribAttachmentKind, 'ink'> | null {
  const extension = extensionOf(name);
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return null;
}

export function validateAttachmentName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error('Choose a file with a name.');
  if (normalized.length > MAX_ATTACHMENT_NAME_LENGTH) {
    throw new Error(`File names must be ${MAX_ATTACHMENT_NAME_LENGTH} characters or shorter.`);
  }
  if (/[/\\\u0000-\u001f\u007f]/.test(normalized) || normalized === '.' || normalized === '..') {
    throw new Error(`${normalized || 'This file'} has an unsafe file name.`);
  }
  if (WINDOWS_RESERVED_NAMES.test(normalized) || /[. ]$/.test(normalized)) {
    throw new Error(`${normalized} is not a safe file name on Windows.`);
  }
  return normalized;
}

export function classifyAttachment(
  file: Pick<AttachmentCandidate, 'name' | 'type'>
): Exclude<SkribAttachmentKind, 'ink'> {
  const name = validateAttachmentName(file.name);
  const normalizedMimeType = file.type.trim().toLowerCase();
  const mimeKind = kindForMimeType(normalizedMimeType);
  const extensionKind = kindForExtension(name);

  if (mimeKind && extensionKind && mimeKind !== extensionKind) {
    throw new Error(`${name} has a file type that does not match its extension.`);
  }
  if (mimeKind) return mimeKind;
  if ((!normalizedMimeType || normalizedMimeType === 'application/octet-stream') && extensionKind) {
    return extensionKind;
  }
  throw new Error(`${name} is not a supported image, video, or document.`);
}

export function attachmentLimitForKind(kind: SkribAttachmentKind): number {
  switch (kind) {
    case 'image':
      return MAX_IMAGE_ATTACHMENT_BYTES;
    case 'video':
      return MAX_VIDEO_ATTACHMENT_BYTES;
    case 'document':
      return MAX_DOCUMENT_ATTACHMENT_BYTES;
    case 'ink':
      return MAX_INK_ATTACHMENT_BYTES;
  }
}

function validateFileSize(name: string, size: number, limit: number): void {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error(`${name} is empty or has an invalid size.`);
  }
  if (size > limit) {
    throw new Error(`${name} is larger than the ${formatAttachmentSize(limit)} local limit.`);
  }
}

export function validateAttachments(
  existing: ReadonlyArray<Pick<SkribAttachment, 'size'>>,
  files: ReadonlyArray<AttachmentCandidate>
): number {
  if (existing.length + files.length > MAX_NOTE_ATTACHMENTS) {
    throw new Error(`A note can contain up to ${MAX_NOTE_ATTACHMENTS} local attachments.`);
  }

  let total = existing.reduce((sum, attachment) => sum + attachment.size, 0);
  for (const file of files) {
    const kind = classifyAttachment(file);
    const name = validateAttachmentName(file.name);
    validateFileSize(name, file.size, attachmentLimitForKind(kind));
    total += file.size;
    if (total > MAX_NOTE_ATTACHMENT_BYTES) {
      throw new Error(`This note would exceed the ${formatAttachmentSize(MAX_NOTE_ATTACHMENT_BYTES)} local attachment limit.`);
    }
  }
  return total;
}

// Kept for callers that only know byte sizes. New attachment flows should use validateAttachments.
export function validateAttachmentSizes(
  currentBytes: number,
  files: Array<Pick<File, 'name' | 'size'>>
): number {
  let total = currentBytes;
  for (const file of files) {
    const name = validateAttachmentName(file.name);
    validateFileSize(name, file.size, MAX_ATTACHMENT_BYTES);
    total += file.size;
    if (total > MAX_NOTE_ATTACHMENT_BYTES) {
      throw new Error(`This note would exceed the ${formatAttachmentSize(MAX_NOTE_ATTACHMENT_BYTES)} local attachment limit.`);
    }
  }
  return total;
}

export function validateInkDocument(strokes: ReadonlyArray<InkStroke>, updatedAt = Date.now()): SkribInkDocument {
  if (strokes.length > MAX_INK_STROKES) {
    throw new Error(`A drawing can contain up to ${MAX_INK_STROKES} strokes.`);
  }

  let pointCount = 0;
  const validated = strokes.map<InkStroke>((stroke) => {
    if (!stroke.id || stroke.id.length > 120) throw new Error('A drawing stroke has an invalid id.');
    if (stroke.tool !== 'pen' && stroke.tool !== 'highlighter' && stroke.tool !== 'eraser') {
      throw new Error('A drawing stroke has an unsupported tool.');
    }
    if (!SAFE_INK_COLOR.test(stroke.color)) throw new Error('A drawing stroke has an invalid color.');
    if (!Number.isFinite(stroke.width) || stroke.width < 0.5 || stroke.width > 64) {
      throw new Error('A drawing stroke has an invalid width.');
    }
    if (stroke.points.length === 0 || stroke.points.length > MAX_INK_POINTS_PER_STROKE) {
      throw new Error(`Each drawing stroke must contain 1 to ${MAX_INK_POINTS_PER_STROKE} points.`);
    }
    pointCount += stroke.points.length;
    if (pointCount > MAX_INK_POINTS_PER_NOTE) {
      throw new Error(`A drawing can contain up to ${MAX_INK_POINTS_PER_NOTE} points.`);
    }
    const points = stroke.points.map<InkPoint>((point) => {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.pressure) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1 ||
        point.pressure < 0 ||
        point.pressure > 1
      ) {
        throw new Error('Drawing points must use normalized coordinates and pressure between 0 and 1.');
      }
      return { x: point.x, y: point.y, pressure: point.pressure };
    });
    return { id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width, points };
  });

  return { version: 1, strokes: validated, updatedAt };
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
  operation: (store: IDBObjectStore, setResult: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let hasResult = false;
    let result: T;
    let settled = false;
    const fail = (reason?: unknown) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(reason);
    };

    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      db.close();
      if (!hasResult) {
        reject(new Error('Local attachment transaction completed without a result.'));
        return;
      }
      resolve(result);
    };
    transaction.onabort = () => fail(transaction.error ?? new Error('Local attachment transaction was cancelled.'));
    transaction.onerror = () => fail(transaction.error ?? new Error('Local attachment transaction failed.'));
    operation(
      store,
      (value) => {
        result = value;
        hasResult = true;
      },
      fail
    );
  });
}

// Read/modify/write stays inside one IndexedDB readwrite transaction, shared by all WebViews.
async function withRichMutation<T>(operation: (persistence: RichContentPersistence) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let finished = false;
    let result: T;
    let failure: unknown;
    const request = <R>(value: IDBRequest<R>) => new Promise<R>((yes, no) => {
      value.onsuccess = () => yes(value.result);
      value.onerror = () => no(value.error ?? new Error('Local content request failed.'));
    });
    const scoped: RichContentPersistence = {
      get: (id) => request(store.get(id)),
      put: async (content) => { await request(store.put(content)); },
      delete: async (id) => { await request(store.delete(id)); },
      listNoteIds: async () => (await request(store.getAllKeys())).map(String),
    };
    transaction.oncomplete = () => {
      db.close();
      if (finished) resolve(result);
      else reject(new Error('Local content mutation ended before it could finish. No later writes were accepted.'));
    };
    transaction.onabort = () => { db.close(); reject(failure ?? transaction.error ?? new Error('Local content mutation was cancelled.')); };
    void operation(scoped).then((value) => { result = value; finished = true; }, (reason) => {
      failure = reason;
      try { transaction.abort(); } catch { db.close(); reject(reason); }
    });
  });
}

// Test/in-memory adapters also coordinate independent repositories that share a persistence object.
const memoryMutationQueues = new WeakMap<RichContentPersistence, Map<string, Promise<void>>>();

export function createIndexedDbRichContentPersistence(): RichContentPersistence {
  return {
    transaction: withRichMutation,
    get: (noteId) =>
      runTransaction<StoredRichContent | undefined>('readonly', (store, setResult, reject) => {
        const request = store.get(noteId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(request.result as StoredRichContent | undefined);
      }),
    put: (content) =>
      runTransaction<void>('readwrite', (store, setResult, reject) => {
        const request = store.put(content);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(undefined);
      }),
    delete: (noteId) =>
      runTransaction<void>('readwrite', (store, setResult, reject) => {
        const request = store.delete(noteId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(undefined);
      }),
    listNoteIds: () =>
      runTransaction<string[]>('readonly', (store, setResult, reject) => {
        const request = store.getAllKeys();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(request.result.map(String));
      }),
  };
}

export function createMemoryRichContentPersistence(
  initialContent: StoredRichContent[] = []
): RichContentPersistence {
  const records = new Map(initialContent.map((content) => [content.noteId, content]));
  return {
    get: async (noteId) => records.get(noteId),
    put: async (content) => {
      records.set(content.noteId, content);
    },
    delete: async (noteId) => {
      records.delete(noteId);
    },
    listNoteIds: async () => [...records.keys()].sort(),
  };
}

function migrateAttachment(attachment: SkribAttachment): SkribAttachment {
  const legacyKind = (attachment as unknown as { kind: string }).kind;
  if (legacyKind !== 'file') return attachment;
  let kind: Exclude<SkribAttachmentKind, 'ink'> = 'document';
  try {
    kind = classifyAttachment({ name: attachment.name, type: attachment.mimeType });
  } catch {
    // Legacy generic files remain visible as documents instead of being discarded.
  }
  return { ...attachment, kind };
}

function normalizeViewPreferences(view?: Partial<SkribViewPreferences>): SkribViewPreferences {
  return {
    textSize:
      view?.textSize === 'small' || view?.textSize === 'large' ? view.textSize : 'medium',
  };
}

function normalizeRichTextDocument(document?: Partial<SkribRichTextDocument>): SkribRichTextDocument | undefined {
  if (
    document?.version !== 1 ||
    typeof document.html !== 'string' ||
    typeof document.plainText !== 'string' ||
    typeof document.updatedAt !== 'number' ||
    !Number.isFinite(document.updatedAt) ||
    document.html.length > MAX_RICH_TEXT_HTML_CHARACTERS ||
    [...document.plainText].length > 20_000
  ) return undefined;
  return document as SkribRichTextDocument;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateDiscardRecovery(value: unknown, noteId: string): NoteDiscardRecovery {
  const fail = () => { throw new Error('This note has an unsupported or damaged discard recovery record. It was preserved; editing is paused to protect both versions.'); };
  if (!record(value) || value.version !== 1) return fail();
  for (const snapshot of [value.current, value.baseline]) {
    if (!record(snapshot) || typeof snapshot.text !== 'string' || [...snapshot.text].length > 20_000 ||
      !['yellow', 'peach', 'mint', 'sky', 'lavender', 'rose', 'aqua', 'sand'].includes(String(snapshot.color)) ||
      !record(snapshot.rich) || snapshot.rich.noteId !== noteId || !Array.isArray(snapshot.rich.attachments) ||
      snapshot.rich.attachments.length > MAX_NOTE_ATTACHMENTS || !Array.isArray(snapshot.reminders) || snapshot.reminders.length > 1000) return fail();
    for (const attachment of snapshot.rich.attachments) {
      if (!record(attachment) || typeof attachment.id !== 'string' || !/^[a-zA-Z0-9_-]{1,180}$/.test(attachment.id) ||
        typeof attachment.name !== 'string' || typeof attachment.mimeType !== 'string' ||
        !['image', 'video', 'document', 'ink'].includes(String(attachment.kind)) ||
        !(attachment.blob instanceof Blob) || attachment.size !== attachment.blob.size) return fail();
    }
    if (snapshot.rich.richText && (!record(snapshot.rich.richText) || !normalizeRichTextDocument(snapshot.rich.richText))) return fail();
    if (snapshot.rich.inkDocument) {
      if (!record(snapshot.rich.inkDocument) || snapshot.rich.inkDocument.version !== 1 || !Array.isArray(snapshot.rich.inkDocument.strokes)) return fail();
      try { validateInkDocument(snapshot.rich.inkDocument.strokes); } catch { return fail(); }
    }
    for (const reminder of snapshot.reminders) {
      if (!record(reminder) || reminder.noteId !== noteId || typeof reminder.id !== 'string' || typeof reminder.title !== 'string' ||
        reminder.title.length > 180 || !['dueAt', 'createdAt', 'updatedAt'].every((field) => typeof reminder[field] === 'number' && Number.isFinite(reminder[field])) ||
        !['completedAt', 'dismissedAt', 'notifiedAt'].every((field) => reminder[field] === null || (typeof reminder[field] === 'number' && Number.isFinite(reminder[field]))) ||
        (reminder.repeat !== undefined && !['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(String(reminder.repeat)))) return fail();
    }
  }
  return value as unknown as NoteDiscardRecovery;
}

export function createRichContentRepository(
  persistence: RichContentPersistence,
  options: RichContentRepositoryOptions = {}
) {
  const now = options.now ?? Date.now;
  const createId = options.createId ?? defaultCreateId;
  const mutationQueues = memoryMutationQueues.get(persistence) ?? new Map<string, Promise<void>>();
  memoryMutationQueues.set(persistence, mutationQueues);

  const mutate = <T>(noteId: string, operation: (persistence: RichContentPersistence) => Promise<T>): Promise<T> => {
    if (persistence.transaction) return persistence.transaction(operation);
    const previous = mutationQueues.get(noteId) ?? Promise.resolve();
    const result = previous.then(() => operation(persistence));
    const tail = result.then(
      () => undefined,
      () => undefined
    );
    mutationQueues.set(noteId, tail);
    void tail.then(() => {
      if (mutationQueues.get(noteId) === tail) mutationQueues.delete(noteId);
    });
    return result;
  };

  const get = async (noteId: string, source = persistence): Promise<StoredRichContent> => {
    const stored = await source.get(noteId);
    if (!stored) {
      return {
        noteId,
        attachments: [],
        view: normalizeViewPreferences(),
        updatedAt: 0,
      };
    }
    if (stored.discardRecovery !== undefined) validateDiscardRecovery(stored.discardRecovery, noteId);
    const { richText: storedRichText, ...storedWithoutRichText } = stored;
    const richText = normalizeRichTextDocument(storedRichText);
    return {
      ...storedWithoutRichText,
      attachments: stored.attachments.map(migrateAttachment),
      ...(richText ? { richText } : {}),
      view: normalizeViewPreferences(stored.view),
    };
  };

  const addFiles = (noteId: string, files: File[]): Promise<SkribAttachment[]> => mutate(noteId, async (persistence) => {
    const content = await get(noteId, persistence);
    validateAttachments(content.attachments, files);
    const createdAt = now();
    const accepted = files.map<SkribAttachment>((file) => ({
      id: createId('attachment'),
      name: validateAttachmentName(file.name),
      mimeType: file.type.trim().toLowerCase() || 'application/octet-stream',
      size: file.size,
      createdAt,
      blob: file,
      kind: classifyAttachment(file),
    }));
    const attachments = [...content.attachments, ...accepted];
    await persistence.put({ ...content, noteId, attachments, updatedAt: createdAt });
    return attachments;
  });

  const addInk = (noteId: string, blob: Blob): Promise<SkribAttachment[]> => mutate(noteId, async (persistence) => {
    if (blob.type && blob.type !== 'image/png') throw new Error('Drawings must be stored as PNG images.');
    validateFileSize('Skribli drawing.png', blob.size, MAX_INK_ATTACHMENT_BYTES);
    const content = await get(noteId, persistence);
    const withoutPreviousInk = content.attachments.filter((item) => item.kind !== 'ink');
    const total = withoutPreviousInk.reduce((sum, item) => sum + item.size, 0) + blob.size;
    if (total > MAX_NOTE_ATTACHMENT_BYTES) {
      throw new Error(`This note would exceed the ${formatAttachmentSize(MAX_NOTE_ATTACHMENT_BYTES)} local attachment limit.`);
    }
    const createdAt = now();
    const attachment: SkribAttachment = {
      id: createId('ink'),
      name: 'Skribli drawing.png',
      mimeType: 'image/png',
      size: blob.size,
      createdAt,
      blob,
      kind: 'ink',
    };
    const attachments = [...withoutPreviousInk, attachment];
    await persistence.put({ ...content, noteId, attachments, updatedAt: createdAt });
    return attachments;
  });

  const replaceInk = (noteId: string, strokes: ReadonlyArray<InkStroke>): Promise<SkribInkDocument> => mutate(noteId, async (persistence) => {
    const content = await get(noteId, persistence);
    const inkDocument = validateInkDocument(strokes, now());
    if (
      inkDocument.strokes.length === 0 &&
      content.attachments.length === 0 &&
      !content.richText &&
      !content.discardRecovery &&
      normalizeViewPreferences(content.view).textSize === 'medium'
    ) {
      await persistence.delete(noteId);
      return inkDocument;
    }
    await persistence.put({ ...content, noteId, inkDocument, updatedAt: inkDocument.updatedAt });
    return inkDocument;
  });

  const replaceRichText = (
    noteId: string,
    value: Pick<SkribRichTextDocument, 'html' | 'plainText'>
  ): Promise<SkribRichTextDocument> => mutate(noteId, async (persistence) => {
    if (value.html.length > MAX_RICH_TEXT_HTML_CHARACTERS || [...value.plainText].length > 20_000) {
      throw new Error('This formatted note is too large to store safely.');
    }
    const content = await get(noteId, persistence);
    const richText: SkribRichTextDocument = {
      version: 1,
      html: hasMeaningfulRichText(value, content.attachments.map((item) => item.id)) ? value.html : '',
      plainText: value.plainText,
      updatedAt: now(),
    };
    const { richText: _previousRich, ...withoutRich } = content;
    const next: StoredRichContent = { ...withoutRich, noteId, ...(richText.html ? { richText } : {}), updatedAt: richText.updatedAt };
    if (!next.richText && !next.attachments.length && !next.inkDocument?.strokes.length &&
      !next.discardRecovery && normalizeViewPreferences(next.view).textSize === 'medium') await persistence.delete(noteId);
    else await persistence.put(next);
    return richText;
  });

  const getInk = async (noteId: string): Promise<SkribInkDocument> => {
    const content = await get(noteId, persistence);
    return content.inkDocument ?? { version: 1, strokes: [], updatedAt: 0 };
  };

  const removeAttachment = (noteId: string, attachmentId: string): Promise<SkribAttachment[]> => mutate(noteId, async (persistence) => {
    const content = await get(noteId, persistence);
    const attachments = content.attachments.filter((item) => item.id !== attachmentId);
    if (attachments.length === content.attachments.length) return attachments;
    if (
      attachments.length === 0 &&
      !content.inkDocument?.strokes.length &&
      !content.richText &&
      !content.discardRecovery &&
      normalizeViewPreferences(content.view).textSize === 'medium'
    ) {
      await persistence.delete(noteId);
      return [];
    }
    await persistence.put({ ...content, noteId, attachments, updatedAt: now() });
    return attachments;
  });

  const updateView = (
    noteId: string,
    view: Partial<SkribViewPreferences>
  ): Promise<SkribViewPreferences> => mutate(noteId, async (persistence) => {
    const content = await get(noteId, persistence);
    const nextView = normalizeViewPreferences({ ...content.view, ...view });
    const updatedAt = now();
    await persistence.put({ ...content, noteId, view: nextView, updatedAt });
    return nextView;
  });

  const restoreContent = (noteId: string, snapshot: StoredRichContent): Promise<void> => mutate(noteId, async (persistence) => {
    if (snapshot.noteId !== noteId) throw new Error('Cannot restore content belonging to another note.');
    const retainedRecovery = (await get(noteId, persistence)).discardRecovery;
    if (!retainedRecovery && snapshot.attachments.length === 0 && !snapshot.inkDocument?.strokes.length &&
      !snapshot.richText && normalizeViewPreferences(snapshot.view).textSize === 'medium') {
      await persistence.delete(noteId);
      return;
    }
    await persistence.put({ ...snapshot, ...(retainedRecovery ? { discardRecovery: retainedRecovery } : {}), attachments: [...snapshot.attachments], updatedAt: now() });
  });

  // Native existence reads and IndexedDB deletes cannot share an atomic transaction.
  // Retain inferred orphans until a native tombstone/lease protocol can authorize reclamation.
  const deleteIfOrphaned = async (_noteId: string): Promise<boolean> => false;

  const deleteContent = (noteId: string): Promise<void> => mutate(noteId, async (persistence) => {
    await persistence.delete(noteId);
  });

  const deleteOrphans = async (_existingNoteIds: Iterable<string>): Promise<string[]> => [];

  const retainDiscardRecovery = (noteId: string, recovery: NoteDiscardRecovery): Promise<void> => mutate(noteId, async (persistence) => {
    if (recovery.current.rich.noteId !== noteId || recovery.baseline.rich.noteId !== noteId) throw new Error('Recovery belongs to another note.');
    const content = await get(noteId, persistence);
    await persistence.put({ ...content, discardRecovery: recovery, updatedAt: now() });
  });
  const clearDiscardRecovery = (noteId: string): Promise<void> => mutate(noteId, async (persistence) => {
    const { discardRecovery: _recovery, ...content } = await get(noteId, persistence);
    if (!content.attachments.length && !content.inkDocument?.strokes.length && !content.richText && normalizeViewPreferences(content.view).textSize === 'medium') {
      await persistence.delete(noteId);
    } else await persistence.put(content);
  });

  return {
    get,
    addFiles,
    addInk,
    replaceInk,
    replaceRichText,
    getInk,
    updateView,
    restoreContent,
    retainDiscardRecovery,
    clearDiscardRecovery,
    removeAttachment,
    delete: deleteContent,
    deleteIfOrphaned,
    deleteOrphans,
    countAttachments: async (noteId: string) => (await get(noteId)).attachments.length,
  };
}

const defaultPersistence = createIndexedDbRichContentPersistence();
const isNotePreview = import.meta.env.DEV && typeof location !== 'undefined' && location.pathname.endsWith('/note-source-preview.html');
const defaultRepository = createRichContentRepository(isNotePreview ? createMemoryRichContentPersistence() : defaultPersistence);

export const getRichContent = defaultRepository.get;
export const addFilesToNote = defaultRepository.addFiles;
export const addInkToNote = defaultRepository.addInk;
export const replaceInkForNote = defaultRepository.replaceInk;
export const replaceRichTextForNote = defaultRepository.replaceRichText;
export const getInkForNote = defaultRepository.getInk;
export const updateNoteViewPreferences = defaultRepository.updateView;
export const restoreRichContentForNote = defaultRepository.restoreContent;
export const retainDiscardRecoveryForNote = defaultRepository.retainDiscardRecovery;
export const clearDiscardRecoveryForNote = defaultRepository.clearDiscardRecovery;
export const removeAttachmentFromNote = defaultRepository.removeAttachment;
export const deleteOrphanedRichContent = defaultRepository.deleteOrphans;

// A caller must provide the complete, authoritative set of note ids after a permanent purge.
// Without that proof this deliberately leaves local content in place rather than risking data loss.
export async function deleteRichContent(
  noteId: string,
  existingNoteIds?: Iterable<string>
): Promise<boolean> {
  if (!existingNoteIds || new Set(existingNoteIds).has(noteId)) return false;
  await defaultRepository.delete(noteId);
  return true;
}

export async function countNoteAttachments(noteId: string): Promise<number> {
  try {
    return await defaultRepository.countAttachments(noteId);
  } catch {
    return 0;
  }
}

export function createAttachmentObjectUrl(attachment: Pick<SkribAttachment, 'blob'>): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Attachment previews are unavailable in this environment.');
  }
  return URL.createObjectURL(attachment.blob);
}

export function revokeAttachmentObjectUrl(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}
