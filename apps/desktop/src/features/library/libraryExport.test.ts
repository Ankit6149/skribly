import { describe, expect, it } from 'vitest';
import {
  createLibraryExportRequest,
  isLibraryExportResult,
} from './libraryExport';

describe('isLibraryExportResult', () => {
  it('accepts successful and failed native results', () => {
    expect(
      isLibraryExportResult({ requestId: 'request-1', path: 'C:\\exports\\notes.json', error: null })
    ).toBe(true);
    expect(
      isLibraryExportResult({ requestId: 'request-2', path: null, error: 'Export failed.' })
    ).toBe(true);
  });

  it('rejects malformed, ambiguous, or expanded payloads', () => {
    expect(isLibraryExportResult(null)).toBe(false);
    expect(isLibraryExportResult({ requestId: '', path: 'x', error: null })).toBe(false);
    expect(
      isLibraryExportResult({ requestId: 'request', path: 'x', error: 'also failed' })
    ).toBe(false);
    expect(
      isLibraryExportResult({ requestId: 'request', path: null, error: null })
    ).toBe(false);
    expect(
      isLibraryExportResult({
        requestId: 'request',
        path: 'x',
        error: null,
        noteText: 'private content',
      })
    ).toBe(false);
  });
});

describe('createLibraryExportRequest', () => {
  it('deduplicates selected note IDs without mutating the input', () => {
    const ids = ['a', 'b', 'a', ''];
    const request = createLibraryExportRequest(ids, () => 'request-1');

    expect(request).toEqual({ requestId: 'request-1', noteIds: ['a', 'b'] });
    expect(ids).toEqual(['a', 'b', 'a', '']);
  });

  it('uses null to request all portable note records', () => {
    expect(createLibraryExportRequest(null, () => 'request-2')).toEqual({
      requestId: 'request-2',
      noteIds: null,
    });
  });

  it('rejects unsafe request identifiers', () => {
    expect(() => createLibraryExportRequest([], () => '')).toThrow(/safe export request/i);
    expect(() => createLibraryExportRequest([], () => 'x'.repeat(129))).toThrow(
      /safe export request/i
    );
  });
});
