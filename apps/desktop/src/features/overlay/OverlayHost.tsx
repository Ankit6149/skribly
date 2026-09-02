import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import React, { useEffect, useState } from 'react';
import '../../styles/storage-recovery.css';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import { selectPrimaryWindowSurface } from '../onboarding/guidanceSurface';
import { StartupFailureSurface } from '../onboarding/StartupFailureSurface';
import {
  isOpenNoteRequest,
  selectRequestedNote,
  type OpenNoteAction,
  type OpenNoteRequest,
} from '../skribs/noteLifecycle';
import { CollapsedSkribDot } from '../skribs/CollapsedSkribDot';
import { SkribComposer } from '../skribs/SkribComposer';
import { hideOverlayThen } from './overlayWindowLifecycle';
import { selectStorageSurface } from './storageSurface';
import type { TargetCaptureErrorPayload } from './targetCaptureError';
import { TargetCaptureErrorSurface } from './TargetCaptureErrorSurface';

async function showCurrentWindow(): Promise<void> {
  const currentWindow = getCurrentWindow();
  await currentWindow.center();
  await currentWindow.show();
  await currentWindow.setFocus();
}

async function hideCurrentWindow(): Promise<void> {
  await getCurrentWindow().hide();
}

export const OverlayHost: React.FC = () => {
  const {
    activeTarget,
    skribs,
    initStatus,
    initTauri,
    retryOverlayInit,
    storageNotice,
    storageErrorMessage,
    storageWritable,
    storageBackupDirectory,
    dismissStorageNotice,
    exportStorageDiagnostics,
    isTauriAvailable,
  } = useSkribStore();
  const { composerNoteId, openComposer } = useSkribUiStore();
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<TargetCaptureErrorPayload | null>(null);
  const [openNoteRequest, setOpenNoteRequest] = useState<OpenNoteRequest | null>(null);
  const [composerOpenAction, setComposerOpenAction] = useState<OpenNoteAction>('reopened');

  const composerNote = composerNoteId
    ? skribs.find((note) => note.id === composerNoteId) ?? null
    : null;

  const storageSurface = selectStorageSurface({
    hasComposerNote: composerNote !== null,
    storageWritable,
    hasStorageError: Boolean(storageErrorMessage),
    hasStorageNotice: Boolean(storageNotice),
  });

  const primarySurface = selectPrimaryWindowSurface({
    storageSurface,
    initStatus,
    hasCaptureError: captureError !== null,
    onboardingVisible: false,
  });

  useEffect(() => {
    let disposed = false;
    const unlistenCallbacks: Array<() => void> = [];

    void Promise.all([
      listen<TargetCaptureErrorPayload>('skribly://target-capture-error', (event) => {
        if (!disposed) {
          setOpenNoteRequest(null);
          setCaptureError(event.payload);
        }
      }),
      listen<unknown>('skribly://open-note-request', (event) => {
        if (!disposed && isOpenNoteRequest(event.payload)) {
          setOpenNoteRequest(event.payload);
        }
      }),
    ]).then((callbacks) => {
      if (disposed) {
        callbacks.forEach((unlisten) => unlisten());
      } else {
        unlistenCallbacks.push(...callbacks);
        void initTauri()
          .then(async () => {
            const pending = await invoke<unknown>('get_pending_open_note_request');
            if (!disposed && isOpenNoteRequest(pending)) {
              setOpenNoteRequest(pending);
            }
          })
          .catch(() => undefined);
      }
    });

    return () => {
      disposed = true;
      unlistenCallbacks.forEach((unlisten) => unlisten());
    };
  }, [initTauri]);

  useEffect(() => {
    const requestedNote = selectRequestedNote(openNoteRequest, skribs);
    if (!requestedNote || !openNoteRequest) return;

    // The native clear event arrives before this request. Keep the recovery surface mounted
    // until the replacement composer is ready so the transparent overlay never renders empty.
    const request = openNoteRequest;
    setComposerOpenAction(request.action);
    setCaptureError(null);
    openComposer(requestedNote.id, 'type');
    setOpenNoteRequest(null);
    void invoke('acknowledge_open_note_request', { noteId: request.noteId }).catch(
      () => undefined
    );
  }, [openComposer, openNoteRequest, skribs]);

  useEffect(() => {
    if (initStatus.type === 'Failed' && storageSurface === 'empty') {
      void showCurrentWindow().catch(() => undefined);
    }
  }, [initStatus.type, storageSurface]);

  useEffect(() => {
    if (!composerNoteId || !isTauriAvailable || composerOpenAction === 'detached') return;

    let disposed = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;
    void getCurrentWindow()
      .onMoved(() => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          if (!disposed) {
            void useSkribStore.getState().saveSkribWindowPosition(composerNoteId);
          }
        }, 180);
      })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (saveTimer) clearTimeout(saveTimer);
      unlisten?.();
    };
  }, [composerNoteId, composerOpenAction, isTauriAvailable]);

  if (primarySurface === 'composer' && composerNote) {
    if (composerNote.collapsed) {
      return <CollapsedSkribDot note={composerNote} />;
    }
    return (
      <SkribComposer
        note={composerNote}
        target={activeTarget}
        openAction={composerOpenAction}
      />
    );
  }

  if (primarySurface === 'recovery') {
    const recoveryDirectory = storageNotice?.backupDirectory || storageBackupDirectory;
    const message =
      storageErrorMessage ||
      storageNotice?.message ||
      'Local Skrib storage needs attention before Skribli can create another Skrib.';
    const title =
      storageWritable && !storageErrorMessage
        ? 'Local notes recovered'
        : 'Local notes need recovery';

    const saveDiagnostics = async () => {
      const output = await exportStorageDiagnostics();
      if (output) setDiagnosticsPath(output);
    };

    return (
      <div className="storage-recovery-backdrop">
        <section
          className="storage-recovery-panel"
          role={storageErrorMessage ? 'alert' : 'status'}
          aria-labelledby="storage-recovery-title"
        >
          <header className="storage-recovery-header" data-tauri-drag-region>
            <div data-tauri-drag-region>
              <span className="storage-recovery-kicker" data-tauri-drag-region>
                SKRIBLI STORAGE
              </span>
              <h1 id="storage-recovery-title" data-tauri-drag-region>
                {title}
              </h1>
            </div>
            <button
              type="button"
              className="storage-recovery-close"
              onClick={() => void hideCurrentWindow().catch(() => undefined)}
              aria-label="Hide storage recovery"
              title="Hide"
            >
              ✕
            </button>
          </header>

          <div className="storage-recovery-body">
            <p>{message}</p>
            {!storageWritable && (
              <p className="storage-recovery-protection">
                Skribli has blocked writes so the existing recovery files cannot be overwritten.
              </p>
            )}
            {recoveryDirectory && (
              <div className="storage-recovery-path">
                <span>Recovery folder</span>
                <code>{recoveryDirectory}</code>
              </div>
            )}
            {diagnosticsPath && (
              <div className="storage-recovery-path">
                <span>Diagnostics saved</span>
                <code>{diagnosticsPath}</code>
              </div>
            )}
          </div>

          <footer className="storage-recovery-footer">
            {storageNotice && storageWritable && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void hideOverlayThen(hideCurrentWindow, dismissStorageNotice).catch(
                    () => undefined
                  )
                }
              >
                Dismiss notice
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => void hideCurrentWindow().catch(() => undefined)}
            >
              Hide
            </button>
            <button type="button" className="primary" onClick={() => void saveDiagnostics()}>
              Save safe diagnostics
            </button>
          </footer>
        </section>
      </div>
    );
  }

  if (primarySurface === 'startupFailure') {
    return (
      <StartupFailureSurface
        message={initStatus.type === 'Failed' ? initStatus.payload : 'Native setup failed.'}
        onRetry={() =>
          void retryOverlayInit()
            .then(() => {
              if (useSkribStore.getState().initStatus.type !== 'Failed') {
                return hideCurrentWindow();
              }
            })
            .catch(() => undefined)
        }
        onHide={() => void hideCurrentWindow().catch(() => undefined)}
      />
    );
  }

  if (primarySurface === 'captureError' && captureError) {
    return (
      <TargetCaptureErrorSurface
        error={captureError}
        onDismiss={() => setCaptureError(null)}
      />
    );
  }

  return (
    <div
      className="overlay-preparing-surface"
      data-overlay-surface="preparing"
      role="status"
      aria-live="polite"
      aria-label="Skribli is preparing your note"
    >
      <section className="overlay-preparing-note" data-tauri-drag-region>
        <span className="overlay-preparing-mark" aria-hidden="true" data-tauri-drag-region>
          <span />
        </span>
        <span className="overlay-preparing-copy" data-tauri-drag-region>
          <strong data-tauri-drag-region>Opening Skribli</strong>
          <small data-tauri-drag-region>
            <span className="overlay-preparing-pulse" aria-hidden="true" />
            Getting your note ready…
          </small>
        </span>
      </section>
    </div>
  );
};
