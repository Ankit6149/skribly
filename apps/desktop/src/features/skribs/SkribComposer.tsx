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
  const licenceAllowsWrite = !licenseStatus.enforcementEnabled || licenseStatus.canWrite;
  const canWrite = storageWritable && licenceAllowsWrite;
  const { closeComposer } = useSkribUiStore();
  const [text, setText] = useState(note.text);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const textSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef(note.text);
  const draftIsDirty = useRef(false);
  const activeNoteId = useRef(note.id);

  const contextLabel = useMemo(() => {
    if (!target) return note.target_title || note.target_process_name || 'Current application';
    return target.title || target.process_name;
  }, [note.target_process_name, note.target_title, target]);

  useEffect(() => {
    if (activeNoteId.current !== note.id) {
      activeNoteId.current = note.id;
      textRef.current = note.text;
      draftIsDirty.current = false;
      setText(note.text);
      setComposerError(null);
      setDiagnosticsPath(null);
      return;
    }

    if (!draftIsDirty.current) {
      textRef.current = note.text;
      setText(note.text);
    }
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

  const persistDraft = async (draft: string): Promise<boolean> => {
    const saved = await updateSkribText(note.id, draft);
    if (saved && textRef.current === draft) {
      draftIsDirty.current = false;
      setComposerError(null);
    }
    return saved;
  };

  const saveTextNow = async (): Promise<boolean> => {
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = null;

    if (!storageWritable) {
      setComposerError(
        'Local storage needs recovery. Skribli kept this draft open so it can be copied or retried.'
      );
      return false;
    }
    if (!licenceAllowsWrite) return false;
    if (!draftIsDirty.current) return true;

    const draft = textRef.current;
    if (draft === note.text) {
      draftIsDirty.current = false;
      return true;
    }
    return persistDraft(draft);
  };

  const finishAndHide = async () => {
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

    const currentDraft = textRef.current;
    if (currentDraft.trim().length === 0) {
      const deleted = await deleteSkrib(note.id);
      if (deleted) {
        draftIsDirty.current = false;
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
      setComposerError(
        'The note could not be saved safely. Skribli kept the editor open so the text is not lost.'
      );
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
      setComposerError(
        storageErrorMessage || licenseStatus.message || 'This build is currently read-only.'
      );
      return;
    }

    textRef.current = value;
    draftIsDirty.current = true;
    setText(value);
    setComposerError(null);
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = setTimeout(() => {
      void persistDraft(value).then((saved) => {
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
    if (!storageWritable) {
      setComposerError('Storage needs recovery, so Skribli did not delete this note.');
      return;
    }
    if (!licenceAllowsWrite) return;
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    const deleted = await deleteSkrib(note.id);
    if (deleted) {
      draftIsDirty.current = false;
      await hideWindow();
    } else {
      setComposerError('The note could not be deleted safely. It remains available.');
    }
  };

  const recoveryDirectory = storageNotice?.backupDirectory || storageBackupDirectory;

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
            aria-label={storageWritable ? 'Save and close Skribli' : 'Storage recovery required'}
            title={storageWritable ? 'Save and close' : 'Storage recovery required'}
          >
            ✕
          </button>
        </header>

        {storageNotice && (
          <div className="composer-recovery" role="status">
            <span>{storageNotice.message}</span>
            {recoveryDirectory && <small>Recovery folder: {recoveryDirectory}</small>}
            <div className="composer-storage-actions">
              <button type="button" onClick={() => void handleExportDiagnostics()}>
                Save safe diagnostics
              </button>
              <button type="button" onClick={dismissStorageNotice}>Dismiss</button>
            </div>
            {diagnosticsPath && <small>Diagnostics saved to: {diagnosticsPath}</small>}
          </div>
        )}

        {(composerError || storageErrorMessage) && (
          <div className="composer-error" role="alert">
            <span>{composerError || storageErrorMessage}</span>
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
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={() => {
            void saveTextNow().then((saved) => {
              if (!saved && draftIsDirty.current) {
                setComposerError('The latest text is not saved. Keep this window open and retry.');
              }
            });
          }}
        />

        <footer className="composer-footer">
          <div className="composer-status">
            <span>{composerError || storageErrorMessage ? 'Not saved' : 'Saved locally'}</span>
            <small>
              {storageWritable ? 'Esc closes after saving' : 'Recovery required before closing'}
            </small>
          </div>
          <div className="composer-footer-actions">
            <button
              type="button"
              className="secondary danger"
              disabled={!canWrite}
              onClick={() => void handleDelete()}
            >
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
