import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  AppWindow,
  GripVertical,
  MapPin,
  MapPinned,
  PanelRightClose,
  RefreshCw,
  StickyNote,
  LoaderCircle,
} from 'lucide-react';
import type { SkribNote } from '../../lib/geometry';
import '../../styles/context-rail.css';
import skribliLogo from '../../../src-tauri/icons/128x128.png';
import { applicationLabel, groupNotesForRail, railPillCount } from './contextRailModel';
import { openNoteHere, openNoteInSavedContext } from './openNoteContext';
import { useNativeDrag } from '../../lib/useNativeDrag';

type RailScope = 'context' | 'all';

function noteTitle(note: SkribNote): string {
  const firstLine = note.text.trim().split(/\r?\n/, 1)[0]?.trim();
  return firstLine || note.target_title || applicationLabel(note.target_process_name);
}

export const ContextRail: React.FC = () => {
  const [allNotes, setAllNotes] = useState<SkribNote[]>([]);
  const [contextNotes, setContextNotes] = useState<SkribNote[]>([]);
  const [scope, setScope] = useState<RailScope>('context');
  const [contextualDock, setContextualDock] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const opening = useRef(false);
  const resizing = useRef(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const refreshGeneration = useRef(0);

  const activeNotes = useMemo(
    () => allNotes.filter((note) => note.deleted_at == null),
    [allNotes]
  );
  const visibleNotes = scope === 'context' && contextNotes.length > 0 ? contextNotes : activeNotes;
  const groups = useMemo(() => groupNotesForRail(visibleNotes), [visibleNotes]);
  const pillCount = railPillCount(activeNotes.length, contextNotes.length, contextualDock);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const [nextAllNotes, nextContextNotes] = await Promise.all([
        invoke<SkribNote[]>('get_all_skribs'),
        invoke<SkribNote[]>('get_context_rail_notes'),
      ]);
      if (generation !== refreshGeneration.current) return;
      setAllNotes(nextAllNotes);
      setContextNotes(nextContextNotes);
      setScope((current) => nextContextNotes.length > 0 ? current : 'all');
    } catch (reason) {
      if (generation === refreshGeneration.current) setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscriptions = [
      listen('skribly://overlay-update', () => void refresh()),
      listen('skribly://rich-content-updated', () => void refresh()),
      listen('skribly://context-rail-refresh', () => {
        setContextualDock(true);
        void refresh();
      }),
      listen('skribly://global-rail-refresh', () => {
        setContextualDock(false);
        void refresh();
      }),
    ];
    return () => {
      void Promise.all(subscriptions).then((unlisten) => unlisten.forEach((dispose) => dispose()));
    };
  }, [refresh]);

  const toggleCollapsed = async () => {
    if (resizing.current || opening.current) return;
    resizing.current = true;
    const next = !collapsed;
    setMessage(null);
    try {
      await invoke('set_context_rail_expanded', {
        expanded: !next,
        contextual: contextualDock,
        noteCount: visibleNotes.length,
      });
      setCollapsed(next);
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      resizing.current = false;
    }
  };

  const pillDrag = useNativeDrag(() => void toggleCollapsed(), (reason) => setMessage(String(reason)));

  const openContext = async (note: SkribNote) => {
    if (opening.current) return;
    opening.current = true;
    setOpeningId(note.id);
    setMessage(null);
    try {
      const result = await openNoteInSavedContext(note);
      await invoke('set_context_rail_expanded', {
        expanded: true,
        contextual: contextualDock,
        noteCount: visibleNotes.length,
      });
      setCollapsed(false);
      setMessage(result);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      opening.current = false;
      setOpeningId(null);
    }
  };

  const openHere = async (note: SkribNote) => {
    if (opening.current) return;
    opening.current = true;
    setOpeningId(note.id);
    setMessage(null);
    try {
      await openNoteHere(note);
      setContextualDock(false);
      await invoke('set_context_rail_expanded', {
        expanded: true,
        contextual: false,
        noteCount: visibleNotes.length,
      });
      setCollapsed(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      opening.current = false;
      setOpeningId(null);
    }
  };

  if (collapsed) {
    return (
      <main className="context-rail collapsed">
        <button
          type="button"
          className="context-rail-pill"
          {...pillDrag}
          aria-label={`Open My Skribs rail with ${pillCount} notes`}
          title={message || `Click once to open your ${pillCount} Skribs. Double-click, then drag me anywhere; I'll tuck back to the nearest edge.`}
        >
          <span className="context-rail-pill-sheet context-rail-pill-sheet-back" aria-hidden="true" />
          <span className="context-rail-pill-sheet context-rail-pill-sheet-middle" aria-hidden="true" />
          <span className="context-rail-pill-sheet context-rail-pill-sheet-front" aria-hidden="true">
            <StickyNote size={15} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span className="context-rail-pill-count">{pillCount > 99 ? '99+' : pillCount}</span>
        </button>
      </main>
    );
  }

  return (
    <main className="context-rail expanded">
      <header className="context-rail-header" data-tauri-drag-region>
        <span className="context-rail-heading" data-tauri-drag-region>
          <GripVertical className="context-rail-grip" size={15} aria-hidden="true" />
          <img className="context-rail-brand-mark" src={skribliLogo} alt="" aria-hidden="true" />
          <span data-tauri-drag-region>
            <strong data-tauri-drag-region>My Skribs</strong>
            <small data-tauri-drag-region>{activeNotes.length} saved locally</small>
          </span>
        </span>
        <span className="context-rail-actions">
          <button type="button" onClick={() => void refresh()} aria-label="Refresh notes" title="Bring in anything new">
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => void toggleCollapsed()} aria-label="Collapse note rail" title="Tuck My Skribs back to the edge">
            <PanelRightClose size={14} aria-hidden="true" />
          </button>
        </span>
      </header>

      <nav className="context-rail-tabs" aria-label="Note rail scope">
        <button
          type="button"
          className={scope === 'context' ? 'active' : ''}
          disabled={contextNotes.length === 0}
          onClick={() => setScope('context')}
        >
          Here <span>{contextNotes.length}</span>
        </button>
        <button type="button" className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
          All <span>{activeNotes.length}</span>
        </button>
      </nav>

      <div className="context-rail-body">
        {loading ? (
          <div className="context-rail-empty" role="status">Reading notes…</div>
        ) : groups.length === 0 ? (
          <div className="context-rail-empty">Use Ctrl + Shift + Space to add a Skrib here.</div>
        ) : (
          <div className="context-rail-list" aria-label="Saved notes">
            {groups.map((group) => (
              <section className="context-rail-group" key={group.key} aria-label={`${group.label} notes`}>
                <div className="context-rail-group-heading">
                  <span><AppWindow size={11} aria-hidden="true" /> {group.label}</span>
                  <small>
                    {group.notes.length}{' '}
                    {scope === 'context' ? 'here' : group.notes.length === 1 ? 'note' : 'notes'}
                  </small>
                </div>
                <div className="context-rail-group-notes">
                  {group.notes.map((note) => (
                    <article className="context-rail-note" key={note.id} aria-busy={openingId === note.id}>
                      <i className={`skrib-color-${note.color}`} aria-hidden="true" />
                      <button
                        type="button"
                        className="context-rail-note-open"
                        onClick={() => void openHere(note)}
                        disabled={openingId !== null}
                        title="Read this Skrib right here"
                        aria-label={`Open ${noteTitle(note)} here`}
                      >
                        <span className="context-rail-note-copy">
                          <strong>{noteTitle(note)}</strong>
                          <small><MapPin size={11} aria-hidden="true" /> {note.target_title || applicationLabel(note.target_process_name)}</small>
                        </span>
                        <span className="context-rail-note-action-icon" aria-hidden="true">
                          {openingId === note.id ? <LoaderCircle className="rail-opening-spinner" size={16} /> : <StickyNote size={16} strokeWidth={1.9} />}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="context-rail-note-location"
                        onClick={() => void openContext(note)}
                        disabled={openingId !== null}
                        title="Take me back to where this Skrib began"
                        aria-label={`Open ${noteTitle(note)} at its saved location`}
                      >
                        <MapPinned size={16} strokeWidth={1.9} aria-hidden="true" />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {message && <div className="context-rail-message" role="status">{message}</div>}
      </div>
    </main>
  );
};
