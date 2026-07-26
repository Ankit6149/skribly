import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SkribNote, TargetWindowInfo, calculateNoteClientLogicalPosition } from '../../lib/geometry';
import { useLicenseStore } from '../../stores/licenseStore';
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

export const SkribNoteCard: React.FC<SkribNoteCardProps> = ({ note, target }) => {
  const { overlayMetrics, updateSkribPosition, deleteSkrib, setActiveInteractionRect } = useSkribStore();
  const licenseStatus = useLicenseStore((state) => state.status);
  const canWrite = !licenseStatus.enforcementEnabled || licenseStatus.canWrite;
  const { previewNoteId, composerNoteId, openPreview, closePreview, openComposer } = useSkribUiStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
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
  }, [isDragging, isResizing, note.height, note.rel_x, note.rel_y, note.width, setDraftGeometry]);

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
    if (!canWrite || (event.target as HTMLElement).closest('button')) return;
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

    const nextGeometry = (clientX: number, clientY: number): DraftGeometry => {
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
        const next = nextGeometry(event.clientX, event.clientY);
        setDraftGeometry(next);
        const position = target
          ? calculateNoteClientLogicalPosition(target.bounds, overlayMetrics, next.relX, next.relY)
          : { x: Math.round(next.relX), y: Math.round(next.relY) };
        setActiveInteractionRect({
          x: position.x,
          y: position.y,
          width: isPreviewOpen ? Math.round(next.width) : 34,
          height: isPreviewOpen ? Math.round(next.height) : 34,
        });
      });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      const finalGeometry = nextGeometry(event.clientX, event.clientY);
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
    if (!canWrite) return;
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

    const nextGeometry = (clientX: number, clientY: number): DraftGeometry => ({
      ...draftGeometryRef.current,
      width: Math.max(280, resizeStartRef.current.startW + clientX - resizeStartRef.current.mouseX),
      height: Math.max(170, resizeStartRef.current.startH + clientY - resizeStartRef.current.mouseY),
    });

    const handleMouseMove = (event: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const next = nextGeometry(event.clientX, event.clientY);
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
      const finalGeometry = nextGeometry(event.clientX, event.clientY);
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

  const openFromDot = () => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    openPreview(note.id);
  };

  const handleDelete = async () => {
    closePreview();
    await deleteSkrib(note.id);
  };

  if (isComposerOpen) return null;

  if (!isPreviewOpen) {
    return (
      <button
        type="button"
        className={`skrib-dot skrib-color-${note.color} ${isDragging ? 'is-dragging' : ''}`}
        style={{ position: 'absolute', left: `${clientPos.x}px`, top: `${clientPos.y}px` }}
        onMouseDown={beginDrag}
        onClick={openFromDot}
        aria-label={`Open attached note: ${note.text.slice(0, 60) || 'empty note'}`}
        title={note.text.trim().slice(0, 120) || 'Open note'}
      >
        <span className="skrib-dot-core" aria-hidden="true">✎</span>
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
          <span className="skrib-preview-kicker">ATTACHED NOTE</span>
          <strong>{target?.title || note.target_title || note.target_process_name || 'Current application'}</strong>
        </div>
        <div className="skrib-preview-actions">
          <button type="button" onClick={() => openComposer(note.id, 'type')}>Edit</button>
          <button type="button" onClick={closePreview} title="Close into a small note tab">●</button>
          <button type="button" disabled={!canWrite} onClick={() => void handleDelete()} title="Delete note">✕</button>
        </div>
      </header>

      <button type="button" className="skrib-preview-body" onClick={() => openComposer(note.id, 'type')}>
        <p>{note.text || 'Click to write this note.'}</p>
      </button>

      <footer className="skrib-preview-footer">
        <span className="skrib-resize-handle" aria-disabled={!canWrite} onMouseDown={beginResize}>◢</span>
      </footer>
    </article>
  );
};
