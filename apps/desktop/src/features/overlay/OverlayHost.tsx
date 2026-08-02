import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import React, { useEffect, useRef, useState } from 'react';
import '../../styles/storage-recovery.css';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import { selectPrimaryWindowSurface } from '../onboarding/guidanceSurface';
import {
  completeOnboarding,
  markOnboardingShown,
  readOnboardingStatus,
  shouldAutoShowOnboarding,
} from '../onboarding/onboardingState';
import { OnboardingSurface } from '../onboarding/OnboardingSurface';
import { StartupFailureSurface } from '../onboarding/StartupFailureSurface';
import { SkribComposer } from '../skribs/SkribComposer';
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
  } = useSkribStore();
  const { composerNoteId, openComposer } = useSkribUiStore();
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<TargetCaptureErrorPayload | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  const initialSnapshotTakenRef = useRef(false);
  const knownNoteIdsRef = useRef<Set<string>>(new Set());
  const onboardingDecisionTakenRef = useRef(false);

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
    onboardingVisible,
  });

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
      listen('skribly://show-onboarding', () => {
        if (!disposed) {
          setOnboardingVisible(true);
          void showCurrentWindow().catch(() => undefined);
        }
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

  useEffect(() => {
    if (composerNote) setOnboardingVisible(false);
  }, [composerNote]);

  useEffect(() => {
    if (initStatus.type === 'Failed' && storageSurface === 'empty') {
      void showCurrentWindow().catch(() => undefined);
    }
  }, [initStatus.type, storageSurface]);

  useEffect(() => {
    if (onboardingDecisionTakenRef.current) return;
    if (initStatus.type !== 'Ready' || storageSurface !== 'empty' || captureError) return;
    if (typeof window === 'undefined') return;

    onboardingDecisionTakenRef.current = true;
    const status = readOnboardingStatus(window.localStorage);
    if (!shouldAutoShowOnboarding(status)) return;

    setOnboardingVisible(true);
    void showCurrentWindow()
      .then(() => {
        markOnboardingShown(window.localStorage);
      })
      .catch(() => {
        onboardingDecisionTakenRef.current = false;
        setOnboardingVisible(false);
      });
  }, [captureError, initStatus.type, storageSurface]);

  const completeFirstRun = async () => {
    if (typeof window !== 'undefined') completeOnboarding(window.localStorage);
    setOnboardingVisible(false);
    try {
      await hideCurrentWindow();
    } catch {
      // The application may already be shutting down.
    }
  };

  const dismissFirstRun = async () => {
    if (typeof window !== 'undefined') markOnboardingShown(window.localStorage);
    setOnboardingVisible(false);
    try {
      await hideCurrentWindow();
    } catch {
      // The application may already be shutting down.
    }
  };

  if (primarySurface === 'composer' && composerNote) {
    return <SkribComposer note={composerNote} target={activeTarget} />;
  }

  if (primarySurface === 'recovery') {
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
              <button type="button" className="secondary" onClick={dismissStorageNotice}>
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
        onRetry={() => void retryOverlayInit()}
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

  if (primarySurface === 'onboarding') {
    return (
      <OnboardingSurface
        onComplete={() => void completeFirstRun()}
        onDismiss={() => void dismissFirstRun()}
      />
    );
  }

  return null;
};
