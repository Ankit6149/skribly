import React, { useEffect, useRef } from 'react';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';
import { SkribComposer } from '../skribs/SkribComposer';

export const OverlayHost: React.FC = () => {
  const { activeTarget, skribs, initStatus, initTauri } = useSkribStore();
  const { composerNoteId, openComposer } = useSkribUiStore();

  const initialSnapshotTakenRef = useRef(false);
  const knownNoteIdsRef = useRef<Set<string>>(new Set());

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

  const composerNote = composerNoteId
    ? skribs.find((note) => note.id === composerNoteId) ?? null
    : null;

  if (!composerNote) return null;

  return <SkribComposer note={composerNote} target={activeTarget} />;
};
