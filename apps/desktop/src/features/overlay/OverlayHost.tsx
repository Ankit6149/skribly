import React, { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import { SkribNoteCard } from '../skribs/SkribNoteCard';
import { SkribComposer } from '../skribs/SkribComposer';
import { calculateNoteClientLogicalPosition } from '../../lib/geometry';

export const OverlayHost: React.FC = () => {
  const {
    activeTarget,
    skribs,
    overlayMetrics,
    initStatus,
    isPickingTarget,
    isTauriAvailable,
    errorMessage,
    activeInteractionRect,
    clearError,
    setPickingTarget,
    retryOverlayInit,
    updateHitTestRects,
    initTauri,
  } = useSkribStore();
  const { previewNoteId, composerNoteId, openComposer } = useSkribUiStore();

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
    if (typeof ResizeObserver === 'undefined') {
      setUiBoundsVersion((value) => value + 1);
      return;
    }

    const observer = new ResizeObserver(() => {
      setUiBoundsVersion((value) => value + 1);
    });
    const composer = document.querySelector<HTMLElement>('.skrib-composer');
    if (composer) observer.observe(composer);
    setUiBoundsVersion((value) => value + 1);
    return () => observer.disconnect();
  }, [composerNoteId]);

  useEffect(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    [errorToastRef.current, initFailureRef.current, document.querySelector<HTMLElement>('.skrib-composer')]
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

    skribs.forEach((note) => {
      if (composerNoteId === note.id) return;
      const clientPos = activeTarget
        ? calculateNoteClientLogicalPosition(activeTarget.bounds, overlayMetrics, note.rel_x, note.rel_y)
        : { x: Math.round(note.rel_x), y: Math.round(note.rel_y) };

      rects.push(
        previewNoteId === note.id
          ? {
              x: clientPos.x,
              y: clientPos.y,
              width: Math.round(Math.max(280, note.width)),
              height: Math.round(Math.max(170, note.height)),
            }
          : { x: clientPos.x, y: clientPos.y, width: 34, height: 34 }
      );
    });

    if (activeInteractionRect) rects.push(activeInteractionRect);
    void updateHitTestRects(rects);
  }, [
    activeInteractionRect,
    activeTarget,
    composerNoteId,
    errorMessage,
    initStatus,
    isPickingTarget,
    overlayMetrics,
    previewNoteId,
    skribs,
    uiBoundsVersion,
    updateHitTestRects,
  ]);

  useEffect(() => {
    if (!isTauriAvailable) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || composerNoteId || previewNoteId) return;
      event.preventDefault();
      void getCurrentWindow().hide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [composerNoteId, isTauriAvailable, previewNoteId]);

  const composerNote = composerNoteId
    ? skribs.find((note) => note.id === composerNoteId) ?? null
    : null;
  const message = errorMessage || (isPickingTarget
    ? 'Open the application you want to annotate, click it once, then press Ctrl + Shift + Space again.'
    : null);

  return (
    <div className="overlay-root">
      {message && (
        <div ref={errorToastRef} className="overlay-error-toast" role="alert">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => {
              clearError();
              setPickingTarget(false);
            }}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {initStatus.type === 'Failed' && (
        <div ref={initFailureRef} className="overlay-init-failure-banner" role="alert">
          <div>
            <strong>Skribli could not start safely.</strong>
            <p>{initStatus.payload}</p>
          </div>
          <button type="button" onClick={() => void retryOverlayInit()}>Retry</button>
        </div>
      )}

      {(!activeTarget || !activeTarget.is_minimized) &&
        skribs.map((note) => <SkribNoteCard key={note.id} note={note} target={activeTarget} />)}

      {composerNote && <SkribComposer note={composerNote} target={activeTarget} />}
    </div>
  );
};
