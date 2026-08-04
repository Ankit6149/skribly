import React, { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OverlayMetrics, SkribNote, TargetWindowInfo } from '../../lib/geometry';
import { useLicenseStore } from '../../stores/licenseStore';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import {
  DraftSaveController,
  DraftSaveSnapshot,
  MAX_NOTE_CHARACTERS,
} from './draftSaveController';
import {
  INITIAL_DELETE_CONFIRMATION_STATE,
  reduceDeleteConfirmation,
  type DeleteConfirmationState,
} from './deleteConfirmation';
import type { OpenNoteAction } from './noteLifecycle';
import { discardSkribDraft, persistSkribText, stageSkribDraft } from './textPersistence';

interface SkribComposerProps {
  note: SkribNote;
  target: TargetWindowInfo | null;
  openAction: OpenNoteAction;
}

function saveStatusLabel(snapshot: DraftSaveSnapshot): string {
  switch (snapshot.status) {
    case 'dirty':
      return 'Unsaved changes';
    case 'saving':
      return 'Saving…';
    case 'failed':
      return 'Save failed';
    case 'saved':
    default:
      return 'Saved locally';
  }
}

export const SkribComposer: React.FC<SkribComposerProps> = ({ note, target, openAction }) => {
  const {
    deleteSkrib,
    storageErrorMessage,
    storageNotice,
    storageWritable,
    storageBackupDirectory,
    dismissStorageNotice,
    exportStorageDiagnostics,
    isTauriAvailable,
  } = useSkribStore();
  const licenseStatus = useLicenseStore((state) => state.status);
  const licenceAllowsWrite = !licenseStatus.enforcementEnabled || licenseStatus.canWrite;
  const canWrite = storageWritable && licenceAllowsWrite;
  const { closeComposer } = useSkribUiStore();
  const [text, setText] = useState(note.text);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>(
    INITIAL_DELETE_CONFIRMATION_STATE
  );
  const operationInProgress = useRef(false);

  const saveController = useMemo(
    () =>
      new DraftSaveController({
        initialText: note.text,
        persist: (draft) => persistSkribText(note.id, draft),
      }),
    [note.id]
  );
  const [saveSnapshot, setSaveSnapshot] = useState<DraftSaveSnapshot>(
    saveController.getSnapshot()
  );

  const contextLabel = useMemo(() => {
    if (!target) return note.target_title || note.target_process_name || 'Current application';
    return target.title || target.process_name;
  }, [note.target_process_name, note.target_title, target]);

  useEffect(() => {
    setText(saveController.getSnapshot().draft);
    setSaveSnapshot(saveController.getSnapshot());
    setComposerError(null);
    setDiagnosticsPath(null);
    setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'note-changed'));
    return saveController.subscribe((snapshot) => {
      setSaveSnapshot(snapshot);
      setText(snapshot.draft);
    });
  }, [saveController]);

  useEffect(() => {
    saveController.acceptCommittedText(note.text);
  }, [note.text, saveController]);

  useEffect(() => () => saveController.dispose(), [saveController]);

  const hideWindow = useCallback(async () => {
    closeComposer();
    await getCurrentWindow().hide();
  }, [closeComposer]);

  const runExclusive = useCallback(async (operation: () => Promise<void>) => {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setIsFinishing(true);
    try {
      await operation();
    } finally {
      operationInProgress.current = false;
      setIsFinishing(false);
    }
  }, []);

  const finishAndHide = useCallback(async () => {
    await runExclusive(async () => {
      if (!storageWritable) {
        setComposerError(
          'This draft is not safely stored yet. Skribli will stay open until storage is available or the text is copied elsewhere.'
        );
        return;
      }

      if (!licenceAllowsWrite) {
        await hideWindow();
        return;
      }

      const currentDraft = saveController.getSnapshot().draft;
      if (currentDraft.trim().length === 0) {
        await saveController.prepareForDelete();
        const deleted = await deleteSkrib(note.id);
        if (deleted) {
          discardSkribDraft(note.id);
          await hideWindow();
        } else {
          const message = 'The empty note could not be removed safely. Skribli kept the editor open.';
          saveController.resumeAfterDeleteFailure(message);
          setComposerError(message);
        }
        return;
      }

      const saved = await saveController.flush();
      if (saved) {
        await hideWindow();
      } else {
        setComposerError(
          'The note could not be saved safely. Skribli kept the editor open so the text is not lost.'
        );
      }
    });
  }, [
    deleteSkrib,
    hideWindow,
    licenceAllowsWrite,
    note.id,
    runExclusive,
    saveController,
    storageWritable,
  ]);

  const cancelDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'cancel'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (deleteConfirmation === 'confirming') {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelDeleteConfirmation();
        }
        return;
      }

      const shouldFinish =
        event.key === 'Escape' ||
        (event.key === 'Enter' && (event.ctrlKey || event.metaKey));
      if (!shouldFinish) return;
      event.preventDefault();
      void finishAndHide();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelDeleteConfirmation, deleteConfirmation, finishAndHide]);

  const handleTextChange = (value: string) => {
    if (!canWrite) {
      setComposerError(
        storageErrorMessage || licenseStatus.message || 'This build is currently read-only.'
      );
      return;
    }

    const result = saveController.setDraft(value);
    if (!result.accepted) {
      setComposerError(result.error);
      return;
    }

    stageSkribDraft(note.id, value);
    setText(value);
    setComposerError(null);
  };

  const handleExportDiagnostics = async () => {
    const output = await exportStorageDiagnostics();
    if (output) setDiagnosticsPath(output);
  };

  const handleRetry = async () => {
    setComposerError(null);
    const saved = await saveController.retry();
    if (!saved) {
      setComposerError('The latest text is still not saved. Keep this window open and try again.');
    }
  };

  const handleReposition = async () => {
    if (!isTauriAvailable || isRepositioning) return;
    setIsRepositioning(true);
    setComposerError(null);
    try {
      await invoke<OverlayMetrics>('reposition_compact_window');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setComposerError(`Skribli could not reposition the editor safely: ${message}`);
    } finally {
      setIsRepositioning(false);
    }
  };

  const requestDeleteConfirmation = () => {
    if (!storageWritable) {
      setComposerError('Storage needs recovery, so Skribli cannot delete this note.');
      return;
    }
    if (!licenceAllowsWrite) {
      setComposerError(licenseStatus.message || 'This build is currently read-only.');
      return;
    }

    setComposerError(null);
    setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'request'));
  };

  const handleDelete = async () => {
    await runExclusive(async () => {
      if (!storageWritable) {
        setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'delete-failed'));
        setComposerError('Storage needs recovery, so Skribli did not delete this note.');
        return;
      }
      if (!licenceAllowsWrite) {
        setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'delete-failed'));
        return;
      }

      await saveController.prepareForDelete();
      const deleted = await deleteSkrib(note.id);
      if (deleted) {
        discardSkribDraft(note.id);
        await hideWindow();
      } else {
        const message = 'The note could not be deleted safely. It remains available.';
        saveController.resumeAfterDeleteFailure(message);
        setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'delete-failed'));
        setComposerError(message);
      }
    });
  };

  const recoveryDirectory = storageNotice?.backupDirectory || storageBackupDirectory;
  const visibleError = composerError || saveSnapshot.error || storageErrorMessage;
  const saveLabel = saveStatusLabel(saveSnapshot);
  const saveDetail = storageWritable
    ? 'Esc or Ctrl+Enter closes after the latest text is saved'
    : 'Recovery required before closing';
  const textareaDescription =
    deleteConfirmation === 'confirming'
      ? 'composer-delete-warning'
      : 'composer-open-state composer-save-status composer-character-count';
  const isNewNote = openAction === 'created';

  return (
    <div className="skrib-composer-backdrop">
      <section
        className={`skrib-composer skrib-color-${note.color}`}
        aria-label={
          canWrite
            ? isNewNote
              ? 'Write a new contextual note'
              : 'Edit a reopened contextual note'
            : 'View contextual note'
        }
      >
        <header className="composer-header" data-tauri-drag-region>
          <div className="composer-context" data-tauri-drag-region>
            <span className="composer-kicker" data-tauri-drag-region>
              {isNewNote ? 'NEW NOTE FOR' : 'REOPENED NOTE FOR'}
            </span>
            <strong data-tauri-drag-region>{contextLabel}</strong>
            <span id="composer-open-state" className="sr-only">
              {isNewNote
                ? 'Skribli created a new empty note for this application context.'
                : 'Skribli reopened the existing note for this application context.'}
            </span>
          </div>
          <div className="composer-header-actions">
            <button
              type="button"
              className="composer-reposition"
              onClick={() => void handleReposition()}
              disabled={!isTauriAvailable || isRepositioning || isFinishing}
              aria-label="Reposition Skribli beside the target application"
              title="Reposition beside target"
            >
              {isRepositioning ? 'Moving…' : 'Reposition'}
            </button>
            <button
              type="button"
              className="composer-close"
              onClick={() => void finishAndHide()}
              disabled={isFinishing || isRepositioning}
              aria-label={storageWritable ? 'Save and close Skribli' : 'Storage recovery required'}
              title={storageWritable ? 'Save and close' : 'Storage recovery required'}
            >
              ✕
            </button>
          </div>
        </header>

        {storageNotice && (
          <div className="composer-recovery" role="status">
            <span>{storageNotice.message}</span>
            {recoveryDirectory && <small>Recovery folder: {recoveryDirectory}</small>}
            <div className="composer-storage-actions">
              <button type="button" onClick={() => void handleExportDiagnostics()}>
                Save safe diagnostics
              </button>
              <button type="button" onClick={dismissStorageNotice}>
                Dismiss
              </button>
            </div>
            {diagnosticsPath && <small>Diagnostics saved to: {diagnosticsPath}</small>}
          </div>
        )}

        {visibleError && (
          <div className="composer-error" role="alert">
            <span>{visibleError}</span>
            {saveSnapshot.status === 'failed' && storageWritable && licenceAllowsWrite && (
              <button type="button" onClick={() => void handleRetry()} disabled={isFinishing}>
                Retry saving
              </button>
            )}
            {recoveryDirectory && <small>Recovery folder: {recoveryDirectory}</small>}
            <button type="button" onClick={() => void handleExportDiagnostics()}>
              Save safe diagnostics
            </button>
            {diagnosticsPath && <small>Diagnostics saved to: {diagnosticsPath}</small>}
          </div>
        )}

        <textarea
          className="composer-textarea"
          value={text}
          autoFocus={canWrite}
          readOnly={!canWrite}
          placeholder="Write the thought before it disappears…"
          spellCheck
          aria-describedby={textareaDescription}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handleTextChange(event.target.value)}
          onBlur={() => {
            if (!canWrite || operationInProgress.current) return;
            void saveController.flush().then((saved) => {
              if (
                !saved &&
                saveController.getSnapshot().draft !== saveController.getSnapshot().committed
              ) {
                setComposerError('The latest text is not saved. Keep this window open and retry.');
              }
            });
          }}
        />

        <footer className="composer-footer">
          {deleteConfirmation === 'confirming' ? (
            <div className="composer-delete-confirmation" role="alert" aria-live="assertive">
              <div className="composer-delete-copy">
                <strong>Delete this note permanently?</strong>
                <small id="composer-delete-warning">
                  Trash is not available in this build. This action cannot be undone.
                </small>
              </div>
              <div className="composer-footer-actions">
                <button
                  type="button"
                  className="secondary"
                  autoFocus
                  disabled={isFinishing}
                  onClick={cancelDeleteConfirmation}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-confirm"
                  disabled={isFinishing}
                  onClick={() => void handleDelete()}
                >
                  {isFinishing ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                id="composer-save-status"
                className="composer-status"
                data-state={saveSnapshot.status}
                role="status"
                aria-live="polite"
              >
                <span>{saveLabel}</span>
                <small>{saveDetail}</small>
                <small id="composer-character-count" className="composer-character-count">
                  {saveSnapshot.characterCount.toLocaleString()} /{' '}
                  {MAX_NOTE_CHARACTERS.toLocaleString()}
                </small>
              </div>
              <div className="composer-footer-actions">
                <button
                  type="button"
                  className="secondary danger"
                  disabled={!canWrite || isFinishing}
                  onClick={requestDeleteConfirmation}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={isFinishing}
                  onClick={() => void finishAndHide()}
                >
                  {isFinishing ? 'Finishing…' : 'Done'}
                </button>
              </div>
            </>
          )}
        </footer>
      </section>
    </div>
  );
};
