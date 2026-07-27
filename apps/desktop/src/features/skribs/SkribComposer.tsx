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
  const { updateSkribText, deleteSkrib } = useSkribStore();
  const licenseStatus = useLicenseStore((state) => state.status);
  const canWrite = !licenseStatus.enforcementEnabled || licenseStatus.canWrite;
  const { closeComposer } = useSkribUiStore();
  const [text, setText] = useState(note.text);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const saveTextNow = async () => {
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = null;
    if (!canWrite) return;
    if (text !== note.text) await updateSkribText(note.id, text);
  };

  const finishAndHide = async () => {
    if (!canWrite) {
      await hideWindow();
      return;
    }

    if (text.trim().length === 0) {
      await deleteSkrib(note.id);
      await hideWindow();
      return;
    }

    await saveTextNow();
    await hideWindow();
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
      setErrorMessage(licenseStatus.message || 'This build is currently read-only.');
      return;
    }

    setText(value);
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = setTimeout(() => {
      void updateSkribText(note.id, value);
    }, 350);
  };

  const handleDelete = async () => {
    if (!canWrite) return;
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    await deleteSkrib(note.id);
    await hideWindow();
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

        {errorMessage && <div className="composer-error" role="alert">{errorMessage}</div>}

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
            <span>Saved locally</span>
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
