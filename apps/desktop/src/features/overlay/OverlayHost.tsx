import React, { useEffect, useRef } from 'react';
import { useSkribStore } from '../../stores/skribStore';
import { SkribNoteCard } from '../skribs/SkribNoteCard';
import { calculateAbsolutePosition } from '../../lib/geometry';

export const OverlayHost: React.FC = () => {
  const {
    activeTarget,
    availableWindows,
    skribs,
    isPickingTarget,
    isAmbiguous,
    errorMessage,
    clearError,
    setPickingTarget,
    fetchTargetWindows,
    bindTarget,
    addSkrib,
    updateHitTestRects,
    initTauri,
  } = useSkribStore();

  const toolbarRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initTauri();
  }, [initTauri]);

  // Synchronize interactive bounding boxes to Rust for native WM_NCHITTEST
  useEffect(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    // Toolbar rect
    if (toolbarRef.current) {
      const b = toolbarRef.current.getBoundingClientRect();
      rects.push({ x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) });
    }

    // Modal rect
    if (isPickingTarget && modalRef.current) {
      const b = modalRef.current.getBoundingClientRect();
      rects.push({ x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) });
    }

    // Skrib note rects
    skribs.forEach((note) => {
      if (note.collapsed) {
        const absPos = activeTarget
          ? calculateAbsolutePosition(activeTarget.bounds, note.rel_x, note.rel_y)
          : { x: Math.round(note.rel_x), y: Math.round(note.rel_y) };
        rects.push({ x: absPos.x, y: absPos.y, width: 180, height: 32 });
      } else {
        const absPos = activeTarget
          ? calculateAbsolutePosition(activeTarget.bounds, note.rel_x, note.rel_y)
          : { x: Math.round(note.rel_x), y: Math.round(note.rel_y) };
        rects.push({ x: absPos.x, y: absPos.y, width: Math.round(note.width), height: Math.round(note.height) });
      }
    });

    updateHitTestRects(rects);
  }, [skribs, activeTarget, isPickingTarget, updateHitTestRects]);

  // Keyboard shortcut listener (in-window convenience shortcut)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        addSkrib();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addSkrib]);

  return (
    <div className="overlay-root">
      {/* Error Alert Toast */}
      {errorMessage && (
        <div className="overlay-error-toast">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={clearError}>✕</button>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <header ref={toolbarRef} className="overlay-toolbar">
        <div className="toolbar-brand">
          <span className="brand-logo">🏷️</span>
          <strong>Skribly</strong>
          <span className="brand-badge">WIN32 OVERLAY REPAIRED</span>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="toolbar-btn primary-btn"
            onClick={() => addSkrib()}
            title="Create new Skrib note (Ctrl+Shift+Space)"
          >
            ➕ New Skrib
          </button>

          <button
            type="button"
            className="toolbar-btn target-btn"
            onClick={async () => {
              await fetchTargetWindows();
              setPickingTarget(true);
            }}
          >
            🎯 {activeTarget ? activeTarget.process_name : 'Bind Target App'}
          </button>

          {activeTarget && (
            <button
              type="button"
              className="toolbar-btn clear-btn"
              title="Unbind active window target"
              onClick={() => bindTarget(null)}
            >
              ✕ Unbind
            </button>
          )}
        </div>
      </header>

      {/* Target Window Picker Dialog */}
      {isPickingTarget && (
        <div className="target-picker-backdrop">
          <div ref={modalRef} className="target-picker-modal">
            <header className="modal-header">
              <h2>{isAmbiguous ? '⚠️ Multiple Matching Windows Found' : 'Select Application Window to Bind'}</h2>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setPickingTarget(false)}
              >
                ✕
              </button>
            </header>

            <p className="modal-subtitle">
              {isAmbiguous
                ? 'Multiple candidate windows matched your disconnected note context. Please select which window to bind to.'
                : 'Skribly sticky notes attach to this external window, follow its movement, and restore with its context.'}
            </p>

            <div className="window-list">
              {availableWindows.length === 0 ? (
                <div className="no-windows-msg">
                  No active external application windows found. Open Notepad, File Explorer, or another app and click Refresh.
                </div>
              ) : (
                availableWindows.map((win) => (
                  <button
                    key={win.hwnd_val}
                    type="button"
                    className={`window-item-card ${activeTarget?.hwnd_val === win.hwnd_val ? 'active' : ''}`}
                    onClick={() => bindTarget(win)}
                  >
                    <div className="window-icon">🪟</div>
                    <div className="window-details">
                      <strong>{win.process_name}</strong>
                      <span className="window-title">{win.title || 'Untitled Window'}</span>
                      <span className="window-bounds">
                        {win.bounds.width}x{win.bounds.height} @ ({win.bounds.x}, {win.bounds.y})
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => fetchTargetWindows()}
              >
                🔄 Refresh Window List
              </button>
              <button
                type="button"
                className="toolbar-btn primary-btn"
                onClick={() => setPickingTarget(false)}
              >
                Done
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Render Active Skrib Sticky Notes */}
      {(!activeTarget || !activeTarget.is_minimized) &&
        skribs.map((note) => (
          <SkribNoteCard key={note.id} note={note} target={activeTarget} />
        ))}
    </div>
  );
};

