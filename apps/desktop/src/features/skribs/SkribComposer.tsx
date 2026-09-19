import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Bell,
  Check,
  CheckCircle2,
  LocateFixed,
  MoreHorizontal,
  PenLine,
  Trash2,
  X,
} from 'lucide-react';
import { OverlayMetrics, SkribNote, TargetWindowInfo } from '../../lib/geometry';
import {
  addInkToNote,
  getInkForNote,
  getRichContent,
  replaceInkForNote,
  replaceRichTextForNote,
  updateNoteViewPreferences,
  type InkStroke,
  type SkribTextSize,
} from '../../lib/richContentStore';
import { completeReminder, dismissReminder, listReminders } from '../../lib/reminderStore';
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
import {
  plainTextToRichHtml,
  RichTextEditor,
  type RichTextEditorHandle,
} from './RichTextEditor';
import { discardSkribDraft, persistSkribText, stageSkribDraft } from './textPersistence';

type ComposerPanel = 'reminder' | null;
type NoteSurfaceSize = 'compact' | 'medium' | 'large';
type ResizeDirection = 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest';

const NOTE_COLORS = ['yellow', 'peach', 'mint', 'sky', 'lavender', 'rose', 'aqua', 'sand'] as const;
const NOTE_TEXT_SIZES: SkribTextSize[] = ['small', 'medium', 'large'];

interface SkribComposerProps {
  note: SkribNote;
  target: TargetWindowInfo | null;
  openAction: OpenNoteAction;
}

