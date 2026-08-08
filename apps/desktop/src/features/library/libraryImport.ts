export const LIBRARY_IMPORT_PREVIEW_REQUEST_EVENT =
  'skribly://library-import-preview-request';
export const LIBRARY_IMPORT_PREVIEW_RESULT_EVENT =
  'skribly://library-import-preview-result';
export const LIBRARY_IMPORT_APPLY_REQUEST_EVENT =
  'skribly://library-import-apply-request';
export const LIBRARY_IMPORT_APPLY_RESULT_EVENT =
  'skribly://library-import-apply-result';

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export type ImportConflictMode = 'skip' | 'replace';
export type ImportSourceScope = 'selected' | 'completeBackup';

export interface ImportConflictDetail {
  noteId: string;
  existingUpdatedAt: number;
  importedUpdatedAt: number;
  existingTrashed: boolean;
  importedTrashed: boolean;
}

export interface ImportPreview {
  requestId: string;
  fingerprint: string;
  schemaVersion: number;
  sourceScope: ImportSourceScope;
  totalCount: number;
  activeCount: number;
  trashCount: number;
  newCount: number;
  identicalCount: number;
  conflictCount: number;
  conflictDetails: ImportConflictDetail[];
  currentRevision: number;
  warnings: string[];
}

export interface ImportPreviewResult {
  requestId: string;
  preview: ImportPreview | null;
  error: string | null;
}

export interface ImportApplySummary {
  importedCount: number;
  replacedCount: number;
  identicalSkippedCount: number;
  conflictSkippedCount: number;
  activeCount: number;
  trashCount: number;
  rollbackPath: string | null;
  revision: number;
}

export interface ImportApplyResult {
  requestId: string;
  summary: ImportApplySummary | null;
  error: string | null;
}

export interface ImportPreviewRequest {
  requestId: string;
  rawJson: string;
}

export interface ImportApplyRequest {
  requestId: string;
  rawJson: string;
  expectedFingerprint: string;
  expectedRevision: number;
  conflictMode: ImportConflictMode;
}

const PREVIEW_KEYS = new Set([
  'requestId',
  'fingerprint',
  'schemaVersion',
  'sourceScope',
  'totalCount',
  'activeCount',
  'trashCount',
  'newCount',
  'identicalCount',
  'conflictCount',
  'conflictDetails',
  'currentRevision',
  'warnings',
]);
const CONFLICT_KEYS = new Set([
  'noteId',
  'existingUpdatedAt',
  'importedUpdatedAt',
  'existingTrashed',
  'importedTrashed',
]);
const PREVIEW_RESULT_KEYS = new Set(['requestId', 'preview', 'error']);
const APPLY_SUMMARY_KEYS = new Set([
  'importedCount',
  'replacedCount',
  'identicalSkippedCount',
  'conflictSkippedCount',
  'activeCount',
  'trashCount',
  'rollbackPath',
  'revision',
]);
const APPLY_RESULT_KEYS = new Set(['requestId', 'summary', 'error']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(record).every((key) => keys.has(key));
}

function isSafeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function defaultRandomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const values = crypto.getRandomValues(new Uint32Array(4));
  return `import-${Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('')}`;
}

function createRequestId(randomId: () => string): string {
  const requestId = randomId();
  if (!requestId || requestId.length > 128 || /[\u0000-\u001f\u007f]/u.test(requestId)) {
    throw new Error('Skribli could not create a safe import request identifier.');
  }
  return requestId;
}

function isImportConflictDetail(value: unknown): value is ImportConflictDetail {
  if (!isRecord(value) || !hasOnlyKeys(value, CONFLICT_KEYS)) return false;
  return (
    typeof value.noteId === 'string' &&
    value.noteId.length > 0 &&
    isSafeCount(value.existingUpdatedAt) &&
    isSafeCount(value.importedUpdatedAt) &&
    typeof value.existingTrashed === 'boolean' &&
    typeof value.importedTrashed === 'boolean'
  );
}

