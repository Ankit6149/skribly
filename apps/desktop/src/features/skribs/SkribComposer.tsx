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
  const { updateSkribText, toggleSkribCollapse, deleteSkrib } = useSkribStore();
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

  const saveTextNow = async () => {
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = null;
    if (!canWrite) return;
    if (text !== note.text) await updateSkribText(note.id, text);
  };

  const finishAndCollapse = async (hideOverlay = false) => {
    await saveTextNow();
    if (canWrite && !note.collapsed) await toggleSkribCollapse(note.id);
    closeComposer();
    if (hideOverlay) await getCurrentWindow().hide();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      void finishAndCollapse();
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
    }, 300);
  };

  const handleDelete = async () => {
    if (!canWrite) return;
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    closeComposer();
    await deleteSkrib(note.id);
  };

  return (
    <div className="skrib-composer-backdrop">
      <section
        className={`skrib-composer skrib-color-${note.color}`}
        aria-label={canWrite ? 'Edit attached note' : 'View attached note'}
      >
        <header className="composer-header">
          <div className="composer-context">
            <span className="composer-kicker">ATTACHED TO</span>
            <strong>{contextLabel}</strong>
          </div>
          <button
            type="button"
            className="composer-close"
            onClick={() => void finishAndCollapse()}
            aria-label="Save and close note"
            title="Save and close"
          >
            ✕
          </button>
        </header>

        {errorMessage && (
          <div className="composer-error" role="alert">{errorMessage}</div>
        )}

        <textarea
          className="composer-textarea"
          value={text}
          autoFocus={canWrite}
          readOnly={!canWrite}
          placeholder="Write something here…"
          spellCheck
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={() => void saveTextNow()}
        />

        <footer className="composer-footer">
          <span className="composer-footer-hint">Esc saves and closes</span>
          <div className="composer-footer-actions">
            <button type="button" className="secondary" disabled={!canWrite} onClick={() => void handleDelete()}>
              Delete
            </button>
            <button type="button" className="secondary" onClick={() => void finishAndCollapse(true)}>
              Hide app
            </button>
            <button type="button" className="primary" onClick={() => void finishAndCollapse()}>
              Done
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