export const SkribComposer: React.FC<SkribComposerProps> = ({ note, target, openAction }) => {
  const {
    trashSkrib,
    archiveSkrib,
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
  const [pastedFilesRequest, setPastedFilesRequest] = useState<{ id: number; files: File[] } | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [inkStrokes, setInkStrokes] = useState<InkStroke[]>([]);
  const [isInkLoading, setIsInkLoading] = useState(true);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
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
  const richTextEditorRef = useRef<RichTextEditorHandle>(null);
  const richTextSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRichText = useRef<{ html: string; plainText: string } | null>(null);
  const [richTextHtml, setRichTextHtml] = useState(() => plainTextToRichHtml(note.text));
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
  const flushRichText = useCallback(async () => {
    if (richTextSaveTimer.current) {
      clearTimeout(richTextSaveTimer.current);
      richTextSaveTimer.current = null;
    }
    const pending = pendingRichText.current;
    if (!pending) return true;
    pendingRichText.current = null;
    setRichOperationBusy('rich-text', true);
    try {
      await replaceRichTextForNote(note.id, pending);
      void emit('skribly://rich-content-updated', { noteId: note.id }).catch(() => undefined);
      return true;
    } catch (reason) {
      pendingRichText.current = pending;
      setComposerError(
        `Skribli could not save this formatting yet: ${reason instanceof Error ? reason.message : String(reason)}`
      );
      return false;
    } finally {
      setRichOperationBusy('rich-text', false);
    }
  }, [note.id, setRichOperationBusy]);

  const scheduleRichTextSave = useCallback((html: string, plainText: string) => {
    pendingRichText.current = { html, plainText };
    if (richTextSaveTimer.current) clearTimeout(richTextSaveTimer.current);
    richTextSaveTimer.current = setTimeout(() => void flushRichText(), 320);
  }, [flushRichText]);
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
  const [showSavedCheck, setShowSavedCheck] = useState(false);
  const previousSaveStatus = useRef(saveController.getSnapshot().status);

  useEffect(() => {
    const previous = previousSaveStatus.current;
    previousSaveStatus.current = saveSnapshot.status;
    if (
      saveSnapshot.status !== 'saved' ||
      (previous !== 'dirty' && previous !== 'saving')
    ) {
      return;
    }
    setShowSavedCheck(true);
    const timer = window.setTimeout(() => setShowSavedCheck(false), 900);
    return () => window.clearTimeout(timer);
  }, [saveSnapshot.status]);

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
    setRichTextHtml(plainTextToRichHtml(note.text));
    pendingRichText.current = null;
    if (richTextSaveTimer.current) clearTimeout(richTextSaveTimer.current);
    richOperationsInProgress.current.clear();
    setRichOperationCount(0);
    const cleanInkState: InkPersistenceState = {
      status: 'idle',
      hasUnsavedChanges: false,
      error: null,
    };
    inkPersistenceStateRef.current = cleanInkState;
    setInkPersistenceState(cleanInkState);
    setMoreMenuOpen(false);
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
    if (!isTauriAvailable) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let scaleFactor = 1;
    let resizeFrame: number | null = null;
    const appWindow = getCurrentWindow();
    void appWindow.scaleFactor().then((value) => {
      if (!disposed) scaleFactor = Math.max(value, 0.1);
    }).catch(() => undefined);
    void appWindow.onResized(({ payload }) => {
      if (disposed) return;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        if (disposed) return;
        const width = payload.width / scaleFactor;
        setSurfaceSize(width >= 680 ? 'large' : width >= 500 ? 'medium' : 'compact');
      });
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      unlisten?.();
    };
  }, [isTauriAvailable]);

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
          richTextEditorRef.current?.flush();
          ready = await flushRichText() && await saveController.flush();
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
  }, [flushRichText, isTauriAvailable, note.id, saveController]);

  useEffect(() => {
    let cancelled = false;
    setIsInkLoading(true);
    void Promise.all([getInkForNote(note.id), getRichContent(note.id)])
      .then(([document, richContent]) => {
        if (!cancelled) {
          setInkStrokes(document.strokes);
          setTextSize(richContent.view?.textSize ?? 'medium');
          setAttachmentCount(richContent.attachments.length);
          setRichTextHtml(
            richContent.richText?.plainText === note.text
              ? richContent.richText.html
              : plainTextToRichHtml(note.text)
          );
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
        return false;
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

  const openRoomyTool = useCallback(
    async (tool: 'draw' | 'reminder') => {
      setMoreMenuOpen(false);
      if (tool === 'draw') {
        const nextEnabled = !drawingEnabled;
        if (nextEnabled && !await changeSurfaceSize('large', true)) return;
        setDrawingEnabled(nextEnabled);
        setActivePanel(null);
        return;
      }
      const openingReminder = activePanel !== 'reminder';
      if (
        openingReminder &&
        surfaceSize === 'compact' &&
        !await changeSurfaceSize('medium', true)
      ) return;
      setDrawingEnabled(false);
      setActivePanel(openingReminder ? 'reminder' : null);
    },
    [activePanel, changeSurfaceSize, drawingEnabled, surfaceSize]
  );

  const prepareAttachmentDrawer = useCallback(async () => {
    if (surfaceSize !== 'compact') return true;
    return changeSurfaceSize('medium', true);
  }, [changeSurfaceSize, surfaceSize]);

  const hasPersistedExtras = useCallback(async () => {
    const [richContent, reminders] = await Promise.all([
      getRichContent(note.id),
      listReminders(),
    ]);
    return (
      richContent.attachments.length > 0 ||
      Boolean(richContent.inkDocument?.strokes.length) ||
      Boolean(richContent.richText?.html) ||
      reminders.some((reminder) => reminder.noteId === note.id)
    );
  }, [note.id]);

  const finishAndHide = useCallback(async () => {
    await runExclusive(async () => {
      richTextEditorRef.current?.flush();
      if (!await flushRichText()) return;
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
    flushRichText,
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

      if (event.key === 'Escape' && (moreMenuOpen || activePanel || drawingEnabled)) {
        event.preventDefault();
        if (richOperationsInProgress.current.size > 0 || inkPersistenceStateRef.current.hasUnsavedChanges) {
          setComposerError('Wait for the current save before closing this tool.');
          return;
        }
        setMoreMenuOpen(false);
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
  }, [activePanel, moreMenuOpen, drawingEnabled, cancelDeleteConfirmation, deleteConfirmation, finishAndHide]);

  const handleTextChange = (value: string): boolean => {
    if (!canWrite) {
      setComposerError(
        storageErrorMessage || licenseStatus.message || 'This build is currently read-only.'
      );
      return false;
    }

    const result = saveController.setDraft(value);
    if (!result.accepted) {
      setComposerError(result.error);
      return false;
    }

    stageSkribDraft(note.id, value);
    setText(value);
    setComposerError(null);
    return true;
  };

  const handleRichTextChange = (html: string, plainText: string): boolean => {
    if (!handleTextChange(plainText)) return false;
    setRichTextHtml(html);
    scheduleRichTextSave(html, plainText);
    return true;
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

  const startManualResize = async (direction: ResizeDirection) => {
    if (!isTauriAvailable || isFinishing || hasPendingRichOperation || hasUnsavedInk) return;
    try {
      await getCurrentWindow().startResizeDragging(direction);
    } catch (reason) {
      setComposerError(
        `Skribli could not start resizing: ${reason instanceof Error ? reason.message : String(reason)}`
      );
    }
  };

  const handleColorChange = async (color: (typeof NOTE_COLORS)[number]) => {
    if (!canWrite || color === note.color) {
      setMoreMenuOpen(false);
      return;
    }
    try {
      await updateSkribColor(note.id, color);
      setMoreMenuOpen(false);
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

  const handleCompleteTask = async () => {
    await runExclusive(async () => {
      if (!canWrite) {
        setComposerError(storageErrorMessage || licenseStatus.message || 'This build is currently read-only.');
        return;
      }
      richTextEditorRef.current?.flush();
      if (!await flushRichText()) return;
      if (inkPersistenceStateRef.current.hasUnsavedChanges || richOperationsInProgress.current.size > 0) {
        setComposerError('Skribli is still saving this note. Wait a moment before completing it.');
        return;
      }
      if (!await saveController.flush()) {
        setComposerError('The note could not be saved safely, so it was not archived.');
        return;
      }
      if (!await archiveSkrib(note.id)) {
        setComposerError('Skribli could not move this completed note to Archive. It remains active.');
        return;
      }
      try {
        const linkedReminders = (await listReminders()).filter(
          (reminder) => reminder.noteId === note.id &&
            (reminder.status === 'upcoming' || reminder.status === 'overdue')
        );
        await Promise.all(linkedReminders.map((reminder) => completeReminder(reminder.id)));
        void emit('skribly://reminders-updated', { noteId: note.id }).catch(() => undefined);
      } catch {
        // The completed note is already safely archived; reminder refresh can retry later.
      }
      discardSkribDraft(note.id);
      await hideWindow();
    });
  };

  const recoveryDirectory = storageNotice?.backupDirectory || storageBackupDirectory;
  const visibleError =
    composerError || inkPersistenceState.error || saveSnapshot.error || storageErrorMessage;
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
  const hasActionableContent = richTextHtml.includes('data-checklist="true"');
  const isVisiblySaving =
    saveSnapshot.status === 'saving' ||
    hasPendingRichOperation ||
    inkPersistenceState.status === 'saving';

  return (
    <div className="skrib-composer-backdrop" data-overlay-surface="composer">
      <section
        className={`skrib-composer skrib-color-${note.color}`}
        data-resizing={isResizing}
        data-surface-size={surfaceSize}
        aria-label={
          canWrite
            ? isNewNote
              ? 'Write a new contextual note'
              : 'Edit a reopened contextual note'
            : 'View contextual note'
        }
      >
        <header className="composer-header" data-tauri-drag-region title="Drag this paper edge to move the Skrib">
          <span className="composer-drag-grip" data-tauri-drag-region aria-hidden="true" />
          <div className="composer-context" data-tauri-drag-region>
            <span className="composer-context-chip" data-tauri-drag-region title={contextLabel}>
              <span className="composer-context-mark" aria-hidden="true" data-tauri-drag-region />
              <strong data-tauri-drag-region>{contextLabel}</strong>
            </span>
            <span id="composer-open-state" className="sr-only">
              {isNewNote
                ? 'Skribli created a new empty Skrib for this application context.'
                : 'Skribli reopened the existing Skrib for this application context.'}
            </span>
          </div>
          <div className="composer-header-actions">
            <button
              type="button"
              className="composer-more"
              onClick={() => setMoreMenuOpen((open) => !open)}
              disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk}
              aria-label="More Skrib options"
              aria-expanded={moreMenuOpen}
              title="More options"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
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

        <div className="composer-edge-tools" aria-label="Skrib tools">
          <button
            type="button"
            className={`composer-edge-tool ${drawingEnabled ? 'active' : ''}`}
            aria-pressed={drawingEnabled}
            aria-label="Ink on this Skrib"
            title="Ink on this Skrib"
            disabled={!canWrite || isFinishing || isInkLoading}
            onClick={() => void openRoomyTool('draw')}
          >
            <PenLine size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`composer-edge-tool ${activePanel === 'reminder' ? 'active' : ''}`}
            aria-expanded={activePanel === 'reminder'}
            aria-label="Bring this thought back later"
            title="Bring this thought back later"
            disabled={!canWrite || isFinishing || hasPendingRichOperation}
            onClick={() => void openRoomyTool('reminder')}
          >
            <Bell size={15} aria-hidden="true" />
          </button>
        </div>

        {moreMenuOpen && (
          <aside className="composer-more-popover" aria-label="Skrib options">
            <div className="composer-more-section">
              <span className="composer-more-label">Paper</span>
              <div className="composer-more-swatches" role="group" aria-label="Paper color">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch skrib-color-${color} ${note.color === color ? 'active' : ''}`}
                    aria-label={`${color} paper`}
                    aria-pressed={note.color === color}
                    title={`${color} paper`}
                    onClick={() => void handleColorChange(color)}
                  >
                    {note.color === color && <Check size={12} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="composer-more-section">
              <span className="composer-more-label">Writing size</span>
              <div className="composer-more-segments" role="group" aria-label="Writing size">
                {NOTE_TEXT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={textSize === size ? 'active' : ''}
                    aria-pressed={textSize === size}
                    disabled={!canWrite || isFinishing}
                    onClick={() => void changeTextSize(size)}
                  >
                    {size === 'small' ? 'Small' : size === 'medium' ? 'Work' : 'Large'}
                  </button>
                ))}
              </div>
            </div>

            <div className="composer-more-section">
              <span className="composer-more-label">Paper size</span>
              <div className="composer-more-segments" role="group" aria-label="Paper size">
                {(['compact', 'medium', 'large'] as NoteSurfaceSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={surfaceSize === size ? 'active' : ''}
                    aria-pressed={surfaceSize === size}
                    disabled={isResizing || isFinishing || hasPendingRichOperation || hasUnsavedInk}
                    onClick={() => void changeSurfaceSize(size)}
                  >
                    {size === 'compact' ? 'Fit' : size === 'medium' ? 'Work' : 'Wide'}
                  </button>
                ))}
              </div>
            </div>

            <div className="composer-more-actions">
              {openAction !== 'detached' && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    void handleReposition();
                  }}
                  disabled={!isTauriAvailable || isRepositioning || isFinishing || hasPendingRichOperation}
                >
                  <LocateFixed size={14} aria-hidden="true" />
                  Reposition beside app
                </button>
              )}
              {hasActionableContent && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    void handleCompleteTask();
                  }}
                  disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Complete checklist
                </button>
              )}
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setMoreMenuOpen(false);
                  requestDeleteConfirmation();
                }}
                disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}
              >
                <Trash2 size={14} aria-hidden="true" />
                Move to Trash
              </button>
            </div>
          </aside>
        )}

        <div className={`composer-unified-workspace ${activePanel ? 'panel-open' : ''}`}>
          <div
            className={`composer-unified-canvas ${drawingEnabled ? 'drawing' : 'typing'}`}
            data-text-size={textSize}
          >
            <RichTextEditor
              ref={richTextEditorRef}
              noteId={note.id}
              initialHtml={richTextHtml}
              disabled={!canWrite}
              drawingEnabled={drawingEnabled}
              describedBy={textareaDescription}
              onChange={handleRichTextChange}
              onPasteFiles={(files) => setPastedFilesRequest({ id: Date.now(), files })}
              onAttach={() => setAttachmentPickerRequest((request) => request + 1)}
              onReminder={() => void openRoomyTool('reminder')}
              onInk={() => void openRoomyTool('draw')}
              onBlur={() => {
                if (!canWrite || operationInProgress.current) return;
                richTextEditorRef.current?.flush();
                void Promise.all([flushRichText(), saveController.flush()]).then(([richSaved, saved]) => {
                  if (
                    (!saved || !richSaved) &&
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
            filesRequest={pastedFilesRequest}
            disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
            onError={setComposerError}
            onBusyChange={handleAttachmentsBusy}
            onCountChange={setAttachmentCount}
            onRequestExpand={prepareAttachmentDrawer}
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

        {deleteConfirmation === 'confirming' && (
          <div className="composer-delete-sheet" role="alert" aria-live="assertive">
            <div className="composer-delete-copy">
              <strong>Move this Skrib to Trash?</strong>
              <small id="composer-delete-warning">
                You can restore it from My Skribs for 30 days.
              </small>
            </div>
            <div className="composer-delete-actions">
              <button type="button" autoFocus disabled={isFinishing} onClick={cancelDeleteConfirmation}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk}
                onClick={() => void handleDelete()}
              >
                {isFinishing ? 'Moving…' : 'Move to Trash'}
              </button>
            </div>
          </div>
        )}

        <div
          id="composer-save-status"
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          <span>{saveDetail}</span>
          <span id="composer-character-count">
            {saveSnapshot.characterCount.toLocaleString()} / {MAX_NOTE_CHARACTERS.toLocaleString()}
          </span>
        </div>

        <div
          className={`composer-save-flash ${isVisiblySaving ? 'saving visible' : showSavedCheck ? 'saved visible' : ''}`}
          aria-hidden="true"
        >
          {isVisiblySaving ? <span className="composer-save-dot" /> : <Check size={13} />}
        </div>

        <button
          type="button"
          className="composer-put-away"
          onClick={() => void finishAndHide()}
          disabled={isFinishing || isRepositioning || hasPendingRichOperation || hasUnsavedInk}
          aria-label={
            storageWritable
              ? openAction === 'detached'
                ? 'Done — save and close this Skrib'
                : 'Done — save and put this Skrib away'
              : 'Storage recovery required'
          }
          title={
            storageWritable
              ? openAction === 'detached'
                ? 'Done — save and close'
                : 'Done — save and put away'
              : 'Storage recovery required'
          }
        >
          <span className="composer-put-away-fold" aria-hidden="true" />
          {isFinishing
            ? <span className="composer-button-spinner" aria-hidden="true" />
            : <Check size={14} aria-hidden="true" />}
        </button>

        {(['NorthWest', 'NorthEast', 'SouthWest', 'SouthEast'] as ResizeDirection[]).map((direction) => (
          <button
            key={direction}
            type="button"
            className={`composer-resize-handle ${direction.toLowerCase()}`}
            aria-label={`Resize this Skrib from the ${direction.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} corner`}
            title={direction === 'SouthEast' ? 'Drag this folded corner to resize' : 'Drag this corner to resize'}
            onPointerDown={(event) => {
              event.preventDefault();
              void startManualResize(direction);
            }}
          />
        ))}
      </section>
    </div>
  );
};
