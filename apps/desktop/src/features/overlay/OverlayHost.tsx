import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import React, { useEffect, useRef, useState } from 'react';
import '../../styles/storage-recovery.css';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import { SkribComposer } from '../skribs/SkribComposer';
import { selectStorageSurface } from './storageSurface';
import type { TargetCaptureErrorPayload } from './targetCaptureError';
import { TargetCaptureErrorSurface } from './TargetCaptureErrorSurface';

export const OverlayHost: React.FC = () => {
  const {
    activeTarget,
    skribs,
    initStatus,
    initTauri,
    storageNotice,
    storageErrorMessage,
    storageWritable,
    storageBackupDirectory,
    dismissStorageNotice,
    exportStorageDiagnostics,
  } = useSkribStore();
  const { composerNoteId, openComposer } = useSkribUiStore();
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<TargetCaptureErrorPayload | null>(null);

  const initialSnapshotTakenRef = useRef(false);
  const knownNoteIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void initTauri();
  }, [initTauri]);

  useEffect(() => {
    let disposed = false;
    const unlistenCallbacks: Array<() => void> = [];

    void Promise.all([
      listen<TargetCaptureErrorPayload>('skribly://target-capture-error', (event) => {
        if (!disposed) setCaptureError(event.payload);
      }),
      listen('skribly://target-capture-clear', () => {
        if (!disposed) setCaptureError(null);
      }),
    ]).then((callbacks) => {
      if (disposed) {
        callbacks.forEach((unlisten) => unlisten());
      } else {
        unlistenCallbacks.push(...callbacks);
      }
    });

    return () => {
      disposed = true;
      unlistenCallbacks.forEach((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (initStatus.type === 'Initializing') return;

    if (!initialSnapshotTakenRef.current) {
      knownNoteIdsRef.current = new Set(skribs.map((note) => note.id));
      initialSnapshotTakenRef.current = true;
      return;
    }

    const created = skribs.find((note) => !knownNoteIdsRef.current.has(note.id));
    knownNoteIdsRef.current = new Set(skribs.map((note) => note.id));

    const noteToOpen = created ?? [...skribs].sort((a, b) => b.updated_at - a.updated_at)[0];
    if (noteToOpen) openComposer(noteToOpen.id, 'type');
  }, [initStatus.type, openComposer, skribs]);

  const composerNote = composerNoteId
    ? skribs.find((note) => note.id === composerNoteId) ?? null
    : null;

  const surface = selectStorageSurface({
    hasComposerNote: composerNote !== null,
    storageWritable,
    hasStorageError: Boolean(storageErrorMessage),
    hasStorageNotice: Boolean(storageNotice),
  });

  if (surface === 'composer' && composerNote) {
    return <SkribComposer note={composerNote} target={activeTarget} />;
  }

  if (surface === 'recovery') {
    const recoveryDirectory = storageNotice?.backupDirectory || storageBackupDirectory;
    const message =
      storageErrorMessage ||
      storageNotice?.message ||
      'Local note storage needs attention before Skribli can create another note.';
    const title =
      storageWritable && !storageErrorMessage
        ? 'Local notes recovered'
        : 'Local notes need recovery';

    const saveDiagnostics = async () => {
      const output = await exportStorageDiagnostics();
      if (output) setDiagnosticsPath(output);
    };

    const hideWindow = async () => {
      await getCurrentWindow().hide();
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
              onClick={() => void hideWindow()}
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
              <button type="button" className="secondary" onClick={dismissStorageNotice}>
                Dismiss notice
              </button>
            )}
            <button type="button" className="secondary" onClick={() => void hideWindow()}>
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

  if (captureError) {
    return (
      <TargetCaptureErrorSurface
        error={captureError}
        onDismiss={() => setCaptureError(null)}
      />
    );
  }

  return null;
};
