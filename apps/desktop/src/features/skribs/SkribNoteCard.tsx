import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SkribNote, TargetWindowInfo, calculateNoteClientLogicalPosition } from '../../lib/geometry';
import { countNoteAttachments, deleteRichContent } from '../../lib/richContentStore';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';

interface SkribNoteCardProps {
  note: SkribNote;
  target: TargetWindowInfo | null;
}

interface DraftGeometry {
  relX: number;
  relY: number;
  width: number;
  height: number;
}

const COLOR_OPTIONS: SkribNote['color'][] = ['yellow', 'peach', 'mint', 'sky', 'lavender'];

export const SkribNoteCard: React.FC<SkribNoteCardProps> = ({ note, target }) => {
  const {
    overlayMetrics,
    updateSkribPosition,
    updateSkribColor,
    deleteSkrib,
    setActiveInteractionRect,
  } = useSkribStore();
  const {
    previewNoteId,
    composerNoteId,
    openPreview,
    closePreview,
    openComposer,
  } = useSkribUiStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [draftGeometry, setDraftGeometryState] = useState<DraftGeometry>({
    relX: note.rel_x,
    relY: note.rel_y,
    width: note.width,
    height: note.height,
  });

  const isPreviewOpen = previewNoteId === note.id;
  const isComposerOpen = composerNoteId === note.id;
  const draftGeometryRef = useRef(draftGeometry);
  const rafIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startRelX: 0, startRelY: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, startW: 0, startH: 0 });

  const setDraftGeometry = useCallback((next: DraftGeometry) => {
    draftGeometryRef.current = next;
    setDraftGeometryState(next);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) return;
    setDraftGeometry({
      relX: note.rel_x,
      relY: note.rel_y,
      width: note.width,
      height: note.height,
    });
  }, [isDragging, isResizing, note.rel_x, note.rel_y, note.width, note.height, setDraftGeometry]);

  useEffect(() => {
    void countNoteAttachments(note.id)
      .then(setAttachmentCount)
      .catch(() => setAttachmentCount(0));
  }, [note.id, isComposerOpen]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      setActiveInteractionRect(null);
    };
  }, [setActiveInteractionRect]);

  const clientPos = target
    ? calculateNoteClientLogicalPosition(
        target.bounds,
        overlayMetrics,
        draftGeometry.relX,
        draftGeometry.relY
      )
    : { x: Math.round(draftGeometry.relX), y: Math.round(draftGeometry.relY) };

  const beginDrag = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    dragMovedRef.current = false;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      startRelX: draftGeometryRef.current.relX,
      startRelY: draftGeometryRef.current.relY,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const calculateDraggedGeometry = (clientX: number, clientY: number): DraftGeometry => {
      const deltaX = clientX - dragStartRef.current.mouseX;
      const deltaY = clientY - dragStartRef.current.mouseY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 4) dragMovedRef.current = true;
      return {
        ...draftGeometryRef.current,
        relX: dragStartRef.current.startRelX + deltaX,
        relY: dragStartRef.current.startRelY + deltaY,
      };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const next = calculateDraggedGeometry(event.clientX, event.clientY);
        setDraftGeometry(next);
        const position = target
          ? calculateNoteClientLogicalPosition(target.bounds, overlayMetrics, next.relX, next.relY)
          : { x: Math.round(next.relX), y: Math.round(next.relY) };
        setActiveInteractionRect({
          x: position.x,
          y: position.y,
          width: isPreviewOpen ? Math.round(next.width) : 48,
          height: isPreviewOpen ? Math.round(next.height) : 48,
        });
      });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      const finalGeometry = calculateDraggedGeometry(event.clientX, event.clientY);
      setDraftGeometry(finalGeometry);
      setIsDragging(false);
      setActiveInteractionRect(null);
      void updateSkribPosition(
        note.id,
        finalGeometry.relX,
        finalGeometry.relY,
        finalGeometry.width,
        finalGeometry.height
      );
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isPreviewOpen, note.id, overlayMetrics, setActiveInteractionRect, setDraftGeometry, target, updateSkribPosition]);

  const beginResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      startW: draftGeometryRef.current.width,
      startH: draftGeometryRef.current.height,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const calculateResizedGeometry = (clientX: number, clientY: number): DraftGeometry => ({
      ...draftGeometryRef.current,
      width: Math.max(260, resizeStartRef.current.startW + clientX - resizeStartRef.current.mouseX),
      height: Math.max(170, resizeStartRef.current.startH + clientY - resizeStartRef.current.mouseY),
    });

    const handleMouseMove = (event: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const next = calculateResizedGeometry(event.clientX, event.clientY);
        setDraftGeometry(next);
        setActiveInteractionRect({
          x: clientPos.x,
          y: clientPos.y,
          width: Math.round(next.width),
          height: Math.round(next.height),
        });
      });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      const finalGeometry = calculateResizedGeometry(event.clientX, event.clientY);
      setDraftGeometry(finalGeometry);
      setIsResizing(false);
      setActiveInteractionRect(null);
      void updateSkribPosition(
        note.id,
        finalGeometry.relX,
        finalGeometry.relY,
        finalGeometry.width,
        finalGeometry.height
      );
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clientPos.x, clientPos.y, isResizing, note.id, setActiveInteractionRect, setDraftGeometry, updateSkribPosition]);

  const openFromDot = async () => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    const count = await countNoteAttachments(note.id).catch(() => 0);
    setAttachmentCount(count);
    if (note.text.length > 280 || count > 0) {
      openComposer(note.id, count > 0 ? 'write' : 'type');
    } else {
      openPreview(note.id);
    }
  };

  const handleDelete = async () => {
    closePreview();
    await deleteSkrib(note.id);
    await deleteRichContent(note.id).catch(() => undefined);
  };

  if (isComposerOpen) return null;

  if (!isPreviewOpen) {
    return (
      <button
        type="button"
        className={`skrib-dot skrib-color-${note.color} ${isDragging ? 'is-dragging' : ''}`}
        style={{ position: 'absolute', left: `${clientPos.x}px`, top: `${clientPos.y}px` }}
        onMouseDown={beginDrag}
        onClick={() => void openFromDot()}
        aria-label={`Open Skrib: ${note.text.slice(0, 60) || 'empty note'}`}
        title={note.text.trim().slice(0, 120) || 'Open Skrib'}
      >
        <span className="skrib-dot-core">S</span>
        {attachmentCount > 0 && <span className="skrib-dot-badge">{attachmentCount}</span>}
      </button>
    );
  }

  return (
    <article
      className={`skrib-preview-card skrib-color-${note.color} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${clientPos.x}px`,
        top: `${clientPos.y}px`,
        width: `${Math.max(280, draftGeometry.width)}px`,
        minHeight: `${Math.max(170, draftGeometry.height)}px`,
      }}
    >
      <header className="skrib-preview-header" onMouseDown={beginDrag}>
        <div>
          <span className="skrib-preview-kicker">{target?.process_name || note.target_process_name || 'CONTEXT NOTE'}</span>
          <strong>{target?.title || note.target_title || 'Skrib'}</strong>
        </div>
        <div className="skrib-preview-actions">
          <button type="button" onClick={() => openComposer(note.id, attachmentCount > 0 ? 'write' : 'type')} title="Edit full note">Edit</button>
          <button type="button" onClick={closePreview} title="Turn into dot">●</button>
          <button type="button" onClick={() => void handleDelete()} title="Delete note">✕</button>
        </div>
      </header>

      <button type="button" className="skrib-preview-body" onClick={() => openComposer(note.id, 'type')}>
        <p>{note.text || 'Click to write this note.'}</p>
        {attachmentCount > 0 && <span>{attachmentCount} attachment{attachmentCount === 1 ? '' : 's'}</span>}
      </button>

      <footer className="skrib-preview-footer">
        <div className="skrib-preview-colors">
          <button type="button" onClick={() => setShowColorPicker((value) => !value)} title="Change colour">◐</button>
          {showColorPicker && (
            <div className="skrib-preview-color-menu">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`composer-color skrib-color-${color} ${note.color === color ? 'active' : ''}`}
                  onClick={() => {
                    void updateSkribColor(note.id, color);
                    setShowColorPicker(false);
                  }}
                  aria-label={`Use ${color}`}
                />
              ))}
            </div>
          )}
        </div>
        <span>Click the note to open the focused editor</span>
        <span className="skrib-resize-handle" onMouseDown={beginResize}>◢</span>
      </footer>
    </article>
  );
};
