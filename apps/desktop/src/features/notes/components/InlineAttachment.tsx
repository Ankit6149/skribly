import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, FileText, GripVertical, MoreHorizontal, X } from '../../../ui/icons';
import { createAttachmentObjectUrl, revokeAttachmentObjectUrl, formatAttachmentSize, type SkribAttachment } from '../persistence/richContentStore';
import type { InlineAttachmentSize } from '../model/inlineAttachmentModel';

export const INLINE_ATTACHMENT_MIME = 'application/x-skribli-attachment';

export function InlineAttachment({ noteId, attachment, disabled, size, onSizeChange, onMove, onRemoveReference, onDeleteFile }: {
  noteId: string;
  attachment: SkribAttachment; disabled: boolean; size: InlineAttachmentSize;
  onSizeChange: (size: InlineAttachmentSize) => void;
  onMove: (direction: -1 | 1) => void; onRemoveReference: () => void;
  onDeleteFile?: (() => void) | undefined;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const attachmentBlob = attachment.blob;
  useEffect(() => {
    let next: string | null = null;
    try { next = createAttachmentObjectUrl({ blob: attachmentBlob }); } catch { /* Keep the file name readable. */ }
    setUrl(next);
    return () => { if (next) revokeAttachmentObjectUrl(next); };
  }, [attachmentBlob]);
  return (
    <span className={`inline-attachment-object inline-attachment-${attachment.kind}`} data-size={size}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActionsOpen(false); }}>
      <span className="inline-attachment-preview">
        {(attachment.kind === 'image' || attachment.kind === 'ink') && url
          ? <img src={url} alt={attachment.name} draggable={false} />
          : attachment.kind === 'video' && url
            ? <video src={url} controls preload="metadata" aria-label={attachment.name} />
            : <FileText size={28} aria-hidden="true" />}
      </span>
      <button type="button" className="inline-attachment-drag" disabled={disabled} draggable={!disabled}
        aria-label={`Drag ${attachment.name} to another writing position`} title="Drag to move · use Options to move with the keyboard"
        onDragStart={(event) => {
          if (disabled) { event.preventDefault(); return; }
          event.dataTransfer.setData(INLINE_ATTACHMENT_MIME, JSON.stringify({ noteId, attachmentId: attachment.id }));
          event.dataTransfer.effectAllowed = 'move';
        }}>
        <GripVertical size={15} aria-hidden="true" />
      </button>
      <button type="button" className="inline-attachment-more" disabled={disabled}
        aria-label={`Options for ${attachment.name}`} aria-expanded={actionsOpen}
        title="Attachment options" onClick={() => setActionsOpen((open) => !open)}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      <button type="button" className="inline-attachment-remove" disabled={disabled}
        aria-label={`Remove ${attachment.name} from text`} title="Remove from text — keep file in attachments"
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => { event.stopPropagation(); onRemoveReference(); }}>
        <X size={13} aria-hidden="true" />
      </button>
      <span className="inline-attachment-name" title={attachment.name}>{attachment.name}</span>
      <span className="inline-attachment-meta">{attachment.name.split('.').pop()?.toUpperCase()} · {formatAttachmentSize(attachment.size)}</span>
      {actionsOpen && <span className="inline-attachment-popover" role="group" aria-label={`Options for ${attachment.name}`}>
        <span className="inline-attachment-meta">Remove from text keeps the saved file. Delete file removes both after confirmation.</span>
        {onDeleteFile && <button type="button" disabled={disabled} onClick={onDeleteFile}>Delete saved file…</button>}
        {(attachment.kind === 'image' || attachment.kind === 'ink') && <span className="inline-attachment-sizes" role="group" aria-label="Image size">
          {(['small', 'medium', 'large'] as const).map((option) => <button key={option} type="button"
            disabled={disabled} aria-label={`${option} image`} aria-pressed={size === option}
            onClick={() => onSizeChange(option)}>{option[0]!.toUpperCase()}</button>)}
        </span>}
        <span className="inline-attachment-menu-row">
          <button type="button" disabled={disabled} onClick={() => onMove(-1)} aria-label={`Move ${attachment.name} earlier`} title="Move earlier"><ArrowLeft size={15} /></button>
          <button type="button" disabled={disabled} onClick={() => onMove(1)} aria-label={`Move ${attachment.name} later`} title="Move later"><ArrowRight size={15} /></button>
          {url && <a href={url} download={attachment.name} aria-label={`Save a copy of ${attachment.name}`} title="Save a copy"><Download size={15} /></a>}
        </span>
      </span>}
    </span>
  );
}
