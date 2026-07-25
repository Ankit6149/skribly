import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import {
  addFilesToNote,
  addInkToNote,
  formatAttachmentSize,
  getRichContent,
  removeAttachmentFromNote,
  SkribAttachment,
} from '../../lib/richContentStore';
import { useLicenseStore } from '../../stores/licenseStore';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import { InkCanvas } from './InkCanvas';

interface SkribComposerProps {
  note: SkribNote;
  target: TargetWindowInfo | null;
}

const COLOR_OPTIONS: Array<{ key: SkribNote['color']; label: string }> = [
  { key: 'yellow', label: 'Paper yellow' },
  { key: 'peach', label: 'Warm peach' },
  { key: 'mint', label: 'Soft mint' },
  { key: 'sky', label: 'Clear sky' },
  { key: 'lavender', label: 'Lavender' },
];

export const SkribComposer: React.FC<SkribComposerProps> = ({ note, target }) => {
  const { updateSkribText, updateSkribColor, toggleSkribCollapse } = useSkribStore();
  const licenseStatus = useLicenseStore((state) => state.status);
  const canWrite = !licenseStatus.enforcementEnabled || licenseStatus.canWrite;
  const {
    composerMode,
    setComposerMode,
    closeComposer,
    openPreview,
  } = useSkribUiStore();
  const [text, setText] = useState(note.text);
  const [attachments, setAttachments] = useState<SkribAttachment[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddingFiles, setIsAddingFiles] = useState(false);
  const textSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readOnlyMessage = licenseStatus.message || 'Skribly is currently read-only on this device.';

  const refreshAttachments = async () => {
    const content = await getRichContent(note.id);
    setAttachments(content.attachments);
  };

  useEffect(() => {
    setText(note.text);
  }, [note.id, note.text]);

  useEffect(() => {
    void refreshAttachments().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    });
  }, [note.id]);

  useEffect(() => {
    const urls: Record<string, string> = {};
    attachments.forEach((attachment) => {
      urls[attachment.id] = URL.createObjectURL(attachment.blob);
    });
    setAttachmentUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [attachments]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      void finishAndCollapse();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    return () => {
      if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    };
  }, []);

  const contextLabel = useMemo(() => {
    if (!target) return note.target_process_name || 'Unbound note';
    return target.title || target.process_name;
  }, [note.target_process_name, target]);

  const saveTextNow = async () => {
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = null;
    if (!canWrite) {
      setText(note.text);
      return;
    }
    if (text !== note.text) {
      await updateSkribText(note.id, text);
    }
  };

  const handleTextChange = (value: string) => {
    if (!canWrite) {
      setErrorMessage(readOnlyMessage);
      return;
    }
    setText(value);
    if (textSaveTimer.current) clearTimeout(textSaveTimer.current);
    textSaveTimer.current = setTimeout(() => {
      void updateSkribText(note.id, value);
    }, 350);
  };

  const finishAndCollapse = async () => {
    await saveTextNow();
    if (canWrite && !note.collapsed) {
      await toggleSkribCollapse(note.id);
    }
    closeComposer();
  };

  const keepAsCard = async () => {
    await saveTextNow();
    if (canWrite && note.collapsed) {
      await toggleSkribCollapse(note.id);
    }
    openPreview(note.id);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (!canWrite) {
      setErrorMessage(readOnlyMessage);
      return;
    }
    setIsAddingFiles(true);
    setErrorMessage(null);
    try {
      const next = await addFilesToNote(note.id, files);
      setAttachments(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsAddingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInkSave = async (blob: Blob) => {
    if (!canWrite) {
      setErrorMessage(readOnlyMessage);
      return;
    }
    setErrorMessage(null);
    try {
      const next = await addInkToNote(note.id, blob);
      setAttachments(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!canWrite) {
      setErrorMessage(readOnlyMessage);
      return;
    }
    setErrorMessage(null);
    try {
      const next = await removeAttachmentFromNote(note.id, attachmentId);
      setAttachments(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const openAttachment = (attachment: SkribAttachment) => {
    const url = attachmentUrls[attachment.id];
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = attachment.name;
    anchor.rel = 'noopener';
    anchor.click();
  };

  return (
    <div className="skrib-composer-backdrop">
      <section
        className={`skrib-composer skrib-composer-${composerMode} skrib-color-${note.color}`}
        aria-label={canWrite ? 'Edit Skrib' : 'View Skrib read-only'}
      >
        <header className="composer-header">
          <div className="composer-context">
            <span className="composer-kicker">ATTACHED TO</span>
            <strong>{contextLabel}</strong>
          </div>
          <div className="composer-header-actions">
            <div className="composer-mode-switch" aria-label="Composer mode">
              <button
                type="button"
                className={composerMode === 'type' ? 'active' : ''}
                onClick={() => setComposerMode('type')}
              >
                Type
              </button>
              <button
                type="button"
                className={composerMode === 'write' ? 'active' : ''}
                onClick={() => setComposerMode('write')}
              >
                Write
              </button>
            </div>
            <button type="button" className="composer-close" onClick={() => void finishAndCollapse()} aria-label="Close note">
              ✕
            </button>
          </div>
        </header>

        {!canWrite && (
          <div className="composer-error" role="status">
            Read-only · {readOnlyMessage}
          </div>
        )}

        {errorMessage && canWrite && (
          <div className="composer-error" role="alert">
            {errorMessage}
          </div>
        )}

        {composerMode === 'write' && canWrite && <InkCanvas onSave={handleInkSave} />}

        <textarea
          className="composer-textarea"
          value={text}
          autoFocus={composerMode === 'type' && canWrite}
          readOnly={!canWrite}
          placeholder={composerMode === 'type' ? 'Write the note you need here…' : 'Add a typed explanation below your drawing…'}
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={() => void saveTextNow()}
        />

        <section className="composer-attachments">
          <div className="composer-section-heading">
            <div>
              <strong>Attachments</strong>
              <span>Images and files stay on this computer.</span>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAddingFiles || !canWrite}>
              {isAddingFiles ? 'Adding…' : '＋ Add image or file'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              disabled={!canWrite}
              onChange={(event) => void handleFiles(Array.from(event.target.files ?? []))}
            />
          </div>

          {attachments.length > 0 && (
            <div className="attachment-grid">
              {attachments.map((attachment) => (
                <article key={attachment.id} className="attachment-card">
                  {attachment.mimeType.startsWith('image/') && attachmentUrls[attachment.id] ? (
                    <img src={attachmentUrls[attachment.id]} alt={attachment.name} />
                  ) : (
                    <div className="attachment-file-icon">FILE</div>
                  )}
                  <div className="attachment-meta">
                    <strong>{attachment.name}</strong>
                    <span>{formatAttachmentSize(attachment.size)}</span>
                  </div>
                  <div className="attachment-actions">
                    <button type="button" onClick={() => openAttachment(attachment)}>Open</button>
                    <button type="button" disabled={!canWrite} onClick={() => void removeAttachment(attachment.id)}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="composer-footer">
          <div className="composer-colors" aria-label="Note colour">
            {COLOR_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={!canWrite}
                className={`composer-color skrib-color-${option.key} ${note.color === option.key ? 'active' : ''}`}
                title={option.label}
                onClick={() => void updateSkribColor(note.id, option.key)}
              />
            ))}
          </div>
          <div className="composer-footer-actions">
            <button type="button" className="secondary" onClick={() => void keepAsCard()}>
              Open as card
            </button>
            <button type="button" className="primary" onClick={() => void finishAndCollapse()}>
              {canWrite ? 'Done · turn into dot' : 'Close note'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
