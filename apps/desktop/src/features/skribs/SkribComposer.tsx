import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Bell,
  LocateFixed,
  Maximize2,
  Minimize2,
  PenLine,
  Type,
  Check,
  CheckCircle2,
  Trash2,
  X,
  MoreHorizontal,
  Plus,
  Paperclip,
  ListChecks,
  Palette,
} from 'lucide-react';
import { OverlayMetrics, SkribNote, TargetWindowInfo } from '../../lib/geometry';
import {
  addInkToNote,
  getInkForNote,
  getRichContent,
  replaceInkForNote,
  replaceRichTextForNote,
  restoreRichContentForNote,
  updateNoteViewPreferences,
  type InkStroke,
  type SkribTextSize,
  type SkribAttachment,
  type StoredRichContent,
} from '../../lib/richContentStore';
import { completeReminder, dismissReminder, listReminders, restoreRemindersForNote, type SkribReminder } from '../../lib/reminderStore';
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
import { contextTagColor } from './contextTagColor';
import { applicationLabel } from '../rail/contextRailModel';
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
import {
  borrowedSurfaceAfterResize,
  roomForNoteTool,
  sameSurfaceSize,
  temporaryToolResizeRequest,
  sizeAfterToolClose,
  type NoteSurfaceDimensions,
  type TemporaryToolSurface,
} from './toolSurfaceGeometry';

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
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const sessionSnapshot = useRef<{ text: string; color: SkribNote['color']; rich: StoredRichContent; reminders: SkribReminder[] } | null>(null);
  const [inlineDeleteRequest, setInlineDeleteRequest] = useState<{ id: string; nonce: number } | null>(null);
  const [attachmentPickerRequest, setAttachmentPickerRequest] = useState(0);
  const [attachmentDrawerRequest, setAttachmentDrawerRequest] = useState(0);
  const [pastedFilesRequest, setPastedFilesRequest] = useState<{ id: number; files: File[] } | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [inlineAttachments, setInlineAttachments] = useState<SkribAttachment[]>([]);
  const [inkStrokes, setInkStrokes] = useState<InkStroke[]>([]);
  const [isInkLoading, setIsInkLoading] = useState(true);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [noteMenuOpen, setNoteMenuOpen] = useState(false);
  const [toolGatewayOpen, setToolGatewayOpen] = useState(false);
  const paletteButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const paperRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!noteMenuOpen && !toolGatewayOpen && !colorPickerOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.composer-side-tools, .composer-intent-gateway, .composer-color-popover')) return;
      setNoteMenuOpen(false);
      setToolGatewayOpen(false);
      setColorPickerOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [noteMenuOpen, toolGatewayOpen, colorPickerOpen]);

  useEffect(() => {
    const selector = noteMenuOpen ? '.composer-note-menu' : toolGatewayOpen ? '.composer-intent-tray' : null;
    if (selector) paperRef.current?.querySelector<HTMLButtonElement>(`${selector} button:not(:disabled)`)?.focus();
  }, [noteMenuOpen, toolGatewayOpen]);
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
  const toolTransitionInProgress = useRef(false);
  const temporaryToolSurface = useRef<TemporaryToolSurface | null>(null);
  const currentNoteId = useRef(note.id);
  currentNoteId.current = note.id;
  const sizeBeforeExpand = useRef<Exclude<NoteSurfaceSize, 'large'>>('medium');
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
  const [showSavedPulse, setShowSavedPulse] = useState(false);
  const previousSaveStatus = useRef(saveController.getSnapshot().status);

  const contextLabel = useMemo(() => {
    if (!target) return note.target_title || note.target_process_name || 'Current application';
    return target.title || target.process_name;
  }, [note.target_process_name, note.target_title, target]);
  const contextTabLabel = applicationLabel(target?.process_name || note.target_process_name || '');
  const contextFullAppLabel = /^(code|code - insiders)(\.exe)?$/i.test(target?.process_name || note.target_process_name || '')
    ? 'Visual Studio Code' : contextTabLabel;

  useEffect(() => {
    setText(saveController.getSnapshot().draft);
    setSaveSnapshot(saveController.getSnapshot());
    setComposerError(null);
    setDiagnosticsPath(null);
    setActivePanel(null);
    setDrawingEnabled(false);
    temporaryToolSurface.current = null;
    setAttachmentCount(0);
    setInlineAttachments([]);
    setRichTextHtml(plainTextToRichHtml(note.text));
    sessionSnapshot.current = null;
    setCancelConfirmationOpen(false);
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
    setColorPickerOpen(false);
    setNoteMenuOpen(false);
    setToolGatewayOpen(false);
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
    const previous = previousSaveStatus.current;
    previousSaveStatus.current = saveSnapshot.status;
    if (saveSnapshot.status !== 'saved') {
      setShowSavedPulse(false);
      return;
    }
    if (previous === 'saved') return;
    setShowSavedPulse(true);
    const timer = window.setTimeout(() => setShowSavedPulse(false), 900);
    return () => window.clearTimeout(timer);
  }, [saveSnapshot.status]);

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
        if (!ink.hasUnsavedChanges && ink.status !== 'saving' && richOperationsInProgress.current.size === 0
          && !toolTransitionInProgress.current && !resizeInProgress.current) {
          richTextEditorRef.current?.flush();
          ready = await flushRichText() && await saveController.flush();
          ready = ready && currentNoteId.current === note.id
            && !toolTransitionInProgress.current && !resizeInProgress.current;
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
    void Promise.all([getInkForNote(note.id), getRichContent(note.id), listReminders()])
      .then(([document, richContent, reminders]) => {
        if (!cancelled) {
          sessionSnapshot.current = {
            text: note.text, color: note.color, rich: richContent,
            reminders: reminders.filter((item) => item.noteId === note.id).map(({ status: _status, ...item }) => item),
          };
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
      if ((!force && nextSize === surfaceSize) || resizeInProgress.current || toolTransitionInProgress.current) return false;
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

  const toggleExpandedSize = useCallback(async () => {
    const nextSize = surfaceSize === 'large' ? sizeBeforeExpand.current : 'large';
    if (surfaceSize !== 'large') sizeBeforeExpand.current = surfaceSize;
    if (await changeSurfaceSize(nextSize)) {
      temporaryToolSurface.current = null;
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
      if (toolTransitionInProgress.current || resizeInProgress.current) return false;
      if (richOperationsInProgress.current.size > 0 || inkPersistenceStateRef.current.hasUnsavedChanges) {
        setComposerError('Wait for the current save before changing this tool.');
        return false;
      }
      toolTransitionInProgress.current = true;
      setColorPickerOpen(false);
      const closing = tool === 'draw' ? drawingEnabled : activePanel === 'reminder';
      try {
        const readSize = async (): Promise<NoteSurfaceDimensions> => {
          if (!isTauriAvailable) return { width: window.innerWidth, height: window.innerHeight };
          const appWindow = getCurrentWindow();
          const [size, scale] = await Promise.all([appWindow.innerSize(), appWindow.scaleFactor()]);
          return { width: size.width / scale, height: size.height / scale };
        };
        const current = await readSize();
        if (currentNoteId.current !== note.id) return false;
        const next = closing
          ? sizeAfterToolClose(temporaryToolSurface.current, current)
          : roomForNoteTool(current, tool);
        if (next && !sameSurfaceSize(next, current)) {
          resizeInProgress.current = true;
          setIsResizing(true);
          if (isTauriAvailable) {
            // Borrowed tool space must never overwrite the durable note size.
            // Reopening after interruption therefore uses the original size.
            await invoke('set_skrib_window_dimensions', temporaryToolResizeRequest(note.id, next));
          }
          const actual = isTauriAvailable ? await readSize() : next;
          if (currentNoteId.current !== note.id) return false;
          if (!closing) {
            temporaryToolSurface.current = borrowedSurfaceAfterResize(temporaryToolSurface.current, current, actual);
          }
          setSurfaceSize(actual.width >= 680 ? 'large' : actual.width >= 500 ? 'medium' : 'compact');
        }
        if (closing) temporaryToolSurface.current = null;
        setDrawingEnabled(!closing && tool === 'draw');
        setActivePanel(!closing && tool === 'reminder' ? 'reminder' : null);
        return true;
      } catch (reason) {
        if (currentNoteId.current === note.id) {
          setComposerError(`Skribli could not make room for this tool: ${reason instanceof Error ? reason.message : String(reason)}`);
        }
        return false;
      } finally {
        resizeInProgress.current = false;
        toolTransitionInProgress.current = false;
        if (currentNoteId.current === note.id) setIsResizing(false);
      }
    },
    [activePanel, drawingEnabled, isTauriAvailable, note.id]
  );

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
    if (toolTransitionInProgress.current || resizeInProgress.current) return;
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
        // Put away also closes the temporary tool surface. Keep the user's
        // original manual size for the next open, unless they resized the tool.
        if (drawingEnabled || activePanel === 'reminder') {
          if (!await openRoomyTool(drawingEnabled ? 'draw' : 'reminder')) return;
        }
        if (currentNoteId.current !== note.id) return;
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
    activePanel,
    drawingEnabled,
    discardEmptySkrib,
    flushRichText,
    hideWindow,
    hasPersistedExtras,
    licenceAllowsWrite,
    note.id,
    openAction,
    openRoomyTool,
    runExclusive,
    saveController,
    setSkribCollapsed,
    storageWritable,
  ]);

  const discardSessionAndClose = useCallback(async () => {
    const baseline = sessionSnapshot.current;
    if (!baseline || !canWrite || richOperationsInProgress.current.size > 0 ||
      inkPersistenceStateRef.current.hasUnsavedChanges || inkPersistenceStateRef.current.status === 'saving') {
      setComposerError('Wait for this note to finish loading or saving before discarding edits.');
      return;
    }
    await runExclusive(async () => {
      const currentDraft = saveController.getSnapshot().draft;
      await saveController.prepareForDelete();
      if (richTextSaveTimer.current) clearTimeout(richTextSaveTimer.current);
      pendingRichText.current = null;
      try {
        await restoreRichContentForNote(note.id, baseline.rich);
        await restoreRemindersForNote(note.id, baseline.reminders);
        void emit('skribly://rich-content-updated', { noteId: note.id }).catch(() => undefined);
        void emit('skribly://reminders-updated', { noteId: note.id }).catch(() => undefined);
        if (note.color !== baseline.color) await updateSkribColor(note.id, baseline.color);
        discardSkribDraft(note.id);
        if (!await persistSkribText(note.id, baseline.text)) throw new Error('The original text could not be restored.');
        if (openAction === 'created') {
          if (!await discardEmptySkrib(note.id)) throw new Error('The new note could not be discarded safely.');
          await hideWindow();
        } else if (openAction === 'detached') {
          await hideWindow();
        } else if (!await setSkribCollapsed(note.id, true)) {
          throw new Error('The note could not close safely.');
        }
      } catch (reason) {
        stageSkribDraft(note.id, currentDraft);
        saveController.resumeAfterDeleteFailure('Discard did not finish. The editor stayed open; retry or save the note.');
        setComposerError(`Discard did not finish: ${reason instanceof Error ? reason.message : String(reason)}`);
      }
    });
  }, [canWrite, discardEmptySkrib, hideWindow, note.color, note.id, openAction, runExclusive, saveController, setSkribCollapsed, updateSkribColor]);

  const cancelDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'cancel'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && cancelConfirmationOpen) {
        event.preventDefault();
        setCancelConfirmationOpen(false);
        return;
      }
      if (event.key === 'Escape' && (noteMenuOpen || toolGatewayOpen || colorPickerOpen)) {
        event.preventDefault();
        if (colorPickerOpen) {
          setColorPickerOpen(false);
          paletteButtonRef.current?.focus();
          return;
        }
        const restoreAdd = toolGatewayOpen;
        setNoteMenuOpen(false);
        setToolGatewayOpen(false);
        setColorPickerOpen(false);
        (restoreAdd ? addButtonRef : moreButtonRef).current?.focus();
        return;
      }
      if (event.key === '/' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setToolGatewayOpen((open) => !open);
        setNoteMenuOpen(false);
        setColorPickerOpen(false);
        return;
      }
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
        if (colorPickerOpen) setColorPickerOpen(false);
        else void openRoomyTool(drawingEnabled ? 'draw' : 'reminder');
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
  }, [activePanel, cancelConfirmationOpen, colorPickerOpen, noteMenuOpen, toolGatewayOpen, drawingEnabled, cancelDeleteConfirmation, deleteConfirmation, finishAndHide, openRoomyTool]);

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
    if (!isTauriAvailable || isFinishing || resizeInProgress.current || toolTransitionInProgress.current || hasPendingRichOperation || hasUnsavedInk) return;
    resizeInProgress.current = true;
    try {
      await invoke('begin_skrib_manual_resize', { noteId: note.id });
      if (currentNoteId.current !== note.id) return;
      temporaryToolSurface.current = null;
      await getCurrentWindow().startResizeDragging(direction);
    } catch (reason) {
      setComposerError(
        `Skribli could not start resizing: ${reason instanceof Error ? reason.message : String(reason)}`
      );
    } finally {
      resizeInProgress.current = false;
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
  const menuVisible = noteMenuOpen;

  return (
    <div className="skrib-composer-backdrop" data-overlay-surface="composer">
      <section
        ref={paperRef}
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
        <header className="composer-paper-top" data-tauri-drag-region>
          <div className="composer-context-tab" data-tauri-drag-region tabIndex={0}
            aria-label={`Place: ${contextLabel}`}
            aria-describedby="composer-place-detail"
            onPointerEnter={() => setPlaceDetailOpen(true)} onPointerLeave={() => setPlaceDetailOpen(false)}
            onFocus={() => setPlaceDetailOpen(true)} onBlur={() => setPlaceDetailOpen(false)}
            style={{ '--context-tag-color': `var(--${contextTagColor(note.id, note.color)})` } as React.CSSProperties}>
            <strong data-tauri-drag-region>{contextTabLabel}</strong>
          </div>
          <span id="composer-open-state" className="sr-only">
            {isNewNote
              ? 'Skribli created a new empty Skrib for this application context.'
              : 'Skribli reopened the existing Skrib for this application context.'}
          </span>
        </header>
        <div id="composer-place-detail" className="composer-place-detail" role="note" data-open={placeDetailOpen}>
          <small>Saved place</small><strong>{contextFullAppLabel}</strong><span>{contextLabel}</span>
        </div>
        <div className="composer-side-tools" data-pinned={noteMenuOpen || undefined}>
            <button
              type="button"
              className="composer-more"
              ref={moreButtonRef}
              aria-controls="composer-note-options"
              onClick={() => {
                setNoteMenuOpen((open) => !open);
                setToolGatewayOpen(false);
                setColorPickerOpen(false);
              }}
              aria-label="More note actions"
              aria-expanded={noteMenuOpen}
              title="More note actions"
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>
          {menuVisible && (
            <div id="composer-note-options" className="composer-note-menu" role="toolbar" aria-label="Note actions">
              <button type="button" className={activePanel === 'reminder' ? 'active' : ''}
                aria-label={activePanel === 'reminder' ? 'Close reminder' : 'Set a reminder'}
                disabled={!canWrite || isFinishing || hasPendingRichOperation}
                onClick={() => { void openRoomyTool('reminder'); setNoteMenuOpen(false); }}>
                <Bell size={17} aria-hidden="true" /><span>{activePanel === 'reminder' ? 'Close reminder' : 'Reminder'}</span>
              </button>
              <button type="button" ref={paletteButtonRef} aria-label="Paper colour"
                aria-expanded={colorPickerOpen} aria-controls="composer-paper-palette"
                onClick={() => setColorPickerOpen((open) => !open)}
                disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}>
                <Palette size={17} aria-hidden="true" /><span>Paper colour</span>
              </button>
              <button type="button" disabled={!canWrite || isFinishing}
                aria-label={`Change text size, currently ${textSize}`} onClick={() => void cycleTextSize()}>
                <Type size={17} aria-hidden="true" /><span>Text size · {textSize}</span>
              </button>
              <button type="button" disabled={isResizing || isFinishing || hasPendingRichOperation || hasUnsavedInk}
                aria-label={surfaceSize === 'large' ? 'Restore note size' : 'Expand note'}
                onClick={() => void toggleExpandedSize()}>
                {surfaceSize === 'large' ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
                <span>{surfaceSize === 'large' ? 'Restore size' : 'Work size'}</span>
              </button>
              {openAction !== 'detached' && <button type="button" aria-label="Return beside app"
                disabled={!isTauriAvailable || isRepositioning || isFinishing || hasPendingRichOperation}
                onClick={() => { setNoteMenuOpen(false); setColorPickerOpen(false); void handleReposition(); }}>
                {isRepositioning ? <span className="composer-button-spinner" aria-hidden="true" /> : <LocateFixed size={17} aria-hidden="true" />}
                <span>Return to app</span>
              </button>}
              <>
                <span className="composer-note-menu-divider" aria-hidden="true" />
                <button type="button" aria-label="Complete task and move note to Archive"
                  disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}
                  onClick={() => { setNoteMenuOpen(false); setColorPickerOpen(false); void handleCompleteTask(); }}>
                  <CheckCircle2 size={17} aria-hidden="true" /><span>Archive task</span>
                </button>
                <button type="button" className="danger" aria-label="Move to Trash"
                  disabled={!canWrite || isFinishing || hasPendingRichOperation}
                  onClick={() => { setNoteMenuOpen(false); setColorPickerOpen(false); requestDeleteConfirmation(); }}>
                  <Trash2 size={17} aria-hidden="true" /><span>Move to Trash</span>
                </button>
              </>
            </div>
          )}
        </div>

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

        <div className="composer-intent-gateway" data-open={toolGatewayOpen || undefined}>
          <button
            type="button"
            className="composer-intent-trigger"
            ref={addButtonRef}
            aria-controls="composer-add-options"
            onClick={() => {
              setToolGatewayOpen((open) => !open);
              setNoteMenuOpen(false);
              setColorPickerOpen(false);
            }}
            aria-label="Add or mark this Skrib"
            aria-expanded={toolGatewayOpen}
            title="Add something to this thought"
          >
            <Plus size={17} aria-hidden="true" />
          </button>
          {toolGatewayOpen && (
            <div id="composer-add-options" className="composer-intent-tray" role="group" aria-label="Skrib tools">
              <button
                type="button"
                className={drawingEnabled ? 'active' : ''}
                aria-label={drawingEnabled ? 'Finish drawing' : 'Draw on this note'}
                aria-pressed={drawingEnabled}
                disabled={!canWrite || isFinishing || isInkLoading}
                onClick={() => {
                  void openRoomyTool('draw');
                  setToolGatewayOpen(false);
                }}
              >
                <PenLine size={15} aria-hidden="true" />
                <span>{drawingEnabled ? 'Finish drawing' : 'Draw'}</span>
              </button>
              <button
                type="button"
                disabled={!canWrite || isFinishing || hasPendingRichOperation || drawingEnabled}
                aria-label="Attach a photo, video or file"
                onClick={() => {
                  if (drawingEnabled) return;
                  setAttachmentPickerRequest((request) => request + 1);
                  setToolGatewayOpen(false);
                }}
              >
                <Paperclip size={15} aria-hidden="true" />
                <span>Attach</span>
              </button>
              {attachmentCount > 0 && <button
                type="button"
                aria-label={`View all ${attachmentCount} attachments`}
                onClick={() => {
                  setAttachmentDrawerRequest((request) => request + 1);
                  setToolGatewayOpen(false);
                }}
              >
                <Paperclip size={15} aria-hidden="true" />
                <span>All files · {attachmentCount}</span>
              </button>}
              <button
                type="button"
                disabled={!canWrite || isFinishing || drawingEnabled}
                aria-label="Add a checklist"
                onClick={() => {
                  richTextEditorRef.current?.insertChecklist();
                  setToolGatewayOpen(false);
                }}
              >
                <ListChecks size={15} aria-hidden="true" />
                <span>Checklist</span>
              </button>
              <button
                type="button"
                className={activePanel === 'reminder' ? 'active' : ''}
                aria-label={activePanel === 'reminder' ? 'Close reminder' : 'Set a reminder'}
                aria-expanded={activePanel === 'reminder'}
                disabled={!canWrite || isFinishing || hasPendingRichOperation}
                onClick={() => {
                  void openRoomyTool('reminder');
                  setToolGatewayOpen(false);
                }}
              >
                <Bell size={15} aria-hidden="true" />
                <span>{activePanel === 'reminder' ? 'Close reminder' : 'Remind me'}</span>
              </button>
            </div>
          )}
        </div>

        {colorPickerOpen && (
          <div id="composer-paper-palette" className="composer-color-popover" role="group" aria-label="Note color">
            {NOTE_COLORS.map((color) => (
              <button key={color} type="button"
                className={`color-swatch skrib-color-${color} ${note.color === color ? 'active' : ''}`}
                aria-label={`${color} note`} aria-pressed={note.color === color}
                disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}
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
            <RichTextEditor
              ref={richTextEditorRef}
              noteId={note.id}
              initialHtml={richTextHtml}
              attachments={inlineAttachments}
              disabled={!canWrite || isInkLoading}
              drawingEnabled={drawingEnabled}
              describedBy={textareaDescription}
              onChange={handleRichTextChange}
              onPasteFiles={(files) => setPastedFilesRequest({ id: Date.now(), files })}
              onRequestAttachment={canWrite && !isFinishing && !hasPendingRichOperation
                ? () => setAttachmentPickerRequest((request) => request + 1) : undefined}
              onDeleteAttachment={(id) => setInlineDeleteRequest((previous) => ({ id, nonce: (previous?.nonce ?? 0) + 1 }))}
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
                  onFinishDrawing={() => void openRoomyTool('draw')}
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
            removeRequest={inlineDeleteRequest}
            openDrawerRequest={attachmentDrawerRequest}
            filesRequest={pastedFilesRequest}
            disabled={!canWrite || isInkLoading || isFinishing || drawingEnabled || deleteConfirmation === 'confirming'}
            onError={setComposerError}
            onBusyChange={handleAttachmentsBusy}
            onCountChange={setAttachmentCount}
            onAttachmentsChange={setInlineAttachments}
            onPlaceInline={(items) => richTextEditorRef.current?.insertAttachments(items) ?? false}
            onRemoved={(id) => richTextEditorRef.current?.removeAttachment(id)}
          />

          {activePanel === 'reminder' && (
            <div className="composer-inline-panel">
              <button className="composer-panel-close" type="button" title="Back to your thought" aria-label="Close reminder panel" onClick={() => void openRoomyTool('reminder')} disabled={hasPendingRichOperation || isResizing}><X size={16} /></button>
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

        <div
          id="composer-save-status"
          className="composer-save-indicator"
          data-state={saveSnapshot.status}
          data-visible={saveSnapshot.status !== 'saved' || showSavedPulse || undefined}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden={saveSnapshot.status === 'saved' && !showSavedPulse}>
            {saveSnapshot.status === 'saving'
              ? 'Saving…'
              : saveSnapshot.status === 'failed'
                ? 'Save failed'
                : saveSnapshot.status === 'dirty'
                  ? 'Unsaved'
                  : 'Saved locally'}
          </span>
          <span className="sr-only">{saveLabel}. {saveDetail}</span>
          <small id="composer-character-count" className={saveSnapshot.characterCount > MAX_NOTE_CHARACTERS * 0.9 ? 'composer-character-count' : 'sr-only'}>
            {saveSnapshot.characterCount.toLocaleString()} / {MAX_NOTE_CHARACTERS.toLocaleString()}
          </small>
        </div>

        {deleteConfirmation === 'confirming' && (
          <div className="composer-delete-confirmation composer-attached-confirmation" role="alert" aria-live="assertive">
            <div className="composer-delete-copy">
              <strong>Move this note to Trash?</strong>
              <small id="composer-delete-warning">
                You can restore it from All Skribs for 30 days.
              </small>
            </div>
            <div className="composer-footer-actions">
              <button type="button" className="secondary" autoFocus disabled={isFinishing} onClick={cancelDeleteConfirmation}>
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
        )}

        {cancelConfirmationOpen && (
          <div className="composer-discard-confirmation" role="alertdialog" aria-label="Discard this editing session">
            <strong>{openAction === 'created' ? 'Discard this new note?' : 'Discard changes since opening?'}</strong>
            <span>{openAction === 'created' ? 'The new note and its files will be removed.' : 'The previously saved note will stay.'}</span>
            <div>
              <button type="button" onClick={() => setCancelConfirmationOpen(false)}>Keep editing</button>
              <button type="button" className="danger" onClick={() => void discardSessionAndClose()}
                disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk}>Discard</button>
            </div>
          </div>
        )}
        <button type="button" className="composer-cancel-session" aria-label="Cancel and discard edits since opening"
          title="Cancel · discard edits since opening" onClick={() => setCancelConfirmationOpen(true)}
          disabled={!canWrite || isFinishing || isInkLoading || !sessionSnapshot.current || hasPendingRichOperation || hasUnsavedInk || deleteConfirmation === 'confirming'}>
          <X size={17} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="composer-put-away-fold"
          onClick={() => void finishAndHide()}
          disabled={isFinishing || isRepositioning || hasPendingRichOperation || hasUnsavedInk || deleteConfirmation === 'confirming' || cancelConfirmationOpen}
          aria-label={
            storageWritable
              ? openAction === 'detached'
                ? 'Done — save and close this Skrib'
                : 'Done — save and put this Skrib away'
              : 'Storage recovery required'
          }
          title={storageWritable ? 'Done — save and put away' : 'Storage recovery required'}
        >
          {isFinishing ? <span className="composer-button-spinner" aria-hidden="true" /> : 'Done'}
        </button>
        {(['NorthWest', 'NorthEast', 'SouthWest', 'SouthEast'] as ResizeDirection[]).map((direction) => (
          <button
            key={direction}
            type="button"
            className={`composer-resize-handle ${direction.toLowerCase()}`}
            aria-label={`Resize this Skrib from the ${direction.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} corner`}
            title="Drag this corner until the Skrib feels right"
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