export function isImportPreview(value: unknown): value is ImportPreview {
  if (!isRecord(value) || !hasOnlyKeys(value, PREVIEW_KEYS)) return false;
  return (
    typeof value.requestId === 'string' &&
    value.requestId.length > 0 &&
    typeof value.fingerprint === 'string' &&
    value.fingerprint.startsWith('crc32:') &&
    isSafeCount(value.schemaVersion) &&
    (value.sourceScope === 'selected' || value.sourceScope === 'completeBackup') &&
    isSafeCount(value.totalCount) &&
    isSafeCount(value.activeCount) &&
    isSafeCount(value.trashCount) &&
    isSafeCount(value.newCount) &&
    isSafeCount(value.identicalCount) &&
    isSafeCount(value.conflictCount) &&
    Array.isArray(value.conflictDetails) &&
    value.conflictDetails.every(isImportConflictDetail) &&
    isSafeCount(value.currentRevision) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === 'string')
  );
}

export function isImportPreviewResult(value: unknown): value is ImportPreviewResult {
  if (!isRecord(value) || !hasOnlyKeys(value, PREVIEW_RESULT_KEYS)) return false;
  if (typeof value.requestId !== 'string' || value.requestId.length === 0) return false;
  const previewValid = value.preview === null || isImportPreview(value.preview);
  const errorValid = value.error === null || typeof value.error === 'string';
  return (
    previewValid &&
    errorValid &&
    ((value.preview !== null && value.error === null) ||
      (value.preview === null && typeof value.error === 'string'))
  );
}

function isImportApplySummary(value: unknown): value is ImportApplySummary {
  if (!isRecord(value) || !hasOnlyKeys(value, APPLY_SUMMARY_KEYS)) return false;
  return (
    isSafeCount(value.importedCount) &&
    isSafeCount(value.replacedCount) &&
    isSafeCount(value.identicalSkippedCount) &&
    isSafeCount(value.conflictSkippedCount) &&
    isSafeCount(value.activeCount) &&
    isSafeCount(value.trashCount) &&
    (value.rollbackPath === null || typeof value.rollbackPath === 'string') &&
    isSafeCount(value.revision)
  );
}

export function isImportApplyResult(value: unknown): value is ImportApplyResult {
  if (!isRecord(value) || !hasOnlyKeys(value, APPLY_RESULT_KEYS)) return false;
  if (typeof value.requestId !== 'string' || value.requestId.length === 0) return false;
  const summaryValid = value.summary === null || isImportApplySummary(value.summary);
  const errorValid = value.error === null || typeof value.error === 'string';
  return (
    summaryValid &&
    errorValid &&
    ((value.summary !== null && value.error === null) ||
      (value.summary === null && typeof value.error === 'string'))
  );
}

export function validateImportFileMetadata(file: Pick<File, 'name' | 'size'>): void {
  if (!file.name.toLocaleLowerCase().endsWith('.json')) {
    throw new Error('Choose a .json file exported by Skribli.');
  }
  if (file.size <= 0) {
    throw new Error('The selected import file is empty.');
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('The selected import file is larger than the 10 MB safety limit.');
  }
}

export function createImportPreviewRequest(
  rawJson: string,
  randomId: () => string = defaultRandomId
): ImportPreviewRequest {
  if (!rawJson) throw new Error('Choose a Skribli JSON export before previewing.');
  if (new TextEncoder().encode(rawJson).byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new Error('The selected import file is larger than the 10 MB safety limit.');
  }
  return { requestId: createRequestId(randomId), rawJson };
}

export function createImportApplyRequest(
  rawJson: string,
  preview: ImportPreview,
  conflictMode: ImportConflictMode,
  randomId: () => string = defaultRandomId
): ImportApplyRequest {
  if (conflictMode !== 'skip' && conflictMode !== 'replace') {
    throw new Error('Choose a supported conflict strategy.');
  }
  return {
    requestId: createRequestId(randomId),
    rawJson,
    expectedFingerprint: preview.fingerprint,
    expectedRevision: preview.currentRevision,
    conflictMode,
  };
}
