import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, FileText, GripVertical, MoreHorizontal, X } from '../../../ui/icons';
import { createAttachmentObjectUrl, revokeAttachmentObjectUrl, formatAttachmentSize, type SkribAttachment } from '../persistence/richContentStore';
import type { InlineAttachmentSize } from '../model/inlineAttachmentModel';

export const INLINE_ATTACHMENT_MIME = 'application/x-skribli-attachment';

export function InlineAttachment({ noteId, attachment, disabled, size, rotation = 0, onSizeChange, onRotationChange, onMove, onPlace, onRemoveReference, onDeleteFile }: {
  noteId: string;
  attachment: SkribAttachment; disabled: boolean; size: InlineAttachmentSize;
  rotation?: number;
  onSizeChange: (size: InlineAttachmentSize) => void;
  onRotationChange?: (rotation: number) => void;
  onMove?: (direction: -1 | 1) => void; onPlace?: () => void; onRemoveReference?: () => void;
  onDeleteFile?: (() => void) | undefined;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [menuLeft, setMenuLeft] = useState(0);
  const visualRef = useRef<HTMLSpanElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const isPhoto = attachment.kind === 'image' || attachment.kind === 'ink';
  const [bounds, setBounds] = useState({ width: 108, height: 132, available: 238 });
  useEffect(() => {
    const visual = visualRef.current;
    if (!visual) return;
    const shell = visual.closest<HTMLElement>('.composer-rich-editor-shell');
    const measure = () => {
      const available = shell?.clientWidth ? Math.max(64, shell.clientWidth - 48) : 238;
      const width = visual.offsetWidth || Math.min({ small: 108, medium: 166, large: 238 }[size], available);
      const height = visual.offsetHeight || width * .75 + 52;
      setBounds((previous) => previous.width === width && previous.height === height && previous.available === available
        ? previous : { width, height, available });
      if (actionsOpen && shell && moreRef.current?.parentElement?.parentElement) {
        const card = moreRef.current.parentElement.parentElement.getBoundingClientRect();
        const page = shell.getBoundingClientRect();
        setMenuLeft(Math.min(0, Math.max(page.left + 16 - card.left, page.right - 16 - card.left - Math.min(192, available))));
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(visual);
    if (shell) observer.observe(shell);
    return () => observer.disconnect();
  }, [size, actionsOpen]);
  const radians = rotation * Math.PI / 180;
  const footprintWidth = Math.abs(Math.cos(radians)) * bounds.width + Math.abs(Math.sin(radians)) * bounds.height;
  const footprintHeight = Math.abs(Math.sin(radians)) * bounds.width + Math.abs(Math.cos(radians)) * bounds.height;
  const scale = Math.min(1, bounds.available / Math.max(1, footprintWidth));
  const cardStyle = {
    '--attachment-angle': `${rotation}deg`, '--attachment-scale': scale,
    '--attachment-available-width': `${bounds.available}px`,
    '--attachment-footprint-width': `${Math.max(108, footprintWidth * scale)}px`,
    '--attachment-footprint-height': `${footprintHeight * scale}px`,
  } as React.CSSProperties;
  const beginDrag = (event: React.DragEvent) => {
    if (disabled) { event.preventDefault(); return; }
    event.dataTransfer.setData(INLINE_ATTACHMENT_MIME, JSON.stringify({ noteId, attachmentId: attachment.id }));
    event.dataTransfer.effectAllowed = 'move';
  };
  const attachmentBlob = attachment.blob;
  useEffect(() => {
    let next: string | null = null;
    try { next = createAttachmentObjectUrl({ blob: attachmentBlob }); } catch { /* Keep the file name readable. */ }
    setUrl(next);
    return () => { if (next) revokeAttachmentObjectUrl(next); };
  }, [attachmentBlob]);
  return (
    <span className={`inline-attachment-object inline-attachment-${attachment.kind}`} data-size={size} style={cardStyle}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActionsOpen(false); }}
      onKeyDown={(event) => { if (event.key === 'Escape' && actionsOpen) { event.preventDefault(); event.stopPropagation(); setActionsOpen(false); moreRef.current?.focus(); } }}>
      <span className="inline-attachment-card-frame">
        <span ref={visualRef} className="inline-attachment-card" draggable={!disabled && attachment.kind !== 'video'} onDragStart={beginDrag}>
          <span className="inline-attachment-preview">
            {isPhoto && url ? <img src={url} alt={attachment.name} draggable={false} />
              : attachment.kind === 'video' && url ? <video src={url} controls preload="metadata" aria-label={attachment.name} />
              : <FileText size={28} aria-hidden="true" />}
          </span>
          <span className="inline-attachment-caption">
            <span className="inline-attachment-name" title={attachment.name}>{attachment.name}</span>
            <span className="inline-attachment-meta">{attachment.name.split('.').pop()?.toUpperCase()} · {formatAttachmentSize(attachment.size)}</span>
          </span>
        </span>
      </span>
      <span className="inline-attachment-controls">
      <button type="button" className="inline-attachment-drag" disabled={disabled} draggable={!disabled}
        aria-label={`Drag ${attachment.name} to another writing position`} title="Drag to move · use Options to move with the keyboard"
        onDragStart={beginDrag}>
        <GripVertical size={15} aria-hidden="true" />
      </button>
      <button ref={moreRef} type="button" className="inline-attachment-more" disabled={disabled}
        aria-label={`Options for ${attachment.name}`} aria-expanded={actionsOpen}
        title="Attachment options" onClick={() => setActionsOpen((open) => !open)}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {onRemoveReference && <button type="button" className="inline-attachment-remove" disabled={disabled}
        aria-label={`Remove ${attachment.name} from text`} title="Remove from text — keep file in attachments"
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => { event.stopPropagation(); onRemoveReference(); }}>
        <X size={13} aria-hidden="true" />
      </button>}
      </span>
      {actionsOpen && <span className="inline-attachment-popover" style={{ left: menuLeft }} role="group" aria-label={`Options for ${attachment.name}`}>
        <span className="inline-attachment-meta">{onRemoveReference
          ? 'Remove from text keeps the saved file. Delete file removes both after confirmation.'
          : 'Drag into your writing to choose a position. Delete file requires confirmation.'}</span>
        {onDeleteFile && <button type="button" disabled={disabled} onClick={onDeleteFile}>Delete saved file…</button>}
        {onPlace && <button type="button" disabled={disabled} onClick={onPlace}>Place at writing cursor</button>}
        <span className="inline-attachment-sizes" role="group" aria-label={isPhoto ? 'Image size' : 'File card size'}>
          {(['small', 'medium', 'large'] as const).map((option) => <button key={option} type="button"
            disabled={disabled} aria-label={`${option} ${isPhoto ? 'image' : 'file card'}`} aria-pressed={size === option}
            onClick={() => onSizeChange(option)}>{option[0]!.toUpperCase()}</button>)}
        </span>
        {onRotationChange && <label className="inline-attachment-rotation">
          <span>Rotate <output>{rotation}°</output></span>
          <input type="range" min={-180} max={180} step={1} value={rotation} disabled={disabled}
            aria-label={`Rotate ${attachment.name}`} onChange={(event) => onRotationChange(Number(event.target.value))} />
          <button type="button" disabled={disabled || rotation === 0} onClick={() => onRotationChange(0)}>Reset rotation</button>
        </label>}
        <span className="inline-attachment-menu-row">
          {onMove && <><button type="button" disabled={disabled} onClick={() => onMove(-1)} aria-label={`Move ${attachment.name} earlier`} title="Move earlier"><ArrowLeft size={15} /></button>
          <button type="button" disabled={disabled} onClick={() => onMove(1)} aria-label={`Move ${attachment.name} later`} title="Move later"><ArrowRight size={15} /></button></>}
          {url && <a href={url} download={attachment.name} aria-label={`Save a copy of ${attachment.name}`} title="Save a copy"><Download size={15} /></a>}
        </span>
      </span>}
    </span>
  );
}
