import React, { useEffect, useRef } from 'react';
import { useSkribStore } from '../../stores/skribStore';
import { SkribNoteCard } from '../skribs/SkribNoteCard';
import { calculateNoteClientLogicalPosition } from '../../lib/geometry';

export const OverlayHost: React.FC = () => {
  const {
    activeTarget,
    availableWindows,
    skribs,
    overlayMetrics,
    initStatus,
    isPickingTarget,
    isAmbiguous,
    errorMessage,
    clearError,
    setPickingTarget,
    fetchTargetWindows,
    retryOverlayInit,
    bindTarget,
    addSkrib,
    updateHitTestRects,
    initTauri,
  } = useSkribStore();

  const toolbarRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const errorToastRef = useRef<HTMLDivElement>(null);
  const initFailureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void initTauri();
  }, [initTauri]);

  useEffect(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    if (toolbarRef.current) {
      const b = toolbarRef.current.getBoundingClientRect();
      rects.push({
        x: Math.round(b.left),
        y: Math.round(b.top),
        width: Math.round(b.width),
        height: Math.round(b.height),
      });
    }

    if (isPickingTarget && modalRef.current) {
      const b = modalRef.current.getBoundingClientRect();
      rects.push({
        x: Math.round(b.left),
        y: Math.round(b.top),
        width: Math.round(b.width),
        height: Math.round(b.height),
      });
    }

    if (errorMessage && errorToastRef.current) {
      const b = errorToastRef.current.getBoundingClientRect();
      rects.push({
        x: Math.round(b.left),
        y: Math.round(b.top),
        width: Math.round(b.width),
        height: Math.round(b.height),
      });
    }

    if (initStatus.type === 'Failed' && initFailureRef.current) {
      const b = initFailureRef.current.getBoundingClientRect();
      rects.push({
        x: Math.round(b.left),
        y: Math.round(b.top),
        width: Math.round(b.width),
        height: Math.round(b.height),
      });
    }

    skribs.forEach((note) => {
      const clientPos = activeTarget
        ? calculateNoteClientLogicalPosition(activeTarget.bounds, overlayMetrics, note.rel_x, note.rel_y)
        : { x: Math.round(note.rel_x), y: Math.round(note.rel_y) };

      if (note.collapsed) {
        rects.push({ x: clientPos.x, y: clientPos.y, width: 180, height: 32 });
      } else {
        rects.push({
          x: clientPos.x,
          y: clientPos.y,
          width: Math.round(note.width),
          height: Math.round(note.height),
        });
      }
    });

    void updateHitTestRects(rects);
  }, [skribs, activeTarget, overlayMetrics, isPickingTarget, errorMessage, initStatus, updateHitTestRects]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || e.code !== 'Space') return;
      e.preventDefault();

      if (activeTarget) {
        void addSkrib();
        return;
      }

      void fetchTargetWindows().then(() => setPickingTarget(true));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTarget, addSkrib, fetchTargetWindows, setPickingTarget]);

  return (
    <div className="overlay-root">
      {errorMessage && (
        <div ref={errorToastRef} className="overlay-error-toast" role="alert">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      {initStatus.type === 'Failed' && (
        <div ref={initFailureRef} className="overlay-init-failure-banner" role="alert">
          <strong>⚠️ Overlay Positioning Initialization Failed</strong>
          <p>{initStatus.payload}</p>
          <button
            type="button"
            className="toolbar-btn primary-btn"
            onClick={() => void retryOverlayInit()}
          >
            🔄 Retry Overlay Initialization
          </button>
        </div>
      )}

      <header ref={toolbarRef} className="overlay-toolbar">
        <div className="toolbar-brand">
          <span className="brand-logo">🏷️</span>
          <strong>Skribly</strong>
          <span className="brand-badge">WINDOWS EARLY ACCESS</span>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="toolbar-btn primary-btn"
            onClick={() => {
              if (activeTarget) {
                void addSkrib();
              } else {
                void fetchTargetWindows().then(() => setPickingTarget(true));
              }
            }}
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
              onClick={() => void bindTarget(null)}
            >
              ✕ Unbind
            </button>
          )}
        </div>
      </header>

      {isPickingTarget && (
        <div className="target-picker-backdrop">
          <div ref={modalRef} className="target-picker-modal">
            <header className="modal-header">
              <h2>{isAmbiguous ? '⚠️ Multiple Matching Windows Found' : 'Select Application Window to Bind'}</h2>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setPickingTarget(false)}
                aria-label="Close target picker"
              >
                ✕
              </button>
            </header>

            <p className="modal-subtitle">
              {isAmbiguous
                ? 'Multiple candidate windows matched your disconnected note context. Select the correct window.'
                : 'Skribly notes attach to an external window, follow its movement, and return with that context.'}
            </p>

            <div className="window-list">
              {availableWindows.length === 0 ? (
                <div className="no-windows-msg">
                  No external application windows were found. Open Notepad, File Explorer, or another app and refresh.
                </div>
              ) : (
                availableWindows.map((win) => (
                  <button
                    key={win.hwnd_val}
                    type="button"
                    className={`window-item-card ${activeTarget?.hwnd_val === win.hwnd_val ? 'active' : ''}`}
                    onClick={() => void bindTarget(win)}
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
              <button type="button" className="toolbar-btn" onClick={() => void fetchTargetWindows()}>
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

      {(!activeTarget || !activeTarget.is_minimized) &&
        skribs.map((note) => <SkribNoteCard key={note.id} note={note} target={activeTarget} />)}
    </div>
  );
};
