export const LIBRARY_EXPORT_REQUEST_EVENT = 'skribly://library-export-request';
export const LIBRARY_EXPORT_RESULT_EVENT = 'skribly://library-export-result';

export interface LibraryExportRequest {
  requestId: string;
  noteIds: string[] | null;
}

export interface LibraryExportResult {
  requestId: string;
  path: string | null;
  error: string | null;
}

const RESULT_KEYS = new Set(['requestId', 'path', 'error']);

export function isLibraryExportResult(value: unknown): value is LibraryExportResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !RESULT_KEYS.has(key))) return false;

  return (
    typeof record.requestId === 'string' &&
    record.requestId.length > 0 &&
    (record.path === null || typeof record.path === 'string') &&
    (record.error === null || typeof record.error === 'string') &&
    ((typeof record.path === 'string' && record.error === null) ||
      (record.path === null && typeof record.error === 'string'))
  );
}

export function createLibraryExportRequest(
  noteIds: string[] | null,
  randomId: () => string = () => crypto.randomUUID()
): LibraryExportRequest {
  const requestId = randomId();
  if (!requestId || requestId.length > 128) {
    throw new Error('Skribli could not create a safe export request identifier.');
  }

  return {
    requestId,
    noteIds: noteIds ? [...new Set(noteIds.filter(Boolean))] : null,
  };
}
