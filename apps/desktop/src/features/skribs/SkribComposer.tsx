import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import { useLicenseStore } from '../../stores/licenseStore';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';

interface SkribComposerProps {
  note: SkribNote;
  target: TargetWindowInfo | null;
}

export const SkribComposer: React.FC<SkribComposerProps> = ({ note, target }) => {
  const {
    updateSkribText,
    deleteSkrib,
    storageErrorMessage,
    storageNotice,
    storageWritable,
    storageBackupDirectory,
    dismissStorageNotice,
    exportStorageDiagnostics,
  } = useSkribStore();
  const licenseStatus = useLicenseStore((state) => state.status);
  const canWrite =
    storageWritable && (!licenseStatus.enforcementEnabled || licenseStatus.canWrite);
  const { closeComposer } = useSkribUiStore();
  const [text, setText] = useState(note.text);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const textSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contextLabel = useMemo(() => {
    if (!target) return note.target_title || note.target_process_name || 'Current application';
    return target.title || target.process_name;
  }, [note.target_process_name, note.target_title, target]);

  useEffect(() => {
    setText(note.text);
  }, [note.id, note.text]);

  useEffect(() => {
    return () => {
      if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    };
  }, []);

  const hideWindow = async () => {
    closeComposer();
    await getCurrentWindow().hide();
  };

  const saveTextNow = async (): Promise<boolean> => {
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = null;
    if (!canWrite) return false;
    if (text === note.text) return true;
    return updateSkribText(note.id, text);
  };

  const finishAndHide = async () => {
    if (!canWrite) {
      await hideWindow();
      return;
    }

    if (text.trim().length === 0) {
      const deleted = await deleteSkrib(note.id);
      if (deleted) {
        await hideWindow();
      } else {
        setComposerError('The empty note could not be removed safely. Skribli kept the editor open.');
      }
      return;
    }

    const saved = await saveTextNow();
    if (saved) {
      await hideWindow();
    } else {
      setComposerError('The note could not be saved safely. Skribli kept the editor open so the text is not lost.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      void finishAndHide();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleTextChange = (value: string) => {
    if (!canWrite) {
      setComposerError(storageErrorMessage || licenseStatus.message || 'This build is currently read-only.');
      return;
    }

    setText(value);
    setComposerError(null);
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = setTimeout(() => {
      void updateSkribText(note.id, value).then((saved) => {
        if (!saved) {
          setComposerError('The latest text is not saved. Keep this window open and retry.');
        }
      });
    }, 350);
  };

  const handleExportDiagnostics = async () => {
    const output = await exportStorageDiagnostics();
    if (output) setDiagnosticsPath(output);
  };

  const handleDelete = async () => {
    if (!canWrite) return;
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    const deleted = await deleteSkrib(note.id);
    if (deleted) {
      await hideWindow();
    } else {
      setComposerError('The note could not be deleted safely. It remains available.');
    }
  };

  return (
    <div className="skrib-composer-backdrop">
      <section
        className={`skrib-composer skrib-color-${note.color}`}
        aria-label={canWrite ? 'Write an attached note' : 'View attached note'}
      >
        <header className="composer-header" data-tauri-drag-region>
          <div className="composer-context" data-tauri-drag-region>
            <span className="composer-kicker" data-tauri-drag-region>NOTE FOR</span>
            <strong data-tauri-drag-region>{contextLabel}</strong>
          </div>
          <button
            type="button"
            className="composer-close"
            onClick={() => void finishAndHide()}
            aria-label="Save and close Skribli"
            title="Save and close"
          >
            ✕
          </button>
        </header>

        {storageNotice && (
          <div className="composer-recovery" role="status">
            <span>{storageNotice.message}</span>
            <button type="button" onClick={dismissStorageNotice}>Dismiss</button>
          </div>
        )}

        {(composerError || storageErrorMessage) && (
          <div className="composer-error" role="alert">
            <span>{composerError || storageErrorMessage}</span>
            {storageBackupDirectory && (
              <small>Recovery folder: {storageBackupDirectory}</small>
            )}
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
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={() => void saveTextNow()}
        />

        <footer className="composer-footer">
          <div className="composer-status">
            <span>{composerError || storageErrorMessage ? 'Not saved' : 'Saved locally'}</span>
            <small>Esc closes</small>
          </div>
          <div className="composer-footer-actions">
            <button type="button" className="secondary danger" disabled={!canWrite} onClick={() => void handleDelete()}>
              Delete
            </button>
            <button type="button" className="primary" onClick={() => void finishAndHide()}>
              Done
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
