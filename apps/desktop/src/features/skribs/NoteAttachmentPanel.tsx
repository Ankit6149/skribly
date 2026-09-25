import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, Image, Paperclip, Play } from 'lucide-react';
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
  openDrawerRequest?: number;
  filesRequest?: { id: number; files: File[] } | null;
  removeRequest?: { id: string; nonce: number } | null;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onCountChange?: (count: number) => void;
  onRequestExpand?: () => Promise<boolean> | boolean;
  onAttachmentsChange?: (attachments: SkribAttachment[]) => void;
  onPlaceInline?: (attachments: SkribAttachment[]) => boolean;
  onRemoved?: (attachmentId: string) => void;
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
  openDrawerRequest = 0,
  filesRequest = null,
  removeRequest = null,
  onError,
  onBusyChange,
  onCountChange,
  onRequestExpand,
  onAttachmentsChange,
  onPlaceInline,
  onRemoved,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPickerRequestRef = useRef(pickerRequest);
  const lastOpenDrawerRequestRef = useRef(openDrawerRequest);
  const lastFilesRequestRef = useRef<number | null>(filesRequest?.id ?? null);
  const lastRemoveRequestRef = useRef<number | null>(removeRequest?.nonce ?? null);
  const operationInProgressRef = useRef(false);
  const [attachments, setAttachments] = useState<SkribAttachment[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const panelBusy = isAdding || removingId !== null;

  const reportError = useCallback((reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message);
    onError?.(message);
  }, [onError]);

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
  }, [noteId, reportError]);

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
  const compactImages = useMemo(
    () => attachments.filter((attachment) => attachment.kind === 'image' || attachment.kind === 'ink'),
    [attachments]
  );
  const compactObjects = useMemo(
    () => attachments.filter((attachment) => attachment.kind !== 'image' && attachment.kind !== 'ink'),
    [attachments]
  );

  useEffect(() => {
    onCountChange?.(attachments.length);
  }, [attachments.length, onCountChange]);

  useEffect(() => {
    if (!isLoading) onAttachmentsChange?.(attachments);
  }, [attachments, isLoading, onAttachmentsChange]);

  useEffect(() => {
    if (pickerRequest === lastPickerRequestRef.current) return;
    lastPickerRequestRef.current = pickerRequest;
    if (!disabled && !panelBusy) fileInputRef.current?.click();
  }, [disabled, panelBusy, pickerRequest]);

  const addFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || disabled || operationInProgressRef.current) return;
    operationInProgressRef.current = true;
    setIsAdding(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const previous = new Set(attachments.map((item) => item.id));
      const next = await addFilesToNote(noteId, Array.from(files));
      setAttachments(next);
      onAttachmentsChange?.(next);
      const newItems = next.filter((item) => !previous.has(item.id));
      if (!onPlaceInline || !onPlaceInline(newItems)) {
        const canExpand = await onRequestExpand?.();
        if (canExpand !== false) setCompactExpanded(true);
      }
      void emit('skribly://rich-content-updated', { noteId }).catch(() => undefined);
    } catch (reason) {
      reportError(reason);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsAdding(false);
      operationInProgressRef.current = false;
      onBusyChange?.(false);
    }
  }, [attachments, disabled, noteId, onBusyChange, onRequestExpand, reportError, onAttachmentsChange, onPlaceInline]);

  useEffect(() => {
    if (!filesRequest || filesRequest.id === lastFilesRequestRef.current) return;
    lastFilesRequestRef.current = filesRequest.id;
    void addFiles(filesRequest.files);
  }, [addFiles, filesRequest]);

  useEffect(() => {
    if (!isLoading && attachments.length === 0) setCompactExpanded(false);
  }, [attachments.length, isLoading]);

  const toggleCompactDrawer = async () => {
    if (compactExpanded) {
      setPlayingVideoId(null);
      setCompactExpanded(false);
      return;
    }
    try {
      const canExpand = await onRequestExpand?.();
      if (canExpand !== false) setCompactExpanded(true);
    } catch (reason) {
      reportError(reason);
    }
  };

  useEffect(() => {
    if (openDrawerRequest === lastOpenDrawerRequestRef.current) return;
    lastOpenDrawerRequestRef.current = openDrawerRequest;
    if (attachments.length === 0) return;
    void (async () => {
      try {
        const canExpand = await onRequestExpand?.();
        if (canExpand !== false) setCompactExpanded(true);
      } catch (reason) { reportError(reason); }
    })();
  }, [attachments.length, onRequestExpand, openDrawerRequest, reportError]);

  const remove = async (attachmentId: string, confirmed = false) => {
    if (disabled || operationInProgressRef.current) return;
    if (!confirmed && confirmRemoveId !== attachmentId) {
      setConfirmRemoveId(attachmentId);
      return;
    }
    operationInProgressRef.current = true;
    setRemovingId(attachmentId);
    onBusyChange?.(true);
    setError(null);
    try {
      setAttachments(await removeAttachmentFromNote(noteId, attachmentId));
      onRemoved?.(attachmentId);
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

  useEffect(() => {
    if (!removeRequest || removeRequest.nonce === lastRemoveRequestRef.current) return;
    if (disabled || panelBusy || operationInProgressRef.current) return;
    lastRemoveRequestRef.current = removeRequest.nonce;
    void remove(removeRequest.id, true);
  }, [disabled, panelBusy, removeRequest]);

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
    const imageCount = compactImages.length;
    const videoCount = compactObjects.filter((attachment) => attachment.kind === 'video').length;
    const fileCount = attachments.length - imageCount - videoCount;
    const attachmentTypes = [
      imageCount > 0 ? `${imageCount} ${imageCount === 1 ? 'photo' : 'photos'}` : null,
      videoCount > 0 ? `${videoCount} ${videoCount === 1 ? 'video' : 'videos'}` : null,
      fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : null,
    ].filter(Boolean).join(' · ');
    const drawerId = `note-attachments-${noteId}`;

    return (
      <section
        className="note-attachment-strip"
        data-empty={attachments.length === 0 && !isLoading}
        data-expanded={compactExpanded}
        aria-label="Attached files"
      >
        {hiddenPicker}
        {isLoading ? (
          <span className="attachment-strip-status" role="status">Reading attachments…</span>
        ) : attachments.length > 0 ? (
          <>
            <button
              type="button"
              className="attachment-drawer-handle"
              aria-label={`${compactExpanded ? 'Hide' : 'View'} all attachments · ${attachmentTypes}`}
              title={compactExpanded ? 'Hide attachments' : 'View all attachments'}
              aria-expanded={compactExpanded}
              aria-controls={drawerId}
              onClick={() => void toggleCompactDrawer()}
            >
              <span className="attachment-drawer-icon" aria-hidden="true"><Paperclip size={15} /></span>
              <span className="attachment-drawer-copy">
                <strong>{attachmentTypes}</strong>
                <small>{compactExpanded ? 'Hide the collection' : 'View all attachments'}</small>
              </span>
              {compactExpanded
                ? <ChevronDown size={17} aria-hidden="true" />
                : <ChevronUp size={17} aria-hidden="true" />}
            </button>
            <div
              id={drawerId}
              className="attachment-drawer-content"
              hidden={!compactExpanded}
            >
              <div className="attachment-media-grid">
            {onPlaceInline ? attachments.map((attachment) => (
              <article key={attachment.id} className="attachment-tray-item">
                <div className="attachment-tray-thumbnail">
                  {(attachment.kind === 'image' || attachment.kind === 'ink') && urls[attachment.id]
                    ? <img src={urls[attachment.id]} alt={attachment.name} />
                    : attachment.kind === 'video' && urls[attachment.id]
                      ? <video src={urls[attachment.id]} controls preload="metadata" aria-label={attachment.name} />
                      : <FileText size={28} aria-hidden="true" />}
                </div>
                <strong title={attachment.name}>{attachment.name}</strong>
                <div className="attachment-object-actions">
                  <button type="button" disabled={disabled || panelBusy} onClick={() => {
                    if (!onPlaceInline([attachment])) reportError('Could not place this file in the note. Select a writing position and try again.');
                  }} title="Place at your writing cursor">Place in note</button>
                  {urls[attachment.id] && <a href={urls[attachment.id]} download={attachment.name} aria-label={`Save a copy of ${attachment.name}`}>Save copy</a>}
                  <button type="button" disabled={disabled || panelBusy}
                    aria-label={`${confirmRemoveId === attachment.id ? 'Confirm removing' : 'Remove'} ${attachment.name}`}
                    onClick={() => void remove(attachment.id)}>{confirmRemoveId === attachment.id ? 'Remove?' : 'Remove'}</button>
                </div>
              </article>
            )) : <>
            {compactImages.length > 0 && (() => {
              const selectedIndex = Math.min(photoIndex, compactImages.length - 1);
              const lead = compactImages[selectedIndex]!;
              const leadUrl = urls[lead.id];
              const visiblePhotos = [lead, ...compactImages.filter((photo) => photo.id !== lead.id)].slice(0, 3);
              return (
                <article className="attachment-media-object attachment-photo-object" tabIndex={0}>
                  <span className="attachment-object-label" aria-live="polite">
                    {compactImages.length > 1 ? `PHOTO ${selectedIndex + 1} OF ${compactImages.length}` : '1 PHOTO'}
                  </span>
                  <div className="attachment-photo-stack" aria-label={`${compactImages.length} attached photos`}>
                    {visiblePhotos.map((attachment, index) => {
                      const url = urls[attachment.id];
                      return (
                        <span key={attachment.id} className={`attachment-polaroid photo-${index + 1}`}>
                          {url ? <img src={url} alt={attachment.name} /> : <Image size={20} aria-hidden="true" />}
                        </span>
                      );
                    })}
                  </div>
                  <div className="attachment-object-actions">
                    {compactImages.length > 1 && <>
                      <button type="button" aria-label="Previous photo" title="Previous photo"
                        disabled={panelBusy}
                        onClick={() => { setPhotoIndex((selectedIndex + compactImages.length - 1) % compactImages.length); setConfirmRemoveId(null); }}>
                        <ChevronLeft size={14} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label="Next photo" title="Next photo"
                        disabled={panelBusy}
                        onClick={() => { setPhotoIndex((selectedIndex + 1) % compactImages.length); setConfirmRemoveId(null); }}>
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </>}
                    {leadUrl && <a href={leadUrl} download={lead.name} aria-label={`Save a copy of ${lead.name}`}>Save copy</a>}
                    <button
                      type="button"
                      className={confirmRemoveId === lead.id ? 'confirm' : ''}
                      disabled={disabled || panelBusy}
                      aria-label={`${confirmRemoveId === lead.id ? 'Confirm removing' : 'Remove'} ${lead.name}`}
                      onClick={() => void remove(lead.id)}
                    >
                      {removingId === lead.id ? 'Removing…' : confirmRemoveId === lead.id ? 'Remove?' : 'Remove'}
                    </button>
                  </div>
                </article>
              );
            })()}
            {compactObjects.map((attachment) => {
              const url = urls[attachment.id];
              const typeLabel = attachment.name.split('.').pop()?.toUpperCase() || attachment.kind.toUpperCase();
              return (
                <article
                  key={attachment.id}
                  className={`attachment-media-object attachment-${attachment.kind}-object`}
                  tabIndex={0}
                >
                  {attachment.kind === 'video' ? (
                    <span className={`attachment-video-art ${playingVideoId === attachment.id ? 'is-playing' : ''}`}>
                      {url && <video key={`${attachment.id}-${playingVideoId === attachment.id}`} src={url}
                        controls={playingVideoId === attachment.id}
                        autoPlay={playingVideoId === attachment.id}
                        muted={playingVideoId !== attachment.id}
                        preload="metadata" aria-label={attachment.name} />}
                      {url && playingVideoId !== attachment.id && (
                        <button type="button" className="attachment-video-play"
                          aria-label={`Play ${attachment.name}`}
                          onClick={() => setPlayingVideoId(attachment.id)}>
                          <Play size={20} fill="currentColor" aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="attachment-document-paper" aria-hidden="true">
                      <Paperclip size={17} />
                      <FileText size={26} />
                    </span>
                  )}
                  <strong title={attachment.name}>{attachment.name}</strong>
                  <em>{typeLabel} · {formatAttachmentSize(attachment.size)}</em>
                  <div className="attachment-object-actions">
                    {url && <a href={url} download={attachment.name} aria-label={`Save a copy of ${attachment.name}`}>Save copy</a>}
                    <button
                      type="button"
                      className={confirmRemoveId === attachment.id ? 'confirm' : ''}
                      disabled={disabled || panelBusy}
                      aria-label={`${confirmRemoveId === attachment.id ? 'Confirm removing' : 'Remove'} ${attachment.name}`}
                      onClick={() => void remove(attachment.id)}
                    >
                      {removingId === attachment.id
                        ? 'Removing…'
                        : confirmRemoveId === attachment.id ? 'Remove?' : 'Remove'}
                    </button>
                  </div>
                </article>
              );
            })}
            </>}
              </div>
          </div>
          </>
        ) : (
          <span className="attachment-strip-empty" aria-hidden="true" />
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
                      Save copy
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
