import React, { useState, useRef, useEffect } from 'react';
import { SkribNote, TargetWindowInfo, calculateAbsolutePosition } from '../../lib/geometry';
import { useSkribStore } from '../../stores/skribStore';

interface SkribNoteCardProps {
  note: SkribNote;
  target: TargetWindowInfo | null;
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
    updateSkribPosition,
    updateSkribText,
    updateSkribColor,
    toggleSkribCollapse,
    deleteSkrib,
    setInteractiveHover,
  } = useSkribStore();

  const [text, setText] = useState(note.text);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

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

  useEffect(() => {
    setText(note.text);
  }, [note.text]);

  const absolutePos = target
    ? calculateAbsolutePosition(target.bounds, note.rel_x, note.rel_y)
    : { x: Math.round(note.rel_x), y: Math.round(note.rel_y) };

  // Debounced text update
  const handleTextChange = (newText: string) => {
    setText(newText);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateSkribText(note.id, newText);
    }, 300);
  };

  const handleBlurText = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    updateSkribText(note.id, text);
  };

  // Dragging logic with requestAnimationFrame
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startRelX: note.rel_x,
      startRelY: note.rel_y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const newRelX = dragStartRef.current.startRelX + dx;
        const newRelY = dragStartRef.current.startRelY + dy;
        updateSkribPosition(note.id, newRelX, newRelY, note.width, note.height);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isDragging, note.id, note.width, note.height, updateSkribPosition]);

  // Resizing logic with requestAnimationFrame
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: note.width,
      startH: note.height,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const dw = e.clientX - resizeStartRef.current.mouseX;
        const dh = e.clientY - resizeStartRef.current.mouseY;
        const newW = Math.max(220, resizeStartRef.current.startW + dw);
        const newH = Math.max(140, resizeStartRef.current.startH + dh);
        updateSkribPosition(note.id, note.rel_x, note.rel_y, newW, newH);
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isResizing, note.id, note.rel_x, note.rel_y, updateSkribPosition]);

  if (note.collapsed) {
    return (
      <div
        className={`skrib-card-collapsed skrib-color-${note.color}`}
        style={{
          position: 'absolute',
          left: `${absolutePos.x}px`,
          top: `${absolutePos.y}px`,
        }}
        onMouseEnter={() => setInteractiveHover(true)}
        onMouseLeave={() => setInteractiveHover(false)}
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
        left: `${absolutePos.x}px`,
        top: `${absolutePos.y}px`,
        width: `${note.width}px`,
        minHeight: `${note.height}px`,
      }}
      onMouseEnter={() => setInteractiveHover(true)}
      onMouseLeave={() => {
        if (!isDragging && !isResizing) {
          setInteractiveHover(false);
        }
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
