import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SkribNote, TargetWindowInfo, calculateNoteClientLogicalPosition } from '../../lib/geometry';
import { useSkribStore } from '../../stores/skribStore';

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

const COLOR_OPTIONS: Array<{ key: SkribNote['color']; label: string; hex: string }> = [
  { key: 'yellow', label: 'Paper Yellow', hex: '#fde68a' },
  { key: 'peach', label: 'Warm Peach', hex: '#ffd6c6' },
  { key: 'mint', label: 'Soft Mint', hex: '#cdeed9' },
  { key: 'sky', label: 'Clear Sky', hex: '#d6e8ff' },
  { key: 'lavender', label: 'Soft Lavender', hex: '#e6d8ff' },
];

export const SkribNoteCard: React.FC<SkribNoteCardProps> = ({ note, target }) => {
  const {
    overlayMetrics,
    updateSkribPosition,
    updateSkribText,
    updateSkribColor,
    toggleSkribCollapse,
    deleteSkrib,
    setActiveInteractionRect,
  } = useSkribStore();

  const [text, setText] = useState(note.text);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draftGeometry, setDraftGeometryState] = useState<DraftGeometry>({
    relX: note.rel_x,
    relY: note.rel_y,
    width: note.width,
    height: note.height,
  });

  const draftGeometryRef = useRef(draftGeometry);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startRelX: number; startRelY: number }>({
    mouseX: 0,
    mouseY: 0,
    startRelX: 0,
    startRelY: 0,
  });

  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: 0,
    startH: 0,
  });

  const setDraftGeometry = useCallback((next: DraftGeometry) => {
    draftGeometryRef.current = next;
    setDraftGeometryState(next);
  }, []);

  useEffect(() => {
    setText(note.text);
  }, [note.text]);

  useEffect(() => {
    if (isDragging || isResizing) return;
    setDraftGeometry({
      relX: note.rel_x,
      relY: note.rel_y,
      width: note.width,
      height: note.height,
    });
  }, [
    isDragging,
    isResizing,
    note.rel_x,
    note.rel_y,
    note.width,
    note.height,
    setDraftGeometry,
  ]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const clientPos = target
    ? calculateNoteClientLogicalPosition(
        target.bounds,
        overlayMetrics,
        draftGeometry.relX,
        draftGeometry.relY
      )
    : { x: Math.round(draftGeometry.relX), y: Math.round(draftGeometry.relY) };

  const handleTextChange = (newText: string) => {
    setText(newText);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateSkribText(note.id, newText);
    }, 300);
  };

  const handleBlurText = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = null;
    updateSkribText(note.id, text);
  };

  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, textarea')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startRelX: draftGeometryRef.current.relX,
      startRelY: draftGeometryRef.current.relY,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const calculateDraggedGeometry = (clientX: number, clientY: number): DraftGeometry => ({
      ...draftGeometryRef.current,
      relX: dragStartRef.current.startRelX + clientX - dragStartRef.current.mouseX,
      relY: dragStartRef.current.startRelY + clientY - dragStartRef.current.mouseY,
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const nextGeo = calculateDraggedGeometry(e.clientX, e.clientY);
        setDraftGeometry(nextGeo);
        const cPos = target
          ? calculateNoteClientLogicalPosition(target.bounds, overlayMetrics, nextGeo.relX, nextGeo.relY)
          : { x: Math.round(nextGeo.relX), y: Math.round(nextGeo.relY) };
        setActiveInteractionRect({
          x: cPos.x,
          y: cPos.y,
          width: Math.round(nextGeo.width),
          height: Math.round(nextGeo.height),
        });
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      const finalGeometry = calculateDraggedGeometry(e.clientX, e.clientY);
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
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isDragging, note.id, setDraftGeometry, updateSkribPosition]);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: draftGeometryRef.current.width,
      startH: draftGeometryRef.current.height,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const calculateResizedGeometry = (clientX: number, clientY: number): DraftGeometry => ({
      ...draftGeometryRef.current,
      width: Math.max(220, resizeStartRef.current.startW + clientX - resizeStartRef.current.mouseX),
      height: Math.max(140, resizeStartRef.current.startH + clientY - resizeStartRef.current.mouseY),
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const nextGeo = calculateResizedGeometry(e.clientX, e.clientY);
        setDraftGeometry(nextGeo);
        const cPos = target
          ? calculateNoteClientLogicalPosition(target.bounds, overlayMetrics, nextGeo.relX, nextGeo.relY)
          : { x: Math.round(nextGeo.relX), y: Math.round(nextGeo.relY) };
        setActiveInteractionRect({
          x: cPos.x,
          y: cPos.y,
          width: Math.round(nextGeo.width),
          height: Math.round(nextGeo.height),
        });
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      const finalGeometry = calculateResizedGeometry(e.clientX, e.clientY);
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
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isResizing, note.id, setDraftGeometry, updateSkribPosition]);

  if (note.collapsed) {
    return (
      <div
        className={`skrib-card-collapsed skrib-color-${note.color}`}
        style={{
          position: 'absolute',
          left: `${clientPos.x}px`,
          top: `${clientPos.y}px`,
        }}
        onClick={() => toggleSkribCollapse(note.id)}
        title="Click to expand Skrib"
      >
        <span className="collapsed-pin">📌</span>
        <span className="collapsed-text">{note.text.slice(0, 18) || 'Collapsed Skrib'}</span>
      </div>
    );
  }

  return (
    <article
      className={`skrib-card skrib-color-${note.color} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${clientPos.x}px`,
        top: `${clientPos.y}px`,
        width: `${draftGeometry.width}px`,
        minHeight: `${draftGeometry.height}px`,
      }}
    >
      <header className="skrib-header" onMouseDown={handleMouseDownHeader}>
        <div className="skrib-header-title">
          <span className="skrib-drag-grip">⋮⋮</span>
          <strong>{target ? target.process_name : 'Context Note'}</strong>
        </div>

        <div className="skrib-header-actions">
          <button
            type="button"
            className="skrib-action-btn"
            aria-label="Color palette"
            title="Change color"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            🎨
          </button>
          <button
            type="button"
            className="skrib-action-btn"
            aria-label="Collapse Skrib"
            title="Collapse Skrib"
            onClick={() => toggleSkribCollapse(note.id)}
          >
            ➖
          </button>
          <button
            type="button"
            className="skrib-action-btn skrib-delete-btn"
            aria-label="Delete Skrib"
            title="Delete Skrib"
            onClick={() => deleteSkrib(note.id)}
          >
            ✕
          </button>
        </div>

        {showColorPicker && (
          <div className="skrib-color-picker-popover">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`color-swatch swatch-${c.key} ${note.color === c.key ? 'active' : ''}`}
                style={{ backgroundColor: c.hex }}
                title={c.label}
                onClick={() => {
                  updateSkribColor(note.id, c.key);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
        )}
      </header>

      <textarea
        className="skrib-textarea"
        aria-label="Skrib text"
        value={text}
        placeholder="Type thoughts here..."
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlurText}
      />

      <footer className="skrib-footer">
        <span className="skrib-context-badge">
          {target ? `Attached to ${target.title.slice(0, 24)}...` : 'Unbound'}
        </span>
        <span className="skrib-resize-handle" onMouseDown={handleMouseDownResize} title="Resize note">
          ◢
        </span>
      </footer>
    </article>
  );
};
