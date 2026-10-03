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
  Archive,
  Trash2,
  X,
  MoreHorizontal,
  Plus,
  Paperclip,
  ListChecks,
} from 'lucide-react';
import type { SkribNote } from './model/noteTypes';
import type { OverlayMetrics, TargetWindowInfo } from '../../shared/native/windowTypes';
import {
  addInkToNote,
  getInkForNote,
  getRichContent,
  replaceInkForNote,
  replaceRichTextForNote,
  restoreRichContentForNote,
  retainDiscardRecoveryForNote,
  clearDiscardRecoveryForNote,
  updateNoteViewPreferences,
  type InkStroke,
  type SkribTextSize,
  type SkribAttachment,
} from './persistence/richContentStore';
import { cancelRemindersForTrashedNote, completeRemindersForArchivedNote, listReminders, restoreRemindersForNote } from '../reminders/persistence/reminderStore';
import { useLicenseStore } from '../licensing/state/licenseStore';
import { useSkribStore } from './state/skribStore';
import { useSkribUiStore } from './state/skribUiStore';
import {
  DraftSaveController,
  DraftSaveSnapshot,
} from './lifecycle/draftSaveController';
import {
  INITIAL_DELETE_CONFIRMATION_STATE,
  reduceDeleteConfirmation,
  type DeleteConfirmationState,
} from './lifecycle/deleteConfirmation';
import type { OpenNoteAction } from './lifecycle/noteLifecycle';
import { bundledAppIcon } from './bundledAppIcon';
import { applicationLabel } from '../widget/model/contextRailModel';
import { InkCanvas } from './components/InkCanvas';
import type { InkPersistenceState } from './persistence/inkPersistenceCoordinator';
import { NoteAttachmentPanel } from './components/NoteAttachmentPanel';
import { NoteReminderPanel } from '../reminders/components/NoteReminderPanel';
import {
  plainTextToRichHtml,
  RichTextEditor,
  type RichTextEditorHandle,
} from './components/RichTextEditor';
import { discardSkribDraft, persistSkribText, stageSkribDraft } from './persistence/textPersistence';
import { NoteCloseConfirmation } from './components/NoteCloseConfirmation';
import { NoteDeleteConfirmation } from './components/NoteDeleteConfirmation';
import { NotePlaceHeader } from './components/NotePlaceHeader';
import { NoteSaveIndicator } from './components/NoteSaveIndicator';
import { NoteWindowControls } from './components/NoteWindowControls';
import { RichTextSaveController } from './persistence/richTextSaveController';
import { hasMeaningfulRichText } from './model/richTextPresence';
import { discardWithRecovery, restoreNoteSession, type NoteDiscardRecovery, type NoteSessionSnapshot } from './lifecycle/discardRecovery';
import type { NoteSurfaceSize, ResizeDirection } from './model/noteSurfaceTypes';
import {
  borrowedSurfaceAfterResize,
  roomForNoteTool,
  sameSurfaceSize,
  temporaryToolResizeRequest,
  sizeAfterToolClose,
  type NoteSurfaceDimensions,
  type TemporaryToolSurface,
} from './model/toolSurfaceGeometry';

