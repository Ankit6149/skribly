import React, { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OverlayMetrics, SkribNote, TargetWindowInfo } from '../../lib/geometry';
import {
  addInkToNote,
  getInkForNote,
  getRichContent,
  replaceInkForNote,
  type InkStroke,
} from '../../lib/richContentStore';
import { dismissReminder, listReminders } from '../../lib/reminderStore';
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
import { InkCanvas } from './InkCanvas';
import type { InkPersistenceState } from './inkPersistenceCoordinator';
import { NoteAttachmentPanel } from './NoteAttachmentPanel';
import { NoteReminderPanel } from './NoteReminderPanel';
import { discardSkribDraft, persistSkribText, stageSkribDraft } from './textPersistence';

type ComposerWorkspace = 'type' | 'write' | 'attachments' | 'reminder';

const NOTE_COLORS = ['yellow', 'peach', 'mint', 'sky', 'lavender'] as const;

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
    trashSkrib,
    discardEmptySkrib,
    storageErrorMessage,
    storageNotice,
    storageWritable,
    storageBackupDirectory,
    dismissStorageNotice,
    exportStorageDiagnostics,
    isTauriAvailable,
    setSkribCollapsed,
    updateSkribColor,
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
  const [workspace, setWorkspace] = useState<ComposerWorkspace>('type');
  const [isChangingWorkspace, setIsChangingWorkspace] = useState(false);
  const [inkStrokes, setInkStrokes] = useState<InkStroke[]>([]);
  const [isInkLoading, setIsInkLoading] = useState(true);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [richOperationCount, setRichOperationCount] = useState(0);
  const [inkPersistenceState, setInkPersistenceState] = useState<InkPersistenceState>({
    status: 'idle',
    hasUnsavedChanges: false,
    error: null,
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>(
    INITIAL_DELETE_CONFIRMATION_STATE
  );
  const operationInProgress = useRef(false);
  const richOperationsInProgress = useRef(new Map<string, number>());
  const inkPersistenceStateRef = useRef<InkPersistenceState>(inkPersistenceState);

  const setRichOperationBusy = useCallback((operation: string, busy: boolean) => {
    const currentCount = richOperationsInProgress.current.get(operation) ?? 0;
    if (busy) richOperationsInProgress.current.set(operation, currentCount + 1);
    else if (currentCount <= 1) richOperationsInProgress.current.delete(operation);
    else richOperationsInProgress.current.set(operation, currentCount - 1);
    setRichOperationCount(
      [...richOperationsInProgress.current.values()].reduce((total, count) => total + count, 0)
    );
  }, []);

  const handleInkBusy = useCallback(
    (busy: boolean) => setRichOperationBusy('ink', busy),
    [setRichOperationBusy]
  );
  const handleAttachmentsBusy = useCallback(
    (busy: boolean) => setRichOperationBusy('attachments', busy),
    [setRichOperationBusy]
  );
  const handleReminderBusy = useCallback(
    (busy: boolean) => setRichOperationBusy('reminder', busy),
    [setRichOperationBusy]
  );
  const handleInkPersistenceState = useCallback((state: InkPersistenceState) => {
    inkPersistenceStateRef.current = state;
    setInkPersistenceState(state);
  }, []);

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
    setWorkspace('type');
    richOperationsInProgress.current.clear();
    setRichOperationCount(0);
    const cleanInkState: InkPersistenceState = {
      status: 'idle',
      hasUnsavedChanges: false,
      error: null,
    };
    inkPersistenceStateRef.current = cleanInkState;
    setInkPersistenceState(cleanInkState);
    setColorPickerOpen(false);
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

  useEffect(() => {
    let cancelled = false;
    setIsInkLoading(true);
    void getInkForNote(note.id)
      .then((document) => {
        if (!cancelled) setInkStrokes(document.strokes);
      })
      .catch((reason) => {
        if (!cancelled) {
          setComposerError(
            `Skribli could not read this drawing: ${reason instanceof Error ? reason.message : String(reason)}`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsInkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [note.id]);

  const hideWindow = useCallback(async () => {
    await getCurrentWindow().hide();
    closeComposer();
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

  const changeWorkspace = useCallback(
    async (nextWorkspace: ComposerWorkspace) => {
      if (nextWorkspace === workspace || isChangingWorkspace) return;
      setIsChangingWorkspace(true);
      setComposerError(null);
      try {
        if (isTauriAvailable) {
          await invoke('set_skrib_workspace_mode', {
            id: note.id,
            expanded: nextWorkspace !== 'type',
          });
        }
        setWorkspace(nextWorkspace);
      } catch (reason) {
        setComposerError(
          `Skribli could not resize the editor safely: ${
            reason instanceof Error ? reason.message : String(reason)
          }`
        );
      } finally {
        setIsChangingWorkspace(false);
      }
    },
    [isChangingWorkspace, isTauriAvailable, note.id, workspace]
  );

  const hasPersistedExtras = useCallback(async () => {
    const [richContent, reminders] = await Promise.all([
      getRichContent(note.id),
      listReminders(),
    ]);
    return (
      richContent.attachments.length > 0 ||
      Boolean(richContent.inkDocument?.strokes.length) ||
      reminders.some((reminder) => reminder.noteId === note.id)
    );
  }, [note.id]);

  const finishAndHide = useCallback(async () => {
    await runExclusive(async () => {
      const currentInkState = inkPersistenceStateRef.current;
      if (currentInkState.status === 'saving' || currentInkState.hasUnsavedChanges) {
        setComposerError(
          currentInkState.error
            ? `The drawing is not safely stored yet: ${currentInkState.error}`
            : 'Skribli is still saving this drawing. Wait for it to finish before collapsing the note.'
        );
        return;
      }
      if (richOperationsInProgress.current.size > 0) {
        setComposerError(
          'Skribli is still saving this drawing, file, or reminder. Wait for it to finish before collapsing the note.'
        );
        return;
      }

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
      let hasExtras = false;
      try {
        hasExtras = await hasPersistedExtras();
      } catch (reason) {
        setComposerError(
          `Skribli could not verify this note's local drawing, files, or reminder. It stayed open to avoid losing them: ${
            reason instanceof Error ? reason.message : String(reason)
          }`
        );
        return;
      }

      if (currentDraft.trim().length === 0 && !hasExtras) {
        await saveController.prepareForDelete();
        const discarded = await discardEmptySkrib(note.id);
        if (discarded) {
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
        const collapsed = await setSkribCollapsed(note.id, true);
        if (!collapsed) {
          setComposerError(
            'The note was saved, but Skribli could not collapse it safely. The editor stayed open.'
          );
        }
      } else {
        setComposerError(
          'The note could not be saved safely. Skribli kept the editor open so the text is not lost.'
        );
      }
    });
  }, [
    discardEmptySkrib,
    hideWindow,
    hasPersistedExtras,
    licenceAllowsWrite,
    note.id,
    runExclusive,
    saveController,
    setSkribCollapsed,
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

  const handleColorChange = async (color: (typeof NOTE_COLORS)[number]) => {
    if (!canWrite || color === note.color) {
      setColorPickerOpen(false);
      return;
    }
    try {
      await updateSkribColor(note.id, color);
      setColorPickerOpen(false);
    } catch (reason) {
      setComposerError(
        `Skribli could not change this note color: ${
          reason instanceof Error ? reason.message : String(reason)
        }`
      );
    }
  };

  const persistInk = async (strokes: InkStroke[]) => {
    if (!canWrite) return;
    const document = await replaceInkForNote(note.id, strokes);
    setInkStrokes(document.strokes);
    void emit('skribly://rich-content-updated', { noteId: note.id }).catch(() => undefined);
  };

  const saveInkPreview = async (blob: Blob) => {
    if (!canWrite) return;
    await addInkToNote(note.id, blob);
    void emit('skribly://rich-content-updated', { noteId: note.id }).catch(() => undefined);
  };

  const requestDeleteConfirmation = () => {
    if (inkPersistenceStateRef.current.hasUnsavedChanges) {
      setComposerError(
        inkPersistenceStateRef.current.error
          ? `The drawing is not safely stored yet: ${inkPersistenceStateRef.current.error}`
          : 'The drawing is not safely stored yet. Retry the drawing save before deleting the note.'
      );
      return;
    }
    if (richOperationsInProgress.current.size > 0) {
      setComposerError(
        'Skribli is still saving this drawing, file, or reminder. Wait for it to finish before deleting the note.'
      );
      return;
    }
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
      if (inkPersistenceStateRef.current.hasUnsavedChanges) {
        setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'delete-failed'));
        setComposerError(
          'The drawing is not safely stored yet. Skribli kept the note open to avoid losing it.'
        );
        return;
      }
      if (richOperationsInProgress.current.size > 0) {
        setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'delete-failed'));
        setComposerError(
          'Skribli is still saving this drawing, file, or reminder. It kept the note open to avoid losing local content.'
        );
        return;
      }
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
      const movedToTrash = await trashSkrib(note.id);
      if (movedToTrash) {
        try {
          const linkedReminders = (await listReminders()).filter(
            (reminder) =>
              reminder.noteId === note.id &&
              (reminder.status === 'upcoming' || reminder.status === 'overdue')
          );
          await Promise.all(linkedReminders.map((reminder) => dismissReminder(reminder.id)));
          void emit('skribly://reminders-updated', { noteId: note.id }).catch(() => undefined);
        } catch {
          // The note is already safely in Trash; the Calendar will still expose any stale reminder.
        }
        discardSkribDraft(note.id);
        await hideWindow();
      } else {
        const message = 'The note could not be moved to Trash safely. It remains available.';
        saveController.resumeAfterDeleteFailure(message);
        setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'delete-failed'));
        setComposerError(message);
      }
    });
  };

  const recoveryDirectory = storageNotice?.backupDirectory || storageBackupDirectory;
  const visibleError =
    composerError || inkPersistenceState.error || saveSnapshot.error || storageErrorMessage;
  const saveLabel = saveStatusLabel(saveSnapshot);
  const hasPendingRichOperation = richOperationCount > 0;
  const hasUnsavedInk = inkPersistenceState.hasUnsavedChanges;
  const saveDetail = hasUnsavedInk
    ? 'Drawing save failed — add or undo a stroke to retry'
    : hasPendingRichOperation
    ? 'Saving local drawing, file, or reminder…'
    : storageWritable
      ? 'Esc or Ctrl+Enter collapses after the latest text is saved'
      : 'Recovery required before closing';
  const textareaDescription =
    deleteConfirmation === 'confirming'
      ? 'composer-delete-warning'
      : 'composer-open-state composer-save-status composer-character-count';
  const isNewNote = openAction === 'created';

  return (
    <div className="skrib-composer-backdrop" data-overlay-surface="composer">
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
        <header className="composer-header" data-tauri-drag-region title="Drag this header to move the Skrib">
          <span className="composer-drag-grip" data-tauri-drag-region aria-hidden="true" />
          <div className="composer-context" data-tauri-drag-region>
            <span className="composer-kicker" data-tauri-drag-region>
              {isNewNote ? 'NEW SKRIB FOR' : 'REOPENED SKRIB FOR'}
            </span>
            <strong data-tauri-drag-region>{contextLabel}</strong>
            <span id="composer-open-state" className="sr-only">
              {isNewNote
                ? 'Skribli created a new empty Skrib for this application context.'
                : 'Skribli reopened the existing Skrib for this application context.'}
            </span>
          </div>
          <div className="composer-header-actions">
            <div className="composer-color-control">
              <button
                type="button"
                className={`composer-color-button skrib-color-${note.color}`}
                onClick={() => setColorPickerOpen((open) => !open)}
                disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}
                aria-label="Change note color"
                aria-expanded={colorPickerOpen}
                title="Change note color"
              >
                <span aria-hidden="true" />
              </button>
              {colorPickerOpen && (
                <div className="composer-color-popover" role="group" aria-label="Note color">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch skrib-color-${color} ${note.color === color ? 'active' : ''}`}
                      aria-label={`${color} note`}
                      aria-pressed={note.color === color}
                      onClick={() => void handleColorChange(color)}
                    />
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="composer-reposition"
              onClick={() => void handleReposition()}
              disabled={!isTauriAvailable || isRepositioning || isFinishing || hasPendingRichOperation}
              aria-label="Reposition Skribli beside the target application"
              title="Reposition beside target"
            >
              {isRepositioning ? 'Moving…' : 'Reposition'}
            </button>
            <button
              type="button"
              className="composer-close"
              onClick={() => void finishAndHide()}
              disabled={
                isFinishing || isRepositioning || hasPendingRichOperation || hasUnsavedInk
              }
              aria-label={storageWritable ? 'Save and collapse this Skrib' : 'Storage recovery required'}
              title={storageWritable ? 'Save and collapse' : 'Storage recovery required'}
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

        <nav className="composer-workspace-tabs" aria-label="Skrib editor tools">
          {(
            [
              ['type', 'Text'],
              ['write', 'Draw'],
              ['attachments', 'Files'],
              ['reminder', 'Reminder'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={workspace === value ? 'active' : ''}
              aria-current={workspace === value ? 'page' : undefined}
              disabled={
                isChangingWorkspace || isFinishing || hasPendingRichOperation || hasUnsavedInk
              }
              onClick={() => void changeWorkspace(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className={`composer-workspace composer-workspace-${workspace}`}>
          {workspace === 'type' && (
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
          )}
          {workspace === 'write' &&
            (isInkLoading ? (
              <div className="composer-workspace-loading" role="status">Opening drawing…</div>
            ) : (
              <InkCanvas
                initialStrokes={inkStrokes}
                disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
                onChange={persistInk}
                onSavePreview={saveInkPreview}
                onBusyChange={handleInkBusy}
                onPersistenceStateChange={handleInkPersistenceState}
              />
            ))}
          {workspace === 'attachments' && (
            <NoteAttachmentPanel
              noteId={note.id}
              disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
              onError={setComposerError}
              onBusyChange={handleAttachmentsBusy}
            />
          )}
          {workspace === 'reminder' && (
            <NoteReminderPanel
              noteId={note.id}
              noteText={text}
              disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
              onError={setComposerError}
              onBusyChange={handleReminderBusy}
            />
          )}
        </div>

        <footer className="composer-footer">
          {deleteConfirmation === 'confirming' ? (
            <div className="composer-delete-confirmation" role="alert" aria-live="assertive">
              <div className="composer-delete-copy">
                <strong>Move this note to Trash?</strong>
                <small id="composer-delete-warning">
                  You can restore it from All Skribs for 30 days. Nothing is deleted permanently here.
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
                  disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk}
                  onClick={() => void handleDelete()}
                >
                  {isFinishing ? 'Moving…' : 'Move to Trash'}
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
                  disabled={!canWrite || isFinishing || hasPendingRichOperation}
                  onClick={requestDeleteConfirmation}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk}
                  onClick={() => void finishAndHide()}
                >
                  {isFinishing
                    ? 'Finishing…'
                    : hasPendingRichOperation
                      ? 'Saving…'
                      : hasUnsavedInk
                        ? 'Drawing not saved'
                        : 'Done'}
                </button>
              </div>
            </>
          )}
        </footer>
      </section>
    </div>
  );
};
