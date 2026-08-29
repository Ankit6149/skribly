import { describe, expect, it } from 'vitest';
import {
  classifyAttachment,
  createMemoryRichContentPersistence,
  createRichContentRepository,
  formatAttachmentSize,
  MAX_DOCUMENT_ATTACHMENT_BYTES,
  MAX_INK_POINTS_PER_STROKE,
  MAX_NOTE_ATTACHMENT_BYTES,
  validateAttachments,
  validateInkDocument,
  type InkStroke,
  type StoredRichContent,
} from './richContentStore';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createFirstPutGate(initialContent: StoredRichContent[] = []) {
  const memory = createMemoryRichContentPersistence(initialContent);
  const putStarted = deferred();
  const allowPut = deferred();
  let gateFirstPut = true;

  return {
    persistence: {
      ...memory,
      put: async (nextContent: StoredRichContent) => {
        if (gateFirstPut) {
          gateFirstPut = false;
          putStarted.resolve();
          await allowPut.promise;
        }
        await memory.put(nextContent);
      },
    },
    waitForFirstPut: () => putStarted.promise,
    releaseFirstPut: () => allowPut.resolve(),
  };
}

async function letConcurrentMutationReachStorage(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function attachmentFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

function content(noteId: string): StoredRichContent {
  return { noteId, attachments: [], updatedAt: 1 };
}

function stroke(overrides: Partial<InkStroke> = {}): InkStroke {
  return {
    id: 'stroke-1',
    tool: 'pen',
    color: '#473e38',
    width: 3,
    points: [
      { x: 0.1, y: 0.2, pressure: 0.5 },
      { x: 0.9, y: 0.8, pressure: 1 },
    ],
    ...overrides,
  };
}

describe('rich content attachment validation', () => {
  it('classifies supported images, videos, and documents', () => {
    expect(classifyAttachment({ name: 'photo.webp', type: 'image/webp' })).toBe('image');
    expect(classifyAttachment({ name: 'clip.mp4', type: 'video/mp4' })).toBe('video');
    expect(classifyAttachment({ name: 'brief.pdf', type: 'application/pdf' })).toBe('document');
    expect(classifyAttachment({ name: 'notes.md', type: '' })).toBe('document');
  });

  it('rejects unsafe names, executable files, and extension spoofing', () => {
    expect(() => classifyAttachment({ name: '../photo.png', type: 'image/png' })).toThrow('unsafe');
    expect(() => classifyAttachment({ name: 'CON.pdf', type: 'application/pdf' })).toThrow('Windows');
    expect(() => classifyAttachment({ name: 'setup.exe', type: 'application/octet-stream' })).toThrow(
      'not a supported'
    );
    expect(() => classifyAttachment({ name: 'photo.pdf', type: 'image/png' })).toThrow('does not match');
  });

  it('enforces per-kind and per-note byte quotas', () => {
    expect(() =>
      validateAttachments([], [
        { name: 'large.pdf', size: MAX_DOCUMENT_ATTACHMENT_BYTES + 1, type: 'application/pdf' },
      ])
    ).toThrow('16 MB');

    expect(() =>
      validateAttachments(
        [{ size: MAX_NOTE_ATTACHMENT_BYTES - 512 }],
        [{ name: 'last.png', size: 1024, type: 'image/png' }]
      )
    ).toThrow('64 MB');
  });

  it('formats byte sizes for the UI', () => {
    expect(formatAttachmentSize(512)).toBe('512 B');
    expect(formatAttachmentSize(2048)).toBe('2 KB');
    expect(formatAttachmentSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatAttachmentSize(16 * 1024 * 1024)).toBe('16 MB');
  });
});

describe('rich content repository', () => {
  it('persists text-size preferences without dropping typed attachments or ink', async () => {
    const persistence = createMemoryRichContentPersistence();
    const repository = createRichContentRepository(persistence, { now: () => 42 });
    await repository.addFiles('note-view', [attachmentFile('brief.pdf', 'application/pdf', 4)]);
    await repository.replaceInk('note-view', [stroke()]);
    await repository.updateView('note-view', { textSize: 'large' });

    const restarted = createRichContentRepository(persistence);
    const stored = await restarted.get('note-view');
    expect(stored.view).toEqual({ textSize: 'large' });
    expect(stored.attachments).toHaveLength(1);
    expect(stored.inkDocument?.strokes).toEqual([stroke()]);
  });

  it('persists typed attachments locally', async () => {
    const persistence = createMemoryRichContentPersistence();
    const repository = createRichContentRepository(persistence, {
      now: () => 42,
      createId: (prefix) => `${prefix}-fixed`,
    });

    const attachments = await repository.addFiles('note-1', [
      attachmentFile('photo.png', 'image/png', 2),
      attachmentFile('movie.webm', 'video/webm', 3),
      attachmentFile('brief.pdf', 'application/pdf', 4),
    ]);

    expect(attachments.map((item) => item.kind)).toEqual(['image', 'video', 'document']);
    expect((await repository.get('note-1')).updatedAt).toBe(42);
  });

  it('will not delete content without an authoritative orphan check', async () => {
    const persistence = createMemoryRichContentPersistence([content('note-1')]);
    const repository = createRichContentRepository(persistence);
    expect(await repository.deleteIfOrphaned('note-1')).toBe(false);
    expect(await persistence.listNoteIds()).toEqual(['note-1']);
  });

  it('protects referenced notes and deletes confirmed orphans', async () => {
    const persistence = createMemoryRichContentPersistence([content('kept'), content('orphan')]);
    const referenced = new Set(['kept']);
    const repository = createRichContentRepository(persistence, {
      noteExists: (noteId) => referenced.has(noteId),
    });

    expect(await repository.deleteIfOrphaned('kept')).toBe(false);
    expect(await repository.deleteIfOrphaned('orphan')).toBe(true);
    expect(await persistence.listNoteIds()).toEqual(['kept']);
  });

  it('provides a deterministic authoritative orphan sweep', async () => {
    const persistence = createMemoryRichContentPersistence([
      content('note-c'),
      content('note-a'),
      content('note-b'),
    ]);
    const repository = createRichContentRepository(persistence);
    expect(await repository.deleteOrphans(['note-b'])).toEqual(['note-a', 'note-c']);
    expect(await persistence.listNoteIds()).toEqual(['note-b']);
  });

  it('serializes concurrent attachment and vector-ink writes for the same note', async () => {
    const gate = createFirstPutGate();
    const repository = createRichContentRepository(gate.persistence, {
      now: () => 42,
      createId: (prefix) => `${prefix}-fixed`,
    });

    const addAttachment = repository.addFiles('note-race', [
      attachmentFile('brief.pdf', 'application/pdf', 4),
    ]);
    await gate.waitForFirstPut();
    const addDrawing = repository.replaceInk('note-race', [stroke()]);
    await letConcurrentMutationReachStorage();
    gate.releaseFirstPut();
    await Promise.all([addAttachment, addDrawing]);

    const stored = await repository.get('note-race');
    expect(stored.attachments.map((attachment) => attachment.name)).toEqual(['brief.pdf']);
    expect(stored.inkDocument?.strokes).toEqual([stroke()]);
  });

  it('serializes concurrent file and PNG-ink attachment writes without losing either', async () => {
    const gate = createFirstPutGate();
    let id = 0;
    const repository = createRichContentRepository(gate.persistence, {
      now: () => 42,
      createId: (prefix) => `${prefix}-${++id}`,
    });

    const addAttachment = repository.addFiles('note-race', [
      attachmentFile('photo.png', 'image/png', 4),
    ]);
    await gate.waitForFirstPut();
    const addDrawingPreview = repository.addInk('note-race', new Blob(['ink'], { type: 'image/png' }));
    await letConcurrentMutationReachStorage();
    gate.releaseFirstPut();
    await Promise.all([addAttachment, addDrawingPreview]);

    const stored = await repository.get('note-race');
    expect(stored.attachments.map((attachment) => attachment.kind)).toEqual(['image', 'ink']);
  });
});

describe('vector ink persistence', () => {
  it('stores normalized pen, highlighter, and eraser strokes and survives a repository restart', async () => {
    const persistence = createMemoryRichContentPersistence();
    const firstSession = createRichContentRepository(persistence, { now: () => 100 });
    const strokes = [
      stroke(),
      stroke({ id: 'stroke-2', tool: 'highlighter', color: '#f4c6d7aa', width: 18 }),
      stroke({ id: 'stroke-3', tool: 'eraser', color: '#ffffff', width: 24 }),
    ];

    await firstSession.replaceInk('note-ink', strokes);
    const restartedSession = createRichContentRepository(persistence, { now: () => 200 });
    expect(await restartedSession.getInk('note-ink')).toEqual({ version: 1, strokes, updatedAt: 100 });
  });

  it('rejects non-normalized points and unbounded strokes', () => {
    expect(() => validateInkDocument([stroke({ points: [{ x: 1.1, y: 0.5, pressure: 0.5 }] })])).toThrow(
      'normalized coordinates'
    );
    expect(() =>
      validateInkDocument([
        stroke({ points: Array.from({ length: MAX_INK_POINTS_PER_STROKE + 1 }, () => ({ x: 0, y: 0, pressure: 1 })) }),
      ])
    ).toThrow('Each drawing stroke');
  });

  it('clears vector-only records without affecting attachment records', async () => {
    const persistence = createMemoryRichContentPersistence();
    const repository = createRichContentRepository(persistence, { now: () => 100 });
    await repository.replaceInk('vector-only', [stroke()]);
    await repository.replaceInk('vector-only', []);
    expect(await persistence.listNoteIds()).toEqual([]);

    await repository.addFiles('mixed', [attachmentFile('brief.pdf', 'application/pdf', 1)]);
    await repository.replaceInk('mixed', [stroke()]);
    await repository.replaceInk('mixed', []);
    expect((await repository.get('mixed')).attachments).toHaveLength(1);
  });

  it('preserves a concurrent attachment removal when vector ink is replaced', async () => {
    const firstAttachment = {
      id: 'attachment-1',
      name: 'first.pdf',
      mimeType: 'application/pdf',
      size: 1,
      createdAt: 1,
      blob: new Blob(['1'], { type: 'application/pdf' }),
      kind: 'document' as const,
    };
    const secondAttachment = {
      ...firstAttachment,
      id: 'attachment-2',
      name: 'second.pdf',
      blob: new Blob(['2'], { type: 'application/pdf' }),
    };
    const gate = createFirstPutGate([
      { noteId: 'note-race', attachments: [firstAttachment, secondAttachment], updatedAt: 1 },
    ]);
    const repository = createRichContentRepository(gate.persistence, { now: () => 42 });

    const removeFirst = repository.removeAttachment('note-race', firstAttachment.id);
    await gate.waitForFirstPut();
    const addDrawing = repository.replaceInk('note-race', [stroke()]);
    await letConcurrentMutationReachStorage();
    gate.releaseFirstPut();
    await Promise.all([removeFirst, addDrawing]);

    const stored = await repository.get('note-race');
    expect(stored.attachments.map((attachment) => attachment.id)).toEqual([secondAttachment.id]);
    expect(stored.inkDocument?.strokes).toEqual([stroke()]);
  });
});
