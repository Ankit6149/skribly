import { describe, expect, it } from 'vitest';
import {
  createImportApplyRequest,
  createImportPreviewRequest,
  isImportApplyResult,
  isImportPreview,
  isImportPreviewResult,
  MAX_IMPORT_FILE_BYTES,
  validateImportFileMetadata,
  type ImportPreview,
} from './libraryImport';

const preview: ImportPreview = {
  requestId: 'preview-request',
  fingerprint: 'crc32:12345678:42',
  schemaVersion: 2,
  sourceScope: 'allRecords',
  totalCount: 5,
  activeCount: 3,
  trashCount: 2,
  newCount: 2,
  identicalCount: 1,
  conflictCount: 2,
  conflictDetails: [
    {
      noteId: 'note-a',
      existingUpdatedAt: 10,
      importedUpdatedAt: 20,
      existingTrashed: false,
      importedTrashed: true,
    },
  ],
  currentRevision: 7,
  warnings: [],
};

describe('import preview validation', () => {
  it('accepts the exact native preview shape', () => {
    expect(isImportPreview(preview)).toBe(true);
    expect(
      isImportPreviewResult({ requestId: 'preview-request', preview, error: null })
    ).toBe(true);
  });

  it('rejects expanded or contradictory preview results', () => {
    expect(isImportPreview({ ...preview, noteText: 'private' })).toBe(false);
    expect(
      isImportPreviewResult({ requestId: 'request', preview, error: 'also failed' })
    ).toBe(false);
    expect(
      isImportPreviewResult({ requestId: 'request', preview: null, error: null })
    ).toBe(false);
    expect(
      isImportPreviewResult({
        requestId: 'request',
        preview: null,
        error: 'Invalid file',
        rawJson: '{}',
      })
    ).toBe(false);
  });
});

describe('import apply validation', () => {
  it('accepts successful and failed apply results', () => {
    expect(
      isImportApplyResult({
        requestId: 'apply-request',
        summary: {
          importedCount: 2,
          replacedCount: 1,
          identicalSkippedCount: 1,
          conflictSkippedCount: 0,
          activeCount: 4,
          trashCount: 2,
          rollbackPath: 'C:\\Skribli\\import-backups\\backup.json',
          revision: 8,
        },
        error: null,
      })
    ).toBe(true);
    expect(
      isImportApplyResult({
        requestId: 'apply-request',
        summary: null,
        error: 'Revision changed.',
      })
    ).toBe(true);
  });

  it('rejects ambiguous or privacy-expanded apply results', () => {
    expect(
      isImportApplyResult({
        requestId: 'apply-request',
        summary: {
          importedCount: 1,
          replacedCount: 0,
          identicalSkippedCount: 0,
          conflictSkippedCount: 0,
          activeCount: 1,
          trashCount: 0,
          rollbackPath: null,
          revision: 2,
        },
        error: 'also failed',
      })
    ).toBe(false);
    expect(
      isImportApplyResult({
        requestId: 'apply-request',
        summary: null,
        error: 'failed',
        importedNotes: [{ text: 'private' }],
      })
    ).toBe(false);
  });
});

describe('import request creation', () => {
  it('creates a bounded correlated preview request', () => {
    expect(createImportPreviewRequest('{"schemaVersion":1}', () => 'request-1')).toEqual({
      requestId: 'request-1',
      rawJson: '{"schemaVersion":1}',
    });
  });

  it('creates apply requests from the exact preview fingerprint and revision', () => {
    expect(
      createImportApplyRequest('{}', preview, 'skip', () => 'apply-1')
    ).toEqual({
      requestId: 'apply-1',
      rawJson: '{}',
      expectedFingerprint: preview.fingerprint,
      expectedRevision: preview.currentRevision,
      conflictMode: 'skip',
    });
    expect(
      createImportApplyRequest('{}', preview, 'replace', () => 'apply-2').conflictMode
    ).toBe('replace');
  });

  it('rejects empty, oversized, or unsafe requests', () => {
    expect(() => createImportPreviewRequest('', () => 'request')).toThrow(/choose/i);
    expect(() =>
      createImportPreviewRequest('x'.repeat(MAX_IMPORT_FILE_BYTES + 1), () => 'request')
    ).toThrow(/10 MB/i);
    expect(() => createImportPreviewRequest('{}', () => '')).toThrow(/safe import/i);
    expect(() =>
      createImportApplyRequest('{}', preview, 'merge' as never, () => 'request')
    ).toThrow(/supported conflict/i);
  });
});

describe('import file metadata', () => {
  it('accepts a bounded JSON file', () => {
    expect(() => validateImportFileMetadata({ name: 'skribli-note-records.json', size: 1024 })).not.toThrow();
  });

  it('rejects non-JSON, empty, and oversized files', () => {
    expect(() => validateImportFileMetadata({ name: 'notes.txt', size: 100 })).toThrow(/\.json/i);
    expect(() => validateImportFileMetadata({ name: 'notes.json', size: 0 })).toThrow(/empty/i);
    expect(() =>
      validateImportFileMetadata({ name: 'notes.json', size: MAX_IMPORT_FILE_BYTES + 1 })
    ).toThrow(/10 MB/i);
  });
});
