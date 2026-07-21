import React, { useEffect } from 'react';
import { useSkribStore } from '../../stores/skribStore';
import { SkribNoteCard } from '../skribs/SkribNoteCard';

export const OverlayHost: React.FC = () => {
  const {
    activeTarget,
    availableWindows,
    skribs,
    isPickingTarget,
    setPickingTarget,
    fetchTargetWindows,
    bindTarget,
    addSkrib,
    setInteractiveHover,
    initTauri,
  } = useSkribStore();

  useEffect(() => {
    initTauri();
  }, [initTauri]);

  // Global shortcut listener (e.g. Ctrl+Shift+Space)
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
      {/* Top Floating Control Bar */}
      <header
        className="overlay-toolbar"
        onMouseEnter={() => setInteractiveHover(true)}
        onMouseLeave={() => setInteractiveHover(false)}
      >
        <div className="toolbar-brand">
          <span className="brand-logo">🏷️</span>
          <strong>Skribly</strong>
          <span className="brand-badge">WIN32 OVERLAY SPIKE</span>
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
        <div
          className="target-picker-backdrop"
          onMouseEnter={() => setInteractiveHover(true)}
          onMouseLeave={() => setInteractiveHover(false)}
        >
          <div className="target-picker-modal">
            <header className="modal-header">
              <h2>Select Application Window to Bind</h2>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setPickingTarget(false)}
              >
                ✕
              </button>
            </header>

            <p className="modal-subtitle">
              Skribly sticky notes will attach to this external window, follow its movement, and restore with its context.
            </p>

            <div className="window-list">
              {availableWindows.length === 0 ? (
                <div className="no-windows-msg">
                  No active external application windows found. Open Notepad, File Explorer, or another app and click Refresh.
                </div>
              ) : (
                availableWindows.map((win) => (
                  <button
                    key={win.hwnd_id}
                    type="button"
                    className={`window-item-card ${activeTarget?.hwnd_id === win.hwnd_id ? 'active' : ''}`}
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
