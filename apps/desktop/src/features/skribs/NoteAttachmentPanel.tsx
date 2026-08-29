import React, { useEffect, useMemo, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { FileText, Image, Paperclip, Play, Trash2 } from 'lucide-react';
import {
  addFilesToNote,
  createAttachmentObjectUrl,
  formatAttachmentSize,
  getRichContent,
  removeAttachmentFromNote,
  revokeAttachmentObjectUrl,
  type SkribAttachment,
} from '../../lib/richContentStore';

interface NoteAttachmentPanelProps {
  noteId: string;
  disabled?: boolean;
  compact?: boolean;
  pickerRequest?: number;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onCountChange?: (count: number) => void;
}

const ACCEPTED_FILES = [
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  '.csv',
  '.doc',
  '.docx',
  '.md',
  '.pdf',
  '.ppt',
  '.pptx',
  '.rtf',
  '.txt',
  '.xls',
  '.xlsx',
].join(',');

export const NoteAttachmentPanel: React.FC<NoteAttachmentPanelProps> = ({
  noteId,
  disabled = false,
  compact = false,
  pickerRequest = 0,
  onError,
  onBusyChange,
  onCountChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPickerRequestRef = useRef(pickerRequest);
  const operationInProgressRef = useRef(false);
  const [attachments, setAttachments] = useState<SkribAttachment[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelBusy = isAdding || removingId !== null;

  const reportError = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message);
    onError?.(message);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void getRichContent(noteId)
      .then((content) => {
        if (!cancelled) setAttachments(content.attachments);
      })
      .catch((reason) => {
        if (!cancelled) reportError(reason);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  useEffect(() => {
    const nextUrls: Record<string, string> = {};
    for (const attachment of attachments) {
      try {
        nextUrls[attachment.id] = createAttachmentObjectUrl(attachment);
      } catch {
        // Metadata remains available when the WebView cannot create a preview URL.
      }
    }
    setUrls(nextUrls);
    return () => Object.values(nextUrls).forEach(revokeAttachmentObjectUrl);
  }, [attachments]);

  const totalSize = useMemo(
    () => attachments.reduce((total, attachment) => total + attachment.size, 0),
    [attachments]
  );

  useEffect(() => {
    onCountChange?.(attachments.length);
  }, [attachments.length, onCountChange]);

  useEffect(() => {
    if (pickerRequest === lastPickerRequestRef.current) return;
    lastPickerRequestRef.current = pickerRequest;
    if (!disabled && !panelBusy) fileInputRef.current?.click();
  }, [disabled, panelBusy, pickerRequest]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled || operationInProgressRef.current) return;
    operationInProgressRef.current = true;
    setIsAdding(true);
    onBusyChange?.(true);
    setError(null);
    try {
      setAttachments(await addFilesToNote(noteId, Array.from(files)));
      void emit('skribly://rich-content-updated', { noteId }).catch(() => undefined);
    } catch (reason) {
      reportError(reason);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsAdding(false);
      operationInProgressRef.current = false;
      onBusyChange?.(false);
    }
  };

  const remove = async (attachmentId: string) => {
    if (disabled || operationInProgressRef.current) return;
    if (confirmRemoveId !== attachmentId) {
      setConfirmRemoveId(attachmentId);
      return;
    }
    operationInProgressRef.current = true;
    setRemovingId(attachmentId);
    onBusyChange?.(true);
    setError(null);
    try {
      setAttachments(await removeAttachmentFromNote(noteId, attachmentId));
      void emit('skribly://rich-content-updated', { noteId }).catch(() => undefined);
      setConfirmRemoveId(null);
    } catch (reason) {
      reportError(reason);
    } finally {
      setRemovingId(null);
      operationInProgressRef.current = false;
      onBusyChange?.(false);
    }
  };

  const hiddenPicker = (
    <input
      ref={fileInputRef}
      className="sr-only"
      type="file"
      multiple
      accept={ACCEPTED_FILES}
      disabled={disabled || panelBusy}
      onChange={(event) => void addFiles(event.currentTarget.files)}
    />
  );

  if (compact) {
    return (
      <section
        className="note-attachment-strip"
        data-empty={attachments.length === 0 && !isLoading}
        aria-label="Attached files"
      >
        {hiddenPicker}
        {isLoading ? (
          <span className="attachment-strip-status" role="status">Reading attachments…</span>
        ) : attachments.length > 0 ? (
          <div className="attachment-chips">
            {attachments.map((attachment) => {
              const url = urls[attachment.id];
              const Icon =
                attachment.kind === 'image' || attachment.kind === 'ink'
                  ? Image
                  : attachment.kind === 'video'
                    ? Play
                    : FileText;
              return (
                <article key={attachment.id} className="attachment-chip">
                  <span className="attachment-chip-icon" aria-hidden="true"><Icon size={14} /></span>
                  <div className="attachment-chip-copy">
                    {url ? (
                      <a href={url} download={attachment.name} title={attachment.name}>{attachment.name}</a>
                    ) : (
                      <strong title={attachment.name}>{attachment.name}</strong>
                    )}
                    <small>{formatAttachmentSize(attachment.size)}</small>
                  </div>
                  <button
                    type="button"
                    className={confirmRemoveId === attachment.id ? 'confirm' : ''}
                    disabled={disabled || panelBusy}
                    aria-label={
                      confirmRemoveId === attachment.id
                        ? `Confirm removing ${attachment.name}`
                        : `Remove ${attachment.name}`
                    }
                    onClick={() => void remove(attachment.id)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <span className="attachment-strip-empty"><Paperclip size={13} aria-hidden="true" /> Add a photo, video, or document</span>
        )}
        {error && <div className="note-panel-error" role="alert">{error}</div>}
      </section>
    );
  }

  return (
    <section className="note-attachment-panel" aria-labelledby="note-attachments-title">
      <header className="note-panel-heading">
        <div>
          <strong id="note-attachments-title">Attachments</strong>
          <span>Photos, short videos, and document references stay in local app storage.</span>
        </div>
        <button
          type="button"
          className="primary"
          disabled={disabled || panelBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          {isAdding ? 'Adding…' : 'Add files'}
        </button>
        {hiddenPicker}
      </header>

      <div className="note-attachment-summary" role="status" aria-live="polite">
        <span>{attachments.length.toLocaleString()} of 16 files</span>
        <span>{formatAttachmentSize(totalSize)} of 64 MB</span>
      </div>

      {error && <div className="note-panel-error" role="alert">{error}</div>}

      {isLoading ? (
        <div className="note-panel-empty" role="status">Reading local attachments…</div>
      ) : attachments.length === 0 ? (
        <div className="note-panel-empty">
          <strong>No attachments yet</strong>
          <span>Add an image, a short video, or a PDF/Office/text reference.</span>
        </div>
      ) : (
        <div className="note-attachment-grid">
          {attachments.map((attachment) => {
            const url = urls[attachment.id];
            return (
              <article key={attachment.id} className={`note-attachment ${attachment.kind}`}>
                <div className="note-attachment-preview">
                  {attachment.kind === 'image' || attachment.kind === 'ink' ? (
                    url ? <img src={url} alt="" /> : <Image size={20} aria-hidden="true" />
                  ) : attachment.kind === 'video' ? (
                    url ? (
                      <video controls preload="metadata" aria-label={attachment.name}>
                        <source src={url} type={attachment.mimeType} />
                      </video>
                    ) : (
                      <Play size={20} aria-hidden="true" />
                    )
                  ) : (
                    <FileText size={20} aria-hidden="true" />
                  )}
                </div>
                <div className="note-attachment-copy">
                  <strong title={attachment.name}>{attachment.name}</strong>
                  <span>{attachment.kind} · {formatAttachmentSize(attachment.size)}</span>
                </div>
                <div className="note-attachment-actions">
                  {url && (
                    <a href={url} download={attachment.name}>
                      Open copy
                    </a>
                  )}
                  <button
                    type="button"
                    className={confirmRemoveId === attachment.id ? 'danger' : ''}
                    disabled={disabled || panelBusy}
                    onClick={() => void remove(attachment.id)}
                  >
                    {removingId === attachment.id
                      ? 'Removing…'
                      : confirmRemoveId === attachment.id
                        ? 'Remove?'
                        : 'Remove'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
