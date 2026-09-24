import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, FileText, GripVertical, X } from 'lucide-react';
import { createAttachmentObjectUrl, revokeAttachmentObjectUrl, type SkribAttachment } from '../../lib/richContentStore';

export const INLINE_ATTACHMENT_MIME = 'application/x-skribli-attachment';

export function InlineAttachment({ attachment, noteId, disabled, onMove, onRemove }: {
  attachment: SkribAttachment; noteId: string; disabled: boolean;
  onMove: (direction: -1 | 1) => void; onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let next: string | null = null;
    try { next = createAttachmentObjectUrl(attachment); } catch { /* Keep the file name readable. */ }
    setUrl(next);
    return () => { if (next) revokeAttachmentObjectUrl(next); };
  }, [attachment.blob]);
  return (
    <span className={`inline-attachment-object inline-attachment-${attachment.kind}`}>
      <span className="inline-attachment-preview">
        {(attachment.kind === 'image' || attachment.kind === 'ink') && url
          ? <img src={url} alt={attachment.name} draggable={false} />
          : attachment.kind === 'video' && url
            ? <video src={url} controls preload="metadata" aria-label={attachment.name} />
            : <FileText size={32} aria-hidden="true" />}
      </span>
      <span className="inline-attachment-name" title={attachment.name}>{attachment.name}</span>
      <span className="inline-attachment-actions" role="group" aria-label={`Actions for ${attachment.name}`}>
        <button type="button" draggable={!disabled} disabled={disabled} title="Drag into a different line"
          aria-label={`Drag ${attachment.name} within this note`}
          onDragStart={(event) => {
            event.dataTransfer.setData(INLINE_ATTACHMENT_MIME, JSON.stringify({ noteId, attachmentId: attachment.id }));
            event.dataTransfer.effectAllowed = 'move';
          }}><GripVertical size={14} /></button>
        <button type="button" disabled={disabled} onClick={() => onMove(-1)} title="Move before the previous paragraph" aria-label={`Move ${attachment.name} earlier`}><ArrowLeft size={14} /></button>
        <button type="button" disabled={disabled} onClick={() => onMove(1)} title="Move after the next paragraph" aria-label={`Move ${attachment.name} later`}><ArrowRight size={14} /></button>
        {url && <a href={url} download={attachment.name} title="Save a copy" aria-label={`Save a copy of ${attachment.name}`}><Download size={14} /></a>}
        <button type="button" disabled={disabled} onClick={onRemove} title="Remove from the text; keep in attachments" aria-label={`Remove ${attachment.name} from text only`}><X size={14} /></button>
      </span>
    </span>
  );
}
