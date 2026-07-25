import React, { useEffect, useRef, useState } from 'react';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import { SkribNoteCard } from '../skribs/SkribNoteCard';
import { SkribComposer } from '../skribs/SkribComposer';
import { NotesWidget } from '../skribs/NotesWidget';
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
    activeInteractionRect,
    clearError,
    setPickingTarget,
    fetchTargetWindows,
    retryOverlayInit,
    bindTarget,
    addSkrib,
    updateHitTestRects,
    initTauri,
  } = useSkribStore();
  const {
    previewNoteId,
    composerNoteId,
    composerMode,
    isNotesWidgetOpen,
    openComposer,
  } = useSkribUiStore();

  const toolbarRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const errorToastRef = useRef<HTMLDivElement>(null);
  const initFailureRef = useRef<HTMLDivElement>(null);
  const initialSnapshotTakenRef = useRef(false);
  const knownNoteIdsRef = useRef<Set<string>>(new Set());
  const [uiBoundsVersion, setUiBoundsVersion] = useState(0);

  useEffect(() => {
    void initTauri();
  }, [initTauri]);

  useEffect(() => {
    if (initStatus.type === 'Initializing') return;
    if (!initialSnapshotTakenRef.current) {
      knownNoteIdsRef.current = new Set(skribs.map((note) => note.id));
      initialSnapshotTakenRef.current = true;
      return;
    }

    const created = skribs.find((note) => !knownNoteIdsRef.current.has(note.id));
    knownNoteIdsRef.current = new Set(skribs.map((note) => note.id));
    if (created) openComposer(created.id, 'type');
  }, [initStatus.type, openComposer, skribs]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setUiBoundsVersion((value) => value + 1);
    });
    const elements = [
      document.querySelector<HTMLElement>('.skrib-composer'),
      document.querySelector<HTMLElement>('.notes-widget'),
    ].filter((element): element is HTMLElement => Boolean(element));
    elements.forEach((element) => observer.observe(element));
    setUiBoundsVersion((value) => value + 1);
    return () => observer.disconnect();
  }, [composerMode, composerNoteId, isNotesWidgetOpen]);

  const createNewSkrib = async () => {
    if (!activeTarget) {
      await fetchTargetWindows();
      setPickingTarget(true);
      return;
    }

    const before = new Set(useSkribStore.getState().skribs.map((note) => note.id));
    await addSkrib('', 'yellow');
    const created = useSkribStore.getState().skribs.find((note) => !before.has(note.id));
    if (created) openComposer(created.id, 'type');
  };

  useEffect(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const fixedUiElements: Array<HTMLElement | null> = [
      toolbarRef.current,
      errorToastRef.current,
      initFailureRef.current,
      document.querySelector<HTMLElement>('.skrib-composer'),
      document.querySelector<HTMLElement>('.notes-widget'),
    ];

    fixedUiElements
      .filter((element): element is HTMLElement => Boolean(element))
      .forEach((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0) {
          rects.push({
            x: Math.round(bounds.left),
            y: Math.round(bounds.top),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          });
        }
      });

    if (isPickingTarget && modalRef.current) {
      const bounds = modalRef.current.getBoundingClientRect();
      rects.push({
        x: Math.round(bounds.left),
        y: Math.round(bounds.top),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      });
    }

    skribs.forEach((note) => {
      if (composerNoteId === note.id) return;
      const clientPos = activeTarget
        ? calculateNoteClientLogicalPosition(activeTarget.bounds, overlayMetrics, note.rel_x, note.rel_y)
        : { x: Math.round(note.rel_x), y: Math.round(note.rel_y) };

      if (previewNoteId === note.id) {
        rects.push({
          x: clientPos.x,
          y: clientPos.y,
          width: Math.round(Math.max(280, note.width)),
          height: Math.round(Math.max(170, note.height)),
        });
      } else {
        rects.push({ x: clientPos.x, y: clientPos.y, width: 48, height: 48 });
      }
    });

    if (activeInteractionRect) rects.push(activeInteractionRect);
    void updateHitTestRects(rects);
  }, [
    activeInteractionRect,
    activeTarget,
    composerMode,
    composerNoteId,
    errorMessage,
    initStatus,
    isNotesWidgetOpen,
    isPickingTarget,
    overlayMetrics,
    previewNoteId,
    skribs,
    uiBoundsVersion,
    updateHitTestRects,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.code !== 'Space') return;
      event.preventDefault();
      void createNewSkrib();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const composerNote = composerNoteId
    ? skribs.find((note) => note.id === composerNoteId) ?? null
    : null;

  return (
    <div className="overlay-root">
      {errorMessage && (
        <div ref={errorToastRef} className="overlay-error-toast" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={clearError} aria-label="Dismiss error">✕</button>
        </div>
      )}

      {initStatus.type === 'Failed' && (
        <div ref={initFailureRef} className="overlay-init-failure-banner" role="alert">
          <strong>Overlay could not start safely</strong>
          <p>{initStatus.payload}</p>
          <button type="button" className="toolbar-btn primary-btn" onClick={() => void retryOverlayInit()}>
            Retry overlay
          </button>
        </div>
      )}

      <header ref={toolbarRef} className="overlay-toolbar compact-toolbar">
        <div className="toolbar-brand">
          <span className="brand-logo">S</span>
          <strong>Skribly</strong>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="toolbar-btn primary-btn" onClick={() => void createNewSkrib()} title="Ctrl+Shift+Space">
            ＋ New
          </button>
          <button
            type="button"
            className="toolbar-btn target-btn"
            onClick={async () => {
              await fetchTargetWindows();
              setPickingTarget(true);
            }}
          >
            {activeTarget ? activeTarget.process_name : 'Choose app'}
          </button>
          {activeTarget && (
            <button type="button" className="toolbar-btn clear-btn" onClick={() => void bindTarget(null)} title="Unbind current app">
              Unbind
            </button>
          )}
        </div>
      </header>

      {isPickingTarget && (
        <div className="target-picker-backdrop">
          <div ref={modalRef} className="target-picker-modal">
            <header className="modal-header">
              <div>
                <span className="modal-kicker">PLACE A NOTE IN CONTEXT</span>
                <h2>{isAmbiguous ? 'Choose the matching window' : 'Which app should this belong to?'}</h2>
              </div>
              <button type="button" className="close-modal-btn" onClick={() => setPickingTarget(false)} aria-label="Close target picker">✕</button>
            </header>
            <p className="modal-subtitle">
              Skribly will keep the note attached to this window and bring it back with the same context.
            </p>
            <div className="window-list">
              {availableWindows.length === 0 ? (
                <div className="no-windows-msg">Open the app you want to annotate, then refresh this list.</div>
              ) : (
                availableWindows.map((win) => (
                  <button
                    key={win.hwnd_val}
                    type="button"
                    className={`window-item-card ${activeTarget?.hwnd_val === win.hwnd_val ? 'active' : ''}`}
                    onClick={async () => {
                      await bindTarget(win);
                      await createNewSkrib();
                    }}
                  >
                    <div className="window-icon">{win.process_name.slice(0, 1).toUpperCase()}</div>
                    <div className="window-details">
                      <strong>{win.process_name}</strong>
                      <span className="window-title">{win.title || 'Untitled Window'}</span>
                    </div>
                    <span className="window-select-arrow">›</span>
                  </button>
                ))
              )}
            </div>
            <footer className="modal-footer">
              <button type="button" className="toolbar-btn" onClick={() => void fetchTargetWindows()}>Refresh</button>
              <button type="button" className="toolbar-btn" onClick={() => setPickingTarget(false)}>Cancel</button>
            </footer>
          </div>
        </div>
      )}

      {(!activeTarget || !activeTarget.is_minimized) &&
        skribs.map((note) => <SkribNoteCard key={note.id} note={note} target={activeTarget} />)}

      {composerNote && <SkribComposer note={composerNote} target={activeTarget} />}
      <NotesWidget visibleNotes={skribs} />
    </div>
  );
};
