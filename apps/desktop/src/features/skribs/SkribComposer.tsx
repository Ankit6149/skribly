import React, { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Bell,
  Expand,
  LocateFixed,
  Maximize2,
  Minimize2,
  Paperclip,
  PenLine,
  Type,
  Check,
  Trash2,
  X,
} from 'lucide-react';
import { OverlayMetrics, SkribNote, TargetWindowInfo } from '../../lib/geometry';
import {
  addInkToNote,
  getInkForNote,
  getRichContent,
  replaceInkForNote,
  updateNoteViewPreferences,
  type InkStroke,
  type SkribTextSize,
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

type ComposerPanel = 'reminder' | null;
type NoteSurfaceSize = 'compact' | 'medium' | 'large';

const NOTE_COLORS = ['yellow', 'peach', 'mint', 'sky', 'lavender'] as const;
const NOTE_SURFACE_SIZES: NoteSurfaceSize[] = ['compact', 'medium', 'large'];
const NOTE_TEXT_SIZES: SkribTextSize[] = ['small', 'medium', 'large'];

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
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [surfaceSize, setSurfaceSize] = useState<NoteSurfaceSize>(() =>
    note.width >= 680 ? 'large' : note.width >= 500 ? 'medium' : 'compact'
  );
  const [textSize, setTextSize] = useState<SkribTextSize>('medium');
  const [attachmentPickerRequest, setAttachmentPickerRequest] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);
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
  const resizeInProgress = useRef(false);
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
    setActivePanel(null);
    setDrawingEnabled(false);
    setAttachmentCount(0);
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
    setSurfaceSize(note.width >= 680 ? 'large' : note.width >= 500 ? 'medium' : 'compact');
  }, [note.width]);

  useEffect(() => {
    saveController.acceptCommittedText(note.text);
  }, [note.text, saveController]);

  useEffect(() => () => saveController.dispose(), [saveController]);

  useEffect(() => {
    if (!isTauriAvailable) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ requestId: string; noteId: string }>('skribly://prepare-note-switch', async ({ payload }) => {
      if (disposed || payload.noteId !== note.id) return;
      const ink = inkPersistenceStateRef.current;
      let ready = false;
      try {
        if (!ink.hasUnsavedChanges && ink.status !== 'saving' && richOperationsInProgress.current.size === 0) {
          ready = await saveController.flush();
        }
      } catch {
        // Keep the current editor in place when persistence fails.
      }
      await emit('skribly://note-switch-ready', {
        requestId: payload.requestId,
        ready,
        message: ready ? undefined : 'The current note has unsaved changes. Finish saving it before opening another.',
      }).catch(() => undefined);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, [isTauriAvailable, note.id, saveController]);

  useEffect(() => {
    let cancelled = false;
    setIsInkLoading(true);
    void Promise.all([getInkForNote(note.id), getRichContent(note.id)])
      .then(([document, richContent]) => {
        if (!cancelled) {
          setInkStrokes(document.strokes);
          setTextSize(richContent.view?.textSize ?? 'medium');
          setAttachmentCount(richContent.attachments.length);
        }
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
    if (openAction === 'detached') await invoke('close_skrib_note_here');
    else await getCurrentWindow().hide();
    closeComposer();
  }, [closeComposer, openAction]);

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

  const changeSurfaceSize = useCallback(
    async (nextSize: NoteSurfaceSize, force = false) => {
      if ((!force && nextSize === surfaceSize) || resizeInProgress.current) return false;
      resizeInProgress.current = true;
      setIsResizing(true);
      setComposerError(null);
      try {
        if (isTauriAvailable) {
          await invoke('set_skrib_window_size', {
            id: note.id,
            size: nextSize,
          });
        }
        setSurfaceSize(nextSize);
        return true;
      } catch (reason) {
        setComposerError(
          `Skribli could not resize the editor safely: ${
            reason instanceof Error ? reason.message : String(reason)
          }`
        );
      } finally {
        resizeInProgress.current = false;
        setIsResizing(false);
      }
    },
    [isTauriAvailable, note.id, surfaceSize]
  );

  const changeTextSize = useCallback(
    async (nextSize: SkribTextSize) => {
      setTextSize(nextSize);
      try {
        await updateNoteViewPreferences(note.id, { textSize: nextSize });
      } catch (reason) {
        setComposerError(
          `Skribli could not save the text size: ${reason instanceof Error ? reason.message : String(reason)}`
        );
      }
    },
    [note.id]
  );

  const cycleSurfaceSize = useCallback(async () => {
    const currentIndex = NOTE_SURFACE_SIZES.indexOf(surfaceSize);
    const nextSize = NOTE_SURFACE_SIZES[(currentIndex + 1) % NOTE_SURFACE_SIZES.length]!;
    if (await changeSurfaceSize(nextSize)) {
      setActivePanel(null);
      setDrawingEnabled(false);
      setColorPickerOpen(false);
    }
  }, [changeSurfaceSize, surfaceSize]);

  const cycleTextSize = useCallback(async () => {
    const currentIndex = NOTE_TEXT_SIZES.indexOf(textSize);
    const nextSize = NOTE_TEXT_SIZES[(currentIndex + 1) % NOTE_TEXT_SIZES.length]!;
    await changeTextSize(nextSize);
  }, [changeTextSize, textSize]);

  const openRoomyTool = useCallback(
    async (tool: 'draw' | 'reminder') => {
      setColorPickerOpen(false);
      if (tool === 'draw') {
        const nextEnabled = !drawingEnabled;
        if (nextEnabled && !await changeSurfaceSize('large', true)) return;
        setDrawingEnabled(nextEnabled);
        setActivePanel(null);
        return;
      }
      const openingReminder = activePanel !== 'reminder';
      if (openingReminder && !await changeSurfaceSize('large', true)) return;
      setDrawingEnabled(false);
      setActivePanel(openingReminder ? 'reminder' : null);
    },
    [activePanel, changeSurfaceSize, drawingEnabled]
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
        if (openAction === 'detached') {
          await hideWindow();
          return;
        }
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
    openAction,
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

      if (event.key === 'Escape' && (colorPickerOpen || activePanel || drawingEnabled)) {
        event.preventDefault();
        if (richOperationsInProgress.current.size > 0 || inkPersistenceStateRef.current.hasUnsavedChanges) {
          setComposerError('Wait for the current save before closing this tool.');
          return;
        }
        setColorPickerOpen(false);
        setActivePanel(null);
        setDrawingEnabled(false);
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
  }, [activePanel, colorPickerOpen, drawingEnabled, cancelDeleteConfirmation, deleteConfirmation, finishAndHide]);

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
      ? openAction === 'detached'
        ? 'Esc or Ctrl+Enter saves and closes'
        : 'Esc or Ctrl+Enter saves and collapses'
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
              {isNewNote ? 'NEW SKRIB FOR' : openAction === 'detached' ? 'SAVED SKRIB' : 'REOPENED SKRIB FOR'}
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
            </div>
            <button
              type="button"
              className="composer-reposition"
              hidden={openAction === 'detached'}
              onClick={() => void handleReposition()}
              disabled={!isTauriAvailable || isRepositioning || isFinishing || hasPendingRichOperation}
              aria-label="Reposition Skribli beside the target application"
              title="Reposition beside target"
            >
              {isRepositioning ? (
                <span className="composer-button-spinner" aria-hidden="true" />
              ) : (
                <LocateFixed size={15} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="composer-close"
              onClick={() => void finishAndHide()}
              disabled={
                isFinishing || isRepositioning || hasPendingRichOperation || hasUnsavedInk
              }
              aria-label={storageWritable ? openAction === 'detached' ? 'Save and close this Skrib' : 'Save and collapse this Skrib' : 'Storage recovery required'}
              title={storageWritable ? openAction === 'detached' ? 'Save and close' : 'Save and collapse' : 'Storage recovery required'}
            >
              <X size={15} aria-hidden="true" />
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

        <div className="composer-command-bar" aria-label="Skrib tools">
          <button
            type="button"
            className="composer-tool-button primary-tool"
            aria-label="Attach a photo, video, or document"
            title="Attach anything"
            disabled={!canWrite || isFinishing || hasPendingRichOperation}
            onClick={() => setAttachmentPickerRequest((request) => request + 1)}
          >
            <Paperclip size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`composer-tool-button ${drawingEnabled ? 'active' : ''}`}
            aria-pressed={drawingEnabled}
            aria-label="Draw over your text"
            title="Draw over your text"
            disabled={!canWrite || isFinishing || isInkLoading}
            onClick={() => void openRoomyTool('draw')}
          >
            <PenLine size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`composer-tool-button ${activePanel === 'reminder' ? 'active' : ''}`}
            aria-expanded={activePanel === 'reminder'}
            aria-label="Set a reminder or repeating task"
            title="Set a reminder or repeating task"
            disabled={!canWrite || isFinishing || hasPendingRichOperation}
            onClick={() => void openRoomyTool('reminder')}
          >
            <Bell size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="composer-tool-button composer-text-size-button"
            title={`Text size: ${textSize}. Click for the next size.`}
            aria-label={`Text size is ${textSize}. Change to the next text size.`}
            disabled={!canWrite || isFinishing}
            onClick={() => void cycleTextSize()}
          >
            <Type size={14} aria-hidden="true" />
            <span className="composer-tool-level" aria-hidden="true">
              {textSize === 'small' ? 'S' : textSize === 'medium' ? 'M' : 'L'}
            </span>
          </button>
          <button
            type="button"
            className="composer-tool-button surface-size-button"
            title={`Note size: ${surfaceSize}. Click for the next size.`}
            aria-label={`Note size is ${surfaceSize}. Change to the next note size.`}
            disabled={isResizing || isFinishing || hasPendingRichOperation || hasUnsavedInk}
            onClick={() => void cycleSurfaceSize()}
          >
            {surfaceSize === 'compact' ? (
              <Maximize2 size={14} aria-hidden="true" />
            ) : surfaceSize === 'medium' ? (
              <Expand size={14} aria-hidden="true" />
            ) : (
              <Minimize2 size={14} aria-hidden="true" />
            )}
          </button>
        </div>

        {colorPickerOpen && (
          <div className="composer-color-popover" role="group" aria-label="Note color">
            <span>Paper color</span>
            {NOTE_COLORS.map((color) => (
              <button key={color} type="button"
                className={`color-swatch skrib-color-${color} ${note.color === color ? 'active' : ''}`}
                aria-label={`${color} note`} aria-pressed={note.color === color}
                title={`${color} paper`} onClick={() => void handleColorChange(color)}
              >{note.color === color && <Check size={14} aria-hidden="true" />}</button>
            ))}
          </div>
        )}

        <div className={`composer-unified-workspace ${activePanel ? 'panel-open' : ''}`}>
          <div
            className={`composer-unified-canvas ${drawingEnabled ? 'drawing' : 'typing'}`}
            data-text-size={textSize}
          >
            <textarea
              className="composer-textarea"
              value={text}
              autoFocus={canWrite}
              readOnly={!canWrite || drawingEnabled}
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
            {!isInkLoading && (
              <div className={`composer-ink-layer ${drawingEnabled ? 'active' : ''}`}>
                <InkCanvas
                  variant="overlay"
                  initialStrokes={inkStrokes}
                  disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
                  onChange={persistInk}
                  onSavePreview={saveInkPreview}
                  onBusyChange={handleInkBusy}
                  onPersistenceStateChange={handleInkPersistenceState}
                />
              </div>
            )}
          </div>

          <NoteAttachmentPanel
            noteId={note.id}
            compact
            pickerRequest={attachmentPickerRequest}
            disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
            onError={setComposerError}
            onBusyChange={handleAttachmentsBusy}
            onCountChange={setAttachmentCount}
          />

          {activePanel === 'reminder' && (
            <div className="composer-inline-panel">
              <button className="composer-panel-close" type="button" title="Back to note" aria-label="Close reminder panel" onClick={() => setActivePanel(null)} disabled={hasPendingRichOperation}><X size={16} /></button>
              <NoteReminderPanel
                noteId={note.id}
                noteText={text}
                disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
                onError={setComposerError}
                onBusyChange={handleReminderBusy}
              />
            </div>
          )}
          <span className="sr-only" aria-live="polite">
            {attachmentCount.toLocaleString()} attached files
          </span>
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
                <small className="sr-only">{saveDetail}</small>
                <small id="composer-character-count" className={saveSnapshot.characterCount > MAX_NOTE_CHARACTERS * 0.9 ? 'composer-character-count' : 'sr-only'}>
                  {saveSnapshot.characterCount.toLocaleString()} /{' '}
                  {MAX_NOTE_CHARACTERS.toLocaleString()}
                </small>
              </div>
              <div className="composer-footer-actions">
                <button
                  type="button"
                  className="secondary danger"
                  aria-label="Move note to Trash"
                  title="Move to Trash"
                  disabled={!canWrite || isFinishing || hasPendingRichOperation}
                  onClick={requestDeleteConfirmation}
                >
                  <Trash2 size={16} aria-hidden="true" />
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
