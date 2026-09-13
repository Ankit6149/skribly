import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  AppWindow,
  ArchiveRestore,
  Code2,
  Folder,
  Globe2,
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
import {
  applicationLabel,
  groupNotesForRail,
  isActiveRailNote,
  isArchivedRailNote,
  railPillCount,
} from './contextRailModel';
import { openNoteHere, openNoteInSavedContext } from './openNoteContext';
import type { OpenNoteProgress } from './openNoteContext';
import { OpeningJourney } from './OpeningJourney';
import { useNativeDrag } from '../../lib/useNativeDrag';

type RailScope = 'context' | 'all' | 'archive';

function noteTitle(note: SkribNote): string {
  const firstLine = note.text.trim().split(/\r?\n/, 1)[0]?.trim();
  return firstLine || note.target_title || applicationLabel(note.target_process_name);
}

function ContextIcon({ processName }: { processName: string }) {
  const process = processName.toLowerCase();
  if (process === 'explorer.exe') return <Folder size={15} aria-hidden="true" />;
  if (process.includes('chrome') || process.includes('edge') || process.includes('firefox')) {
    return <Globe2 size={15} aria-hidden="true" />;
  }
  if (process.includes('code')) return <Code2 size={15} aria-hidden="true" />;
  return <AppWindow size={15} aria-hidden="true" />;
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
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [openingProgress, setOpeningProgress] = useState<OpenNoteProgress | null>(null);
  const refreshGeneration = useRef(0);

  const activeNotes = useMemo(
    () => allNotes.filter(isActiveRailNote),
    [allNotes]
  );
  const archivedNotes = useMemo(() => allNotes.filter(isArchivedRailNote), [allNotes]);
  const activeContextNotes = useMemo(() => contextNotes.filter(isActiveRailNote), [contextNotes]);
  const visibleNotes = scope === 'archive'
    ? archivedNotes
    : scope === 'context'
      ? activeContextNotes
      : activeNotes;
  const allGroups = useMemo(() => groupNotesForRail(visibleNotes), [visibleNotes]);
  const groups = useMemo(
    () => selectedGroupKey
      ? allGroups.filter((group) => group.key === selectedGroupKey)
      : allGroups,
    [allGroups, selectedGroupKey]
  );
  const pillCount = railPillCount(activeNotes.length, contextNotes.length, contextualDock);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const [nextAllNotes, nextContextNotes, nextActiveNoteId] = await Promise.all([
        invoke<SkribNote[]>('get_all_skribs'),
        invoke<SkribNote[]>('get_context_rail_notes'),
        invoke<string | null>('get_open_skrib_note_id'),
      ]);
      if (generation !== refreshGeneration.current) return;
      setAllNotes(nextAllNotes);
      setContextNotes(nextContextNotes);
      setActiveNoteId(nextActiveNoteId);
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

  useEffect(() => {
    setSelectedGroupKey((current) =>
      current && allGroups.some((group) => group.key === current) ? current : null
    );
  }, [allGroups]);

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
    setOpeningProgress({
      phase: 'preparing',
      title: 'Keeping this thought safe…',
      detail: 'Getting ready to return to its saved place.',
    });
    setMessage(null);
    try {
      const result = await openNoteInSavedContext(note, setOpeningProgress);
      setActiveNoteId(note.id);
      setActiveNoteId(note.id);
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
      window.setTimeout(() => setOpeningProgress(null), 260);
    }
  };

  const openHere = async (note: SkribNote) => {
    if (opening.current) return;
    opening.current = true;
    setOpeningId(note.id);
    setMessage(null);
    try {
      await openNoteHere(note);
      setActiveNoteId(note.id);
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

  const restoreArchived = async (note: SkribNote) => {
    if (opening.current) return;
    opening.current = true;
    setOpeningId(note.id);
    setMessage(null);
    try {
      await invoke('restore_archived_skrib_note', { id: note.id });
      await refresh();
      setScope('all');
      setMessage('Returned to active Skribs.');
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
      {openingProgress && <OpeningJourney progress={openingProgress} compact />}
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
          onClick={() => { setScope('context'); setSelectedGroupKey(null); }}
        >
          Here <span>{contextNotes.length}</span>
        </button>
        <button type="button" className={scope === 'all' ? 'active' : ''} onClick={() => { setScope('all'); setSelectedGroupKey(null); }}>
          All <span>{activeNotes.length}</span>
        </button>
        <button type="button" className={scope === 'archive' ? 'active' : ''} onClick={() => { setScope('archive'); setSelectedGroupKey(null); }}>
          Archive <span>{archivedNotes.length}</span>
        </button>
      </nav>

      <nav className="context-rail-contexts" aria-label="Contexts containing Skribs">
          <button
            type="button"
            className={selectedGroupKey === null ? 'active' : ''}
            onClick={() => setSelectedGroupKey(null)}
            aria-label={`Show all ${scope === 'archive' ? 'archived' : 'active'} contexts`}
          >
            <span className="context-rail-context-icon"><StickyNote size={15} aria-hidden="true" /></span>
            <small>All</small>
            <i>{visibleNotes.length}</i>
          </button>
          {allGroups.map((group) => (
            <button
              type="button"
              key={group.key}
              className={selectedGroupKey === group.key ? 'active' : ''}
              onClick={() => setSelectedGroupKey(group.key)}
              aria-label={`Show ${group.notes.length} ${group.label} Skribs`}
              title={`${group.label} · ${group.notes.length} ${group.notes.length === 1 ? 'Skrib' : 'Skribs'}`}
            >
              <span className="context-rail-context-icon">
                <ContextIcon processName={group.notes[0]?.target_process_name ?? group.key} />
              </span>
              <small>{group.label}</small>
              <i>{group.notes.length}</i>
            </button>
          ))}
      </nav>

      <div className="context-rail-body">
        {loading ? (
          <div className="context-rail-empty" role="status">Reading notes…</div>
        ) : groups.length === 0 ? (
          <div className="context-rail-empty">
            {scope === 'archive'
              ? 'Completed Skribs will wait safely here.'
              : scope === 'context'
                ? 'No Skribs on this screen yet. Press Ctrl + Shift + Space to add one.'
                : 'Press Ctrl + Shift + Space to add your first Skrib.'}
          </div>
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
                    <article className={`context-rail-note ${activeNoteId === note.id ? 'active' : ''}`} key={note.id} aria-busy={openingId === note.id}>
                      <i className={`skrib-color-${note.color}`} aria-hidden="true" />
                      <button
                        type="button"
                        className="context-rail-note-open"
                        onClick={() => void (scope === 'archive' ? restoreArchived(note) : openHere(note))}
                        disabled={openingId !== null}
                        title={scope === 'archive' ? 'Return this Skrib to active notes' : 'Read this Skrib right here'}
                        aria-label={scope === 'archive' ? `Restore ${noteTitle(note)}` : `Open ${noteTitle(note)} here`}
                      >
                        <span className="context-rail-note-copy">
                          <strong>{noteTitle(note)}</strong>
                          <small><MapPin size={11} aria-hidden="true" /> {note.target_title || applicationLabel(note.target_process_name)}</small>
                        </span>
                        <span className="context-rail-note-action-icon" aria-hidden="true">
                          {openingId === note.id
                            ? <LoaderCircle className="rail-opening-spinner" size={16} />
                            : scope === 'archive'
                              ? <ArchiveRestore size={16} strokeWidth={1.9} />
                              : <StickyNote size={16} strokeWidth={1.9} />}
                        </span>
                      </button>
                      {scope !== 'archive' && <button
                        type="button"
                        className="context-rail-note-location"
                        onClick={() => void openContext(note)}
                        disabled={openingId !== null}
                        title="Open the saved screen, or the app home if that screen changed"
                        aria-label={`Open ${noteTitle(note)} in its app or saved screen`}
                      >
                        <MapPinned size={16} strokeWidth={1.9} aria-hidden="true" />
                      </button>}
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