type ComposerPanel = 'reminder' | null;

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
  // Store the session baseline by note identity. Store-driven text/color updates
  // for this same note must not recreate the save controller or change Discard.
  const [sessionInitial, setSessionInitial] = useState(() => ({
    noteId: note.id, text: note.text, color: note.color,
  }));
  if (sessionInitial.noteId !== note.id) {
    setSessionInitial({ noteId: note.id, text: note.text, color: note.color });
  }
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
  const [nativeTransitionBusy, setNativeTransitionBusy] = useState(false);
  const nativeTransitionRequest = useRef<string | null>(null);
  const nativeTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [richReadFailed, setRichReadFailed] = useState(false);
  const [richLoadRevision, setRichLoadRevision] = useState(0);
  const [attachmentRefresh, setAttachmentRefresh] = useState(0);
  const [discardRecovery, setDiscardRecovery] = useState<NoteDiscardRecovery | null>(null);
  const canWrite = storageWritable && licenceAllowsWrite && !discardRecovery && !nativeTransitionBusy && !richReadFailed;
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sessionSnapshot = useRef<NoteSessionSnapshot | null>(null);
  const [attachmentPickerRequest, setAttachmentPickerRequest] = useState(0);
  const [attachmentDrawerRequest, setAttachmentDrawerRequest] = useState(0);
  const [pastedFilesRequest, setPastedFilesRequest] = useState<{ id: number; noteId: string; files: File[] } | null>(null);
  const clipboardRequestSequence = useRef(0);
  const clipboardReservation = useRef<{ id: number; noteId: string } | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [inlineAttachments, setInlineAttachments] = useState<SkribAttachment[]>([]);
  const [inkStrokes, setInkStrokes] = useState<InkStroke[]>([]);
  const [isInkLoading, setIsInkLoading] = useState(true);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [noteMenuOpen, setNoteMenuOpen] = useState(false);
  const [toolGatewayOpen, setToolGatewayOpen] = useState(false);
  const [hasScheduledReminder, setHasScheduledReminder] = useState(false);
  const [nativeAppIconUrl, setNativeAppIconUrl] = useState<string | null>(null);
  const paletteButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreOpenedByKeyboard = useRef(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  const contextTabRef = useRef<HTMLDivElement>(null);

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
    if (noteMenuOpen && moreOpenedByKeyboard.current) {
      paperRef.current?.querySelector<HTMLButtonElement>('.composer-note-menu button:not(:disabled)')?.focus();
    } else if (toolGatewayOpen) {
      paperRef.current?.querySelector<HTMLButtonElement>('.composer-intent-tray button:not(:disabled)')?.focus();
    }
  }, [noteMenuOpen, toolGatewayOpen]);
  const [richDraftPending, setRichDraftPending] = useState(false);
  const [richSaveFailed, setRichSaveFailed] = useState(false);
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
  const reportBlockedPaste = useCallback(() => {
    setComposerError('Paste was not added while this note was busy or read-only. Your clipboard was not changed; paste again when the note is ready.');
  }, []);
  const settleClipboardRequest = useCallback((requestId: number, requestNoteId: string) => {
    if (clipboardReservation.current?.id !== requestId || clipboardReservation.current.noteId !== requestNoteId) return;
    clipboardReservation.current = null;
    if (currentNoteId.current === requestNoteId) {
      setRichOperationBusy('clipboard', false);
      setPastedFilesRequest((request) => request?.id === requestId ? null : request);
    }
  }, [setRichOperationBusy]);
  useEffect(() => () => { clipboardReservation.current = null; }, []);
  const richSaveController = useMemo(() => new RichTextSaveController(async (draft) => {
    if (currentNoteId.current === note.id) setRichOperationBusy('rich-text', true);
    try {
      await replaceRichTextForNote(note.id, draft);
      if (currentNoteId.current === note.id) setRichSaveFailed(false);
      void emit('skribly://rich-content-updated', { noteId: note.id }).catch(() => undefined);
    } finally {
      if (currentNoteId.current === note.id) setRichOperationBusy('rich-text', false);
    }
  }, (reason) => {
    if (currentNoteId.current === note.id) {
      setRichSaveFailed(true);
      setComposerError(`Skribli could not save this formatting yet: ${reason instanceof Error ? reason.message : String(reason)}`);
    }
  }, 320, setRichDraftPending), [note.id, setRichOperationBusy]);
  const flushRichText = useCallback(() => richSaveController.flush(), [richSaveController]);
  const scheduleRichTextSave = useCallback((html: string, plainText: string) => {
    richSaveController.setDraft({ html, plainText });
  }, [richSaveController]);
  useEffect(() => { richSaveController.activate(); return () => richSaveController.suspend(); }, [richSaveController]);
  const handleInkPersistenceState = useCallback((state: InkPersistenceState) => {
    inkPersistenceStateRef.current = state;
    setInkPersistenceState(state);
  }, []);

  const saveController = useMemo(
    () =>
      new DraftSaveController({
        initialText: sessionInitial.text,
        persist: (draft) => persistSkribText(sessionInitial.noteId, draft),
      }),
    [sessionInitial]
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

  useEffect(() => {
    if (!isTauriAvailable) return;
    const processName = target?.process_name || note.target_process_name;
    if (!processName) return;
    let live = true;
    setNativeAppIconUrl(null);
    void invoke<string | null>('get_app_icon', { processName }).then((url) => {
      if (live && url?.startsWith('data:image/png;base64,') && url.length <= 32_000) {
        setNativeAppIconUrl(url);
      }
    }).catch(() => undefined);
    return () => { live = false; };
  }, [isTauriAvailable, note.target_process_name, target?.process_name]);
  const appProcessName = target?.process_name || note.target_process_name;
  const appIconUrl = bundledAppIcon(appProcessName)
    ?? nativeAppIconUrl;

  useEffect(() => {
    if (!isTauriAvailable) return;
    const tab = contextTabRef.current;
    if (!tab) return;
    let live = true;
    const syncBounds = () => {
      if (!live) return;
      const root = tab.closest('.skrib-composer-backdrop');
      if (!root) return;
      const rect = tab.getBoundingClientRect();
      const origin = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      void invoke('set_skrib_tab_bounds', {
        noteId: note.id,
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      }).catch(() => undefined);
    };
    syncBounds();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncBounds);
    observer?.observe(tab);
    window.addEventListener('resize', syncBounds);
    const retry = window.setTimeout(syncBounds, 90);
    return () => { live = false; observer?.disconnect(); window.removeEventListener('resize', syncBounds); window.clearTimeout(retry); };
  }, [contextTabLabel, isTauriAvailable, note.id]);
  const contextFullAppLabel = /^(code|code - insiders)(\.exe)?$/i.test(target?.process_name || note.target_process_name || '')
    ? 'Visual Studio Code' : contextTabLabel;

  useEffect(() => {
    setText(saveController.getSnapshot().draft);
    setSaveSnapshot(saveController.getSnapshot());
    setComposerError(null);
    setRichSaveFailed(false);
    setRichDraftPending(false);
    setRichReadFailed(false);
    setDiagnosticsPath(null);
    setActivePanel(null);
    setDrawingEnabled(false);
    temporaryToolSurface.current = null;
    setAttachmentCount(0);
    setInlineAttachments([]);
    clipboardReservation.current = null;
    setPastedFilesRequest(null);
    setRichTextHtml(plainTextToRichHtml(saveController.getSnapshot().draft));
    sessionSnapshot.current = null;
    setCancelConfirmationOpen(false);
    setDiscardRecovery(null);
    nativeTransitionRequest.current = null;
    setNativeTransitionBusy(false);
    if (nativeTransitionTimer.current) clearTimeout(nativeTransitionTimer.current);
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
    setHasScheduledReminder(false);
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

  useEffect(() => { saveController.activate(); return () => saveController.suspend(); }, [saveController]);

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
    if (!isTauriAvailable) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ requestId: string; reason: 'shortcut' | 'quit' | 'close'; noteId: string }>('skribly://prepare-native-transition', async ({ payload }) => {
      if (disposed || payload.noteId !== note.id || nativeTransitionRequest.current) return;
      richTextEditorRef.current?.flush();
      nativeTransitionRequest.current = payload.requestId;
      setNativeTransitionBusy(true);
      let saved = false;
      try {
        const ink = inkPersistenceStateRef.current;
        if (!discardRecovery && !operationInProgress.current && richOperationsInProgress.current.size === 0 && !ink.hasUnsavedChanges && ink.status !== 'saving' &&
          !toolTransitionInProgress.current && !resizeInProgress.current) {
          richTextEditorRef.current?.flush();
          saved = await flushRichText() && await saveController.flush();
          saved = saved && currentNoteId.current === note.id && !inkPersistenceStateRef.current.hasUnsavedChanges &&
            inkPersistenceStateRef.current.status !== 'saving' && richOperationsInProgress.current.size === 0;
        }
      } catch { /* Keep the editor visible; native rejects the transition. */ }
      if (!saved) { nativeTransitionRequest.current = null; setNativeTransitionBusy(false); }
      else nativeTransitionTimer.current = setTimeout(() => {
        if (nativeTransitionRequest.current === payload.requestId) { nativeTransitionRequest.current = null; setNativeTransitionBusy(false); }
      }, 7500);
      await invoke('acknowledge_native_transition', { requestId: payload.requestId, saved,
        error: saved ? null : 'Your current note is not safely saved. Keep it open and retry saving.' }).catch(() => undefined);
    }).then((dispose) => { if (disposed) dispose(); else unlisten = dispose; }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, [discardRecovery, flushRichText, isTauriAvailable, note.id, saveController]);

  useEffect(() => {
    if (!isTauriAvailable) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ requestId: string; noteId: string; completed: boolean }>('skribly://native-transition-finished', ({ payload }) => {
      if (payload.noteId !== note.id || nativeTransitionRequest.current !== payload.requestId) return;
      nativeTransitionRequest.current = null;
      if (nativeTransitionTimer.current) clearTimeout(nativeTransitionTimer.current);
      setNativeTransitionBusy(false);
    }).then((dispose) => { if (disposed) dispose(); else unlisten = dispose; }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); if (nativeTransitionTimer.current) clearTimeout(nativeTransitionTimer.current); };
  }, [isTauriAvailable, note.id]);

  useEffect(() => {
    let cancelled = false;
    setIsInkLoading(true);
    setRichReadFailed(false);
    void Promise.all([getInkForNote(sessionInitial.noteId), getRichContent(sessionInitial.noteId), listReminders()])
      .then(([document, richContent, reminders]) => {
        if (!cancelled) {
          const recovery = richContent.discardRecovery;
          if (recovery) {
            setDiscardRecovery(recovery);
            setComposerError("A previous discard was interrupted. Your kept edits and original note are retained locally. Restore kept edits before continuing.");
            setRichTextHtml(recovery.current.rich.richText?.html ?? plainTextToRichHtml(recovery.current.text));
            setText(recovery.current.text);
            setInlineAttachments(recovery.current.rich.attachments);
            setInkStrokes(recovery.current.rich.inkDocument?.strokes ?? []);
            setTextSize(recovery.current.rich.view?.textSize ?? 'medium');
            sessionSnapshot.current = recovery.baseline;
            return;
          }
          sessionSnapshot.current = {
            text: sessionInitial.text, color: sessionInitial.color, rich: richContent,
            reminders: reminders.filter((item) => item.noteId === sessionInitial.noteId).map(({ status: _status, ...item }) => item),
          };
          setHasScheduledReminder(reminders.some((item) => item.noteId === sessionInitial.noteId &&
            (item.status === 'upcoming' || item.status === 'overdue')));
          setInkStrokes(document.strokes);
          setTextSize(richContent.view?.textSize ?? 'medium');
          setAttachmentCount(richContent.attachments.length);
          setRichTextHtml(
            richContent.richText?.plainText === sessionInitial.text
              ? richContent.richText.html
              : plainTextToRichHtml(sessionInitial.text)
          );
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setRichReadFailed(true);
          setComposerError(
            `Skribli could not read this note content: ${reason instanceof Error ? reason.message : String(reason)}`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsInkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionInitial, richLoadRevision]);

  useEffect(() => {
    if (!isTauriAvailable) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ noteId: string }>('skribly://reminders-updated', ({ payload }) => {
      if (payload.noteId !== note.id) return;
      void listReminders().then((reminders) => {
        if (!disposed) setHasScheduledReminder(reminders.some((item) => item.noteId === note.id &&
          (item.status === 'upcoming' || item.status === 'overdue')));
      }).catch(() => undefined);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, [isTauriAvailable, note.id]);

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
      hasMeaningfulRichText(richContent.richText, richContent.attachments.map((item) => item.id)) ||
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

  const restoreSessionOperations = useCallback(() => ({
    restoreRich: (snapshot: NoteSessionSnapshot) => restoreRichContentForNote(note.id, snapshot.rich),
    restoreReminders: (snapshot: NoteSessionSnapshot) => restoreRemindersForNote(note.id, snapshot.reminders),
    restoreColor: async (snapshot: NoteSessionSnapshot) => {
      if (!await updateSkribColor(note.id, snapshot.color)) throw new Error('The paper color could not be restored.');
    },
    restoreText: async (snapshot: NoteSessionSnapshot) => {
      if (!await persistSkribText(note.id, snapshot.text)) throw new Error('The note text could not be restored.');
    },
  }), [note.id, updateSkribColor]);

  const recoverKeptEdits = useCallback(async () => {
    if (!discardRecovery || !storageWritable || !licenceAllowsWrite) return;
    await runExclusive(async () => {
      try {
        await restoreNoteSession(discardRecovery.current, restoreSessionOperations());
        await clearDiscardRecoveryForNote(note.id);
        stageSkribDraft(note.id, discardRecovery.current.text);
        saveController.adoptRestoredText(discardRecovery.current.text);
        setDiscardRecovery(null);
        setComposerError(null);
        setRichTextHtml(discardRecovery.current.rich.richText?.html ?? plainTextToRichHtml(discardRecovery.current.text));
        setInlineAttachments(discardRecovery.current.rich.attachments);
        setAttachmentRefresh((revision) => revision + 1);
        void emit('skribly://rich-content-updated', { noteId: note.id }).catch(() => undefined);
        void emit('skribly://reminders-updated', { noteId: note.id }).catch(() => undefined);
      } catch (reason) {
        setComposerError(`Your kept edits are still retained. Restore could not finish: ${reason instanceof Error ? reason.message : String(reason)}`);
      }
    });
  }, [discardRecovery, licenceAllowsWrite, note.id, restoreSessionOperations, runExclusive, saveController, storageWritable]);

  const discardSessionAndClose = useCallback(async () => {
    const baseline = sessionSnapshot.current;
    if (!baseline || !canWrite || richOperationsInProgress.current.size > 0 ||
      inkPersistenceStateRef.current.hasUnsavedChanges || inkPersistenceStateRef.current.status === 'saving') {
      setComposerError('Wait for this note to finish loading or saving before discarding edits.');
      return;
    }
    await runExclusive(async () => {
      richTextEditorRef.current?.flush();
      if (!await flushRichText()) return;
      const currentDraft = saveController.getSnapshot().draft;
      await saveController.prepareForDelete();
      richSaveController.suspend();
      let recovery: NoteDiscardRecovery | null = null;
      try {
        const [stored, reminders] = await Promise.all([getRichContent(note.id), listReminders()]);
        const { discardRecovery: _journal, ...rich } = stored;
        recovery = { version: 1, baseline, current: { text: currentDraft, color: note.color, rich,
          reminders: reminders.filter((item) => item.noteId === note.id).map(({ status: _status, ...item }) => item) } };
        const result = await discardWithRecovery(recovery, {
          ...restoreSessionOperations(),
          retain: (journal) => retainDiscardRecoveryForNote(note.id, journal),
          clear: () => clearDiscardRecoveryForNote(note.id),
          finish: async () => {
            if (openAction === 'created') {
              if (!await discardEmptySkrib(note.id)) throw new Error('The new note could not be discarded safely.');
            } else if (openAction !== 'detached' && !await setSkribCollapsed(note.id, true)) {
              throw new Error('The note could not close safely.');
            }
          },
        });
        void emit('skribly://rich-content-updated', { noteId: note.id }).catch(() => undefined);
        void emit('skribly://reminders-updated', { noteId: note.id }).catch(() => undefined);
        if (result.discarded) {
          discardSkribDraft(note.id);
          saveController.adoptRestoredText(baseline.text);
          setRichTextHtml(baseline.rich.richText?.html ?? plainTextToRichHtml(baseline.text));
          setInlineAttachments(baseline.rich.attachments);
          setAttachmentRefresh((revision) => revision + 1);
          setInkStrokes(baseline.rich.inkDocument?.strokes ?? []);
          setTextSize(baseline.rich.view?.textSize ?? 'medium');
          if (result.closed) await hideWindow();
          else {
            richSaveController.activate();
            setCancelConfirmationOpen(false);
            setComposerError('Your changes were discarded and the original note is saved. Closing did not finish; use Done to try again.');
          }
          return;
        }
        if (!result.recovered) setDiscardRecovery(recovery);
        throw result.error;
      } catch (reason) {
        stageSkribDraft(note.id, currentDraft);
        saveController.resumeAfterDeleteFailure('Discard did not finish. Your kept edits are retained; retry or save the note.');
        richSaveController.activate();
        setComposerError(`Discard did not finish: ${reason instanceof Error ? reason.message : String(reason)}`);
      }
    });
  }, [canWrite, discardEmptySkrib, flushRichText, hideWindow, note.color, note.id, openAction, richSaveController,
    restoreSessionOperations, runExclusive, saveController, setSkribCollapsed]);

  const cancelDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'cancel'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && cancelConfirmationOpen) {
        event.preventDefault();
        setCancelConfirmationOpen(false);
        closeButtonRef.current?.focus();
        return;
      }
      if (cancelConfirmationOpen) return;
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
    if (nativeTransitionRequest.current) return false;
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
    richTextEditorRef.current?.flush();
    const [saved, richSaved] = await Promise.all([saveController.retry(), flushRichText()]);
    if (!saved || !richSaved) {
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

  const resizeByKeyboard = async (key: string, largeStep: boolean) => {
    if (!canWrite || isFinishing || resizeInProgress.current || toolTransitionInProgress.current || hasPendingRichOperation || hasUnsavedInk) return;
    resizeInProgress.current = true;
    setIsResizing(true);
    try {
      const physical = isTauriAvailable ? await getCurrentWindow().innerSize() : null;
      const scale = isTauriAvailable ? await getCurrentWindow().scaleFactor() : 1;
      const width = physical ? physical.width / scale : note.width;
      const height = physical ? physical.height / scale : note.height;
      const step = largeStep ? 32 : 8;
      const next = { width: Math.max(320, Math.min(820, width + (key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0))),
        height: Math.max(260, Math.min(760, height + (key === 'ArrowDown' ? step : key === 'ArrowUp' ? -step : 0))) };
      if (isTauriAvailable) await invoke('set_skrib_window_dimensions', { noteId: note.id, ...next, temporary: false });
      else {
        useSkribStore.setState((state) => ({ skribs: state.skribs.map((item) => item.id === note.id ? { ...item, ...next } : item) }));
      }
      temporaryToolSurface.current = null;
      setSurfaceSize(next.width >= 680 ? 'large' : next.width >= 500 ? 'medium' : 'compact');
    } catch (reason) {
      setComposerError(`Skribli could not resize: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally { resizeInProgress.current = false; setIsResizing(false); }
  };

  const handleColorChange = async (color: (typeof NOTE_COLORS)[number]) => {
    if (!canWrite || color === note.color) {
      setColorPickerOpen(false);
      return;
    }
    try {
      if (!await updateSkribColor(note.id, color)) throw new Error('The paper color could not be saved.');
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

      richTextEditorRef.current?.flush();
      if (!await flushRichText() || !await saveController.flush()) {
        setDeleteConfirmation((state) => reduceDeleteConfirmation(state, 'delete-failed'));
        setComposerError('Your latest changes could not be saved, so the note stayed open and was not moved to Trash.');
        return;
      }
      await saveController.prepareForDelete();
      const movedToTrash = await trashSkrib(note.id);
      if (movedToTrash) {
        try {
          await cancelRemindersForTrashedNote(note.id);
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

  const handleArchiveNote = async () => {
    await runExclusive(async () => {
      if (!canWrite) {
        setComposerError(storageErrorMessage || licenseStatus.message || 'This build is currently read-only.');
        return;
      }
      richTextEditorRef.current?.flush();
      if (!await flushRichText()) return;
      if (inkPersistenceStateRef.current.hasUnsavedChanges || richOperationsInProgress.current.size > 0) {
        setComposerError('Skribli is still saving this note. Wait a moment before archiving it.');
        return;
      }
      if (!await saveController.flush()) {
        setComposerError('The note could not be saved safely, so it was not archived.');
        return;
      }
      if (!await archiveSkrib(note.id)) {
        setComposerError('Skribli could not move this note to Archive. It remains active.');
        return;
      }
      try {
        await completeRemindersForArchivedNote(note.id);
        void emit('skribly://reminders-updated', { noteId: note.id }).catch(() => undefined);
      } catch {
        // The note is already safely archived; reminder refresh can retry later.
      }
      discardSkribDraft(note.id);
      await hideWindow();
    });
  };

  const recoveryDirectory = storageNotice?.backupDirectory || storageBackupDirectory;
  const visibleError =
    composerError || inkPersistenceState.error || saveSnapshot.error || storageErrorMessage;
  const saveLabel = richSaveFailed ? 'Save failed' : richDraftPending && richOperationCount === 0 ? 'Unsaved formatting' : saveStatusLabel(saveSnapshot);
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
        <NotePlaceHeader
          contextTabRef={contextTabRef}
          contextLabel={contextLabel}
          contextFullAppLabel={contextFullAppLabel}
          appIconUrl={appIconUrl}
          isNewNote={isNewNote}
          placeDetailOpen={placeDetailOpen}
          onPlaceDetailOpen={setPlaceDetailOpen}
        />
        <div className="composer-side-tools" data-pinned={noteMenuOpen || colorPickerOpen || undefined}>
          <button type="button" className="composer-quick-color" ref={paletteButtonRef}
            aria-label="Paper colour" aria-expanded={colorPickerOpen} aria-controls="composer-paper-palette"
            title="Paper colour" disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}
            onClick={() => {
              setColorPickerOpen((open) => !open);
              setNoteMenuOpen(false);
              setToolGatewayOpen(false);
            }}>
            <span className="composer-paper-swatch" aria-hidden="true" />
          </button>
          <button type="button" className="composer-quick-reminder"
            data-scheduled={hasScheduledReminder || undefined}
            aria-label={hasScheduledReminder ? 'Edit reminder' : 'Set a reminder'}
            aria-expanded={activePanel === 'reminder'} aria-controls="composer-reminder-panel"
            title={hasScheduledReminder ? 'Edit reminder' : 'Set a reminder'}
            disabled={!canWrite || isFinishing || hasPendingRichOperation}
            onClick={() => {
              setNoteMenuOpen(false);
              setToolGatewayOpen(false);
              setColorPickerOpen(false);
              void openRoomyTool('reminder');
            }}>
            <Bell size={18} aria-hidden="true" />
          </button>
          <button type="button" className="composer-cancel-session" ref={closeButtonRef} aria-label="Close note options"
            title="Close note" onClick={() => {
              setNoteMenuOpen(false);
              setToolGatewayOpen(false);
              setColorPickerOpen(false);
              setCancelConfirmationOpen(true);
            }}
            disabled={!canWrite || isFinishing || isInkLoading || !sessionSnapshot.current || hasPendingRichOperation || hasUnsavedInk || deleteConfirmation === 'confirming'}>
            <X size={18} aria-hidden="true" />
          </button>
          <button type="button" className="composer-more" ref={moreButtonRef}
            aria-controls="composer-note-options" aria-label="More note actions"
            aria-expanded={noteMenuOpen} title="More note actions"
            onPointerDown={() => { moreOpenedByKeyboard.current = false; }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') moreOpenedByKeyboard.current = true;
            }}
            onClick={() => {
              setNoteMenuOpen((open) => !open);
              setToolGatewayOpen(false);
              setColorPickerOpen(false);
            }}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
          {menuVisible && (
            <div id="composer-note-options" className="composer-note-menu" role="toolbar" aria-label="Note actions">
              <span className="composer-note-menu-heading">Note options</span>
              <div className="composer-menu-text-size" role="group" aria-label="Text size">
                <Type size={17} aria-hidden="true" /><span>Text size</span>
                <div className="composer-size-options">
                  {NOTE_TEXT_SIZES.map((size) => (
                    <button key={size} type="button" aria-label={`${size} text`}
                      aria-pressed={textSize === size} title={`${size} text`}
                      disabled={!canWrite || isFinishing}
                      onClick={() => void changeTextSize(size)}>{size[0]!.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <button type="button" disabled={isResizing || isFinishing || hasPendingRichOperation || hasUnsavedInk}
                aria-label={surfaceSize === 'large' ? 'Restore note size' : 'Expand note'}
                onClick={() => void toggleExpandedSize()}>
                {surfaceSize === 'large' ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
                <span>{surfaceSize === 'large' ? 'Restore size' : 'Expand note'}</span>
              </button>
              {openAction !== 'detached' && <button type="button" aria-label="Return beside app"
                disabled={!isTauriAvailable || isRepositioning || isFinishing || hasPendingRichOperation}
                onClick={() => { setNoteMenuOpen(false); setColorPickerOpen(false); void handleReposition(); }}>
                {isRepositioning ? <span className="composer-button-spinner" aria-hidden="true" /> : <LocateFixed size={17} aria-hidden="true" />}
                <span>Return beside app</span>
              </button>}
              <>
                <span className="composer-note-menu-divider" aria-hidden="true" />
                <button type="button" aria-label="Move note to Archive"
                  disabled={!canWrite || isFinishing || hasPendingRichOperation || hasUnsavedInk}
                  onClick={() => { setNoteMenuOpen(false); setColorPickerOpen(false); void handleArchiveNote(); }}>
                  <Archive size={17} aria-hidden="true" /><span>Archive note</span>
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
            {richReadFailed && <button type="button" onClick={() => setRichLoadRevision((revision) => revision + 1)}>Retry reading note</button>}
            {discardRecovery && <button type="button" onClick={() => void recoverKeptEdits()} disabled={isFinishing || !storageWritable || !licenceAllowsWrite}>Restore kept edits</button>}
            {(saveSnapshot.status === 'failed' || richSaveFailed) && canWrite && (
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

        <div className="composer-mode-pill" role="group" aria-label="Note editing mode">
          <button type="button" aria-pressed={!drawingEnabled} disabled={!canWrite || isFinishing || isInkLoading || isResizing}
            onClick={() => { if (drawingEnabled) void openRoomyTool('draw'); }}><Type size={15} aria-hidden="true" /><span>Type</span></button>
          <button type="button" aria-pressed={drawingEnabled} disabled={!canWrite || isFinishing || isInkLoading || isResizing}
            onClick={() => { if (!drawingEnabled) void openRoomyTool('draw'); }}><PenLine size={15} aria-hidden="true" /><span>Draw</span></button>
        </div>

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
            <Plus size={18} aria-hidden="true" />
          </button>
          {toolGatewayOpen && (
            <div id="composer-add-options" className="composer-intent-tray" role="group" aria-label="Skrib tools">
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

        <div className="composer-unified-workspace">
          <div
            className={`composer-unified-canvas ${drawingEnabled ? 'drawing' : 'typing'}`}
            data-text-size={textSize}
          >
            <RichTextEditor
              ref={richTextEditorRef}
              noteId={note.id}
              initialHtml={richTextHtml}
              attachments={inlineAttachments}
              disabled={!canWrite || isInkLoading || isFinishing || cancelConfirmationOpen}
              drawingEnabled={drawingEnabled}
              describedBy={textareaDescription}
              onChange={handleRichTextChange}
              onPasteBlocked={reportBlockedPaste}
              onPasteFiles={(files) => {
                if (!canWrite || operationInProgress.current || nativeTransitionRequest.current || clipboardReservation.current ||
                  cancelConfirmationOpen || drawingEnabled || isInkLoading) { reportBlockedPaste(); return; }
                const request = { id: ++clipboardRequestSequence.current, noteId: note.id, files };
                clipboardReservation.current = request;
                // Reserve before React queues the child effect: native/discard barriers see it immediately.
                setRichOperationBusy('clipboard', true);
                setPastedFilesRequest(request);
              }}
              onRequestDraw={canWrite && !isFinishing ? () => void openRoomyTool('draw') : undefined}
              onRequestReminder={canWrite && !isFinishing ? () => void openRoomyTool('reminder') : undefined}
              onRequestAttachment={canWrite && !isFinishing && !hasPendingRichOperation
                ? () => setAttachmentPickerRequest((request) => request + 1) : undefined}
              onBlur={() => {
                if (!canWrite || operationInProgress.current || cancelConfirmationOpen) return;
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
            refreshRequest={attachmentRefresh}
            compact
            pickerRequest={attachmentPickerRequest}
            openDrawerRequest={attachmentDrawerRequest}
            filesRequest={pastedFilesRequest}
            onFilesRequestSettled={settleClipboardRequest}
            disabled={!canWrite || isInkLoading || isFinishing || drawingEnabled || deleteConfirmation === 'confirming'}
            onError={setComposerError}
            onBusyChange={handleAttachmentsBusy}
            onCountChange={setAttachmentCount}
            onAttachmentsChange={setInlineAttachments}
            onPlaceInline={(items) => currentNoteId.current === note.id && (richTextEditorRef.current?.insertAttachments(items) ?? false)}
            onRemoved={(id) => richTextEditorRef.current?.removeAttachment(id)}
          />

          <span className="sr-only" aria-live="polite">
            {attachmentCount.toLocaleString()} attached files
          </span>
        </div>

        {activePanel === 'reminder' && (
          <div id="composer-reminder-panel" className="composer-inline-panel composer-reminder-window" role="dialog" aria-label="Set a reminder" aria-modal="false">
            <button className="composer-panel-close" type="button" title="Close reminder window" aria-label="Close reminder window" onClick={() => void openRoomyTool('reminder')} disabled={hasPendingRichOperation || isResizing}><X size={16} /></button>
            <NoteReminderPanel
              noteId={note.id}
              noteText={text}
              disabled={!canWrite || isFinishing || deleteConfirmation === 'confirming'}
              onError={setComposerError}
              onBusyChange={handleReminderBusy}
            />
          </div>
        )}

        <NoteSaveIndicator
          snapshot={{ ...saveSnapshot, status: richSaveFailed ? 'failed' : hasPendingRichOperation ? 'saving' : richDraftPending ? 'dirty' : saveSnapshot.status }}
          showSavedPulse={showSavedPulse}
          saveLabel={saveLabel}
          saveDetail={saveDetail}
        />

        <NoteDeleteConfirmation
          visible={deleteConfirmation === 'confirming'}
          isFinishing={isFinishing}
          hasPendingRichOperation={hasPendingRichOperation}
          hasUnsavedInk={hasUnsavedInk}
          onCancel={cancelDeleteConfirmation}
          onConfirm={() => void handleDelete()}
        />

        <NoteCloseConfirmation
          visible={cancelConfirmationOpen}
          created={openAction === 'created'}
          isFinishing={isFinishing}
          isRepositioning={isRepositioning}
          hasPendingRichOperation={hasPendingRichOperation}
          hasUnsavedInk={hasUnsavedInk}
          storageWritable={storageWritable}
          onKeepEditing={() => {
            setCancelConfirmationOpen(false);
            closeButtonRef.current?.focus();
          }}
          onSaveAndClose={() => {
            setCancelConfirmationOpen(false);
            void finishAndHide();
          }}
          onDiscardAndClose={() => {
            setCancelConfirmationOpen(false);
            void discardSessionAndClose();
          }}
        />
        <NoteWindowControls
          storageWritable={storageWritable}
          detached={openAction === 'detached'}
          isFinishing={isFinishing}
          isRepositioning={isRepositioning}
          hasPendingRichOperation={hasPendingRichOperation}
          hasUnsavedInk={hasUnsavedInk}
          deleteConfirming={deleteConfirmation === 'confirming'}
          cancelConfirmationOpen={cancelConfirmationOpen}
          onFinish={() => void finishAndHide()}
          onResize={(direction) => void startManualResize(direction)}
          onKeyboardResize={(key, largeStep) => void resizeByKeyboard(key, largeStep)}
        />
      </section>
    </div>
  );
};
