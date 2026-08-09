import { emit, listen } from '@tauri-apps/api/event';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createImportApplyRequest,
  createImportPreviewRequest,
  isImportApplyResult,
  isImportPreviewResult,
  LIBRARY_IMPORT_APPLY_REQUEST_EVENT,
  LIBRARY_IMPORT_APPLY_RESULT_EVENT,
  LIBRARY_IMPORT_PREVIEW_REQUEST_EVENT,
  LIBRARY_IMPORT_PREVIEW_RESULT_EVENT,
  validateImportFileMetadata,
  type ImportApplySummary,
  type ImportConflictMode,
  type ImportPreview,
} from './libraryImport';
import '../../styles/import.css';

const IMPORT_RESPONSE_TIMEOUT_MS = 15_000;

interface LibraryImportPanelProps {
  canApply: boolean;
  onApplied: (summary: ImportApplySummary) => Promise<void> | void;
}

type ImportPhase = 'idle' | 'reading' | 'previewing' | 'ready' | 'applying' | 'complete';

export const LibraryImportPanel: React.FC<LibraryImportPanelProps> = ({
  canApply,
  onApplied,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [conflictMode, setConflictMode] = useState<ImportConflictMode>('skip');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<ImportApplySummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPreviewRequest = useRef<string | null>(null);
  const pendingApplyRequest = useRef<string | null>(null);
  const responseTimeout = useRef<number | null>(null);

  const clearResponseTimeout = useCallback(() => {
    if (responseTimeout.current !== null) {
      window.clearTimeout(responseTimeout.current);
      responseTimeout.current = null;
    }
  }, []);

  const resetSelectedFile = useCallback(() => {
    clearResponseTimeout();
    pendingPreviewRequest.current = null;
    pendingApplyRequest.current = null;
    setPhase('idle');
    setFileName(null);
    setRawJson('');
    setPreview(null);
    setConflictMode('skip');
    setErrorMessage(null);
    setSuccessSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [clearResponseTimeout]);

  useEffect(() => {
    let disposed = false;
    let unlistenPreview: (() => void) | null = null;
    let unlistenApply: (() => void) | null = null;

    void listen<unknown>(LIBRARY_IMPORT_PREVIEW_RESULT_EVENT, (event) => {
      if (disposed || !isImportPreviewResult(event.payload)) return;
      if (event.payload.requestId !== pendingPreviewRequest.current) return;

      clearResponseTimeout();
      pendingPreviewRequest.current = null;
      if (event.payload.preview) {
        setPreview(event.payload.preview);
        setConflictMode('skip');
        setErrorMessage(null);
        setSuccessSummary(null);
        setPhase('ready');
      } else {
        setPreview(null);
        setErrorMessage(event.payload.error || 'Skribli could not preview this import.');
        setPhase('idle');
      }
    }).then((callback) => {
      if (disposed) callback();
      else unlistenPreview = callback;
    });

    void listen<unknown>(LIBRARY_IMPORT_APPLY_RESULT_EVENT, (event) => {
      if (disposed || !isImportApplyResult(event.payload)) return;
      if (event.payload.requestId !== pendingApplyRequest.current) return;

      clearResponseTimeout();
      pendingApplyRequest.current = null;
      if (event.payload.summary) {
        setSuccessSummary(event.payload.summary);
        setErrorMessage(null);
        setPhase('complete');
        void onApplied(event.payload.summary);
      } else {
        setErrorMessage(event.payload.error || 'Skribli could not apply this import.');
        setPhase('ready');
      }
    }).then((callback) => {
      if (disposed) callback();
      else unlistenApply = callback;
    });

    return () => {
      disposed = true;
      clearResponseTimeout();
      unlistenPreview?.();
      unlistenApply?.();
    };
  }, [clearResponseTimeout, onApplied]);

  const startTimeout = (requestId: string, kind: 'preview' | 'apply') => {
    clearResponseTimeout();
    responseTimeout.current = window.setTimeout(() => {
      if (kind === 'preview' && pendingPreviewRequest.current !== requestId) return;
      if (kind === 'apply' && pendingApplyRequest.current !== requestId) return;

      pendingPreviewRequest.current = null;
      pendingApplyRequest.current = null;
      responseTimeout.current = null;
      setErrorMessage(
        `Skribli did not receive the import ${kind} result. Try again or restart the app.`
      );
      setPhase(kind === 'apply' && preview ? 'ready' : 'idle');
    }, IMPORT_RESPONSE_TIMEOUT_MS);
  };

  const previewFile = async (file: File) => {
    resetSelectedFile();
    setIsOpen(true);
    setPhase('reading');
    setFileName(file.name);

    try {
      validateImportFileMetadata(file);
      const fileText = await file.text();
      const request = createImportPreviewRequest(fileText);
      setRawJson(fileText);
      setPhase('previewing');
      pendingPreviewRequest.current = request.requestId;
      startTimeout(request.requestId, 'preview');
      await emit(LIBRARY_IMPORT_PREVIEW_REQUEST_EVENT, request);
    } catch (error) {
      clearResponseTimeout();
      pendingPreviewRequest.current = null;
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setPhase('idle');
    }
  };

  const applyImport = async () => {
    if (!preview || !rawJson || !canApply || phase === 'applying') return;

    try {
      const request = createImportApplyRequest(rawJson, preview, conflictMode);
      setErrorMessage(null);
      setSuccessSummary(null);
      setPhase('applying');
      pendingApplyRequest.current = request.requestId;
      startTimeout(request.requestId, 'apply');
      await emit(LIBRARY_IMPORT_APPLY_REQUEST_EVENT, request);
    } catch (error) {
      clearResponseTimeout();
      pendingApplyRequest.current = null;
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setPhase('ready');
    }
  };

  const isBusy = phase === 'reading' || phase === 'previewing' || phase === 'applying';

  return (
    <div className="library-import-control">
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void previewFile(file);
        }}
      />
      <button
        type="button"
        className="library-button secondary"
        onClick={() => {
          setIsOpen(true);
          fileInputRef.current?.click();
        }}
        disabled={isBusy}
      >
        {phase === 'reading' || phase === 'previewing' ? 'Previewing import…' : 'Import JSON'}
      </button>

      {isOpen && (
        <section className="library-import-panel" aria-labelledby="library-import-title">
          <header>
            <div>
              <span className="library-kicker">PORTABLE LOCAL RESTORE</span>
              <h2 id="library-import-title">Preview import</h2>
              <p>
                Skribli validates the complete file locally. Nothing changes until you apply the preview.
              </p>
            </div>
            <button
              type="button"
              className="library-import-close"
              onClick={() => {
                setIsOpen(false);
                resetSelectedFile();
              }}
              disabled={isBusy}
              aria-label="Close import panel"
            >
              ×
            </button>
          </header>

          <div className="library-import-file-row">
            <div>
              <strong>{fileName || 'No file selected'}</strong>
              <span>Only a Skribli JSON export up to 10 MB is accepted.</span>
            </div>
            <button
              type="button"
              className="library-button secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
            >
              Choose another file
            </button>
          </div>

          {isBusy && (
            <div className="library-import-progress" role="status">
              <strong>
                {phase === 'applying' ? 'Applying the verified import…' : 'Validating the file…'}
              </strong>
              <span>
                {phase === 'applying'
                  ? 'A complete rollback backup is written before local Skribs change.'
                  : 'Native code is checking schema, fields, IDs, lifecycle state, and conflicts.'}
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="library-import-message error" role="alert">
              <strong>Import could not continue</strong>
              <span>{errorMessage}</span>
            </div>
          )}

          {preview && phase !== 'complete' && (
            <>
              <div className="library-import-summary" aria-label="Import preview summary">
                <div><strong>{preview.totalCount}</strong><span>Total records</span></div>
                <div><strong>{preview.activeCount}</strong><span>Active notes</span></div>
                <div><strong>{preview.trashCount}</strong><span>Trash records</span></div>
                <div><strong>{preview.newCount}</strong><span>New records</span></div>
                <div><strong>{preview.identicalCount}</strong><span>Exact duplicates</span></div>
                <div><strong>{preview.conflictCount}</strong><span>ID conflicts</span></div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="library-import-warnings" role="status">
                  {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              )}

              {preview.conflictCount > 0 && (
                <fieldset className="library-import-conflicts">
                  <legend>How should existing ID conflicts be handled?</legend>
                  <label>
                    <input
                      type="radio"
                      name="import-conflict-mode"
                      value="skip"
                      checked={conflictMode === 'skip'}
                      onChange={() => setConflictMode('skip')}
                    />
                    <span><strong>Skip conflicts</strong><small>Safest default. Existing local records remain unchanged.</small></span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="import-conflict-mode"
                      value="replace"
                      checked={conflictMode === 'replace'}
                      onChange={() => setConflictMode('replace')}
                    />
                    <span><strong>Replace the same IDs</strong><small>Explicitly replace only the conflicting stable IDs from this file.</small></span>
                  </label>
                </fieldset>
              )}

              {preview.conflictDetails.length > 0 && (
                <details className="library-import-conflict-details">
                  <summary>Review conflict summaries</summary>
                  <div>
                    {preview.conflictDetails.map((conflict) => (
                      <article key={conflict.noteId}>
                        <code>{conflict.noteId}</code>
                        <span>
                          Local: {conflict.existingTrashed ? 'Trash' : 'active'} · imported:{' '}
                          {conflict.importedTrashed ? 'Trash' : 'active'}
                        </span>
                      </article>
                    ))}
                  </div>
                </details>
              )}

              {!canApply && (
                <div className="library-import-message readonly" role="status">
                  <strong>Preview only</strong>
                  <span>Local writes are blocked, but you can still inspect this file and export your existing Skribs.</span>
                </div>
              )}

              <footer>
                <span>
                  Exact duplicates are always skipped. Apply is rejected if local Skribs change after this preview.
                </span>
                <button
                  type="button"
                  className="library-button primary"
                  onClick={() => void applyImport()}
                  disabled={!canApply || isBusy}
                >
                  Apply verified import
                </button>
              </footer>
            </>
          )}

          {successSummary && phase === 'complete' && (
            <div className="library-import-complete" role="status">
              <strong>Import applied safely</strong>
              <p>
                Added {successSummary.importedCount}, replaced {successSummary.replacedCount},
                skipped {successSummary.identicalSkippedCount} exact duplicates and{' '}
                {successSummary.conflictSkippedCount} conflicts.
              </p>
              <p>
                Library now contains {successSummary.activeCount} active and{' '}
                {successSummary.trashCount} trashed records.
              </p>
              {successSummary.rollbackPath ? (
                <code>{successSummary.rollbackPath}</code>
              ) : (
                <span>No local records changed, so no rollback backup was required.</span>
              )}
              <button type="button" className="library-button secondary" onClick={resetSelectedFile}>
                Import another file
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
