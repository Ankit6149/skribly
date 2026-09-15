import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  AppWindow, ArchiveRestore, ChevronLeft, Code2, Folder, Globe2, GripHorizontal,
  LoaderCircle, MapPin, MapPinned, MoreHorizontal, Search, StickyNote,
} from 'lucide-react';
import type { SkribNote } from '../../lib/geometry';
import '../../styles/context-rail.css';
import skribliLogo from '../../../src-tauri/icons/128x128.png';
import {
  applicationLabel, groupNotesForRail, isActiveRailNote, isArchivedRailNote, railPillCount,
} from './contextRailModel';
import { openNoteHere, openNoteInSavedContext } from './openNoteContext';
import type { OpenNoteProgress } from './openNoteContext';
import { OpeningJourney } from './OpeningJourney';
import { useNativeDrag } from '../../lib/useNativeDrag';

type RailScope = 'context' | 'all' | 'archive';
const RIBBON_LIMIT = 5;
const nativeRuntimeAvailable = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function noteTitle(note: SkribNote): string {
  const firstLine = note.text.trim().split(/\r?\n/, 1)[0]?.trim();
  return firstLine || note.target_title || applicationLabel(note.target_process_name);
}

function ContextIcon({ processName }: { processName: string }) {
  const process = processName.toLowerCase();
  if (process === 'explorer.exe') return <Folder size={14} aria-hidden="true" />;
  if (process.includes('chrome') || process.includes('edge') || process.includes('firefox')) {
    return <Globe2 size={14} aria-hidden="true" />;
  }
  if (process.includes('code')) return <Code2 size={14} aria-hidden="true" />;
  return <AppWindow size={14} aria-hidden="true" />;
}

function scopeLabel(scope: RailScope): string {
  if (scope === 'context') return 'Here';
  if (scope === 'archive') return 'Archived';
  return 'Everything';
}

export const ContextRail: React.FC<{ contextual: boolean }> = ({ contextual }) => {
  const previewContextual = !nativeRuntimeAvailable && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('railMode') === 'context';
  const contextualDock = contextual || previewContextual;
  const [allNotes, setAllNotes] = useState<SkribNote[]>([]);
  const [contextNotes, setContextNotes] = useState<SkribNote[]>([]);
  const [scope, setScope] = useState<RailScope>(contextualDock ? 'context' : 'all');
  const [collapsed, setCollapsed] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllRibbons, setShowAllRibbons] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const opening = useRef(false);
  const resizing = useRef(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [openingProgress, setOpeningProgress] = useState<OpenNoteProgress | null>(null);
  const refreshGeneration = useRef(0);

  const activeNotes = useMemo(() => allNotes.filter(isActiveRailNote), [allNotes]);
  const archivedNotes = useMemo(() => allNotes.filter(isArchivedRailNote), [allNotes]);
  const activeContextNotes = useMemo(() => contextNotes.filter(isActiveRailNote), [contextNotes]);
  const visibleNotes = scope === 'archive' ? archivedNotes : scope === 'context' ? activeContextNotes : activeNotes;
  const allGroups = useMemo(() => groupNotesForRail(visibleNotes), [visibleNotes]);
  const groups = useMemo(
    () => selectedGroupKey ? allGroups.filter((group) => group.key === selectedGroupKey) : allGroups,
    [allGroups, selectedGroupKey]
  );
  const ribbonSource = useMemo(() => groups.flatMap((group) => group.notes), [groups]);
  const ribbonNotes = useMemo(
    () => showAllRibbons ? ribbonSource : ribbonSource.slice(0, RIBBON_LIMIT),
    [ribbonSource, showAllRibbons]
  );
  const pillCount = railPillCount(activeNotes.length, contextNotes.length, contextualDock);
  const hiddenRibbonCount = Math.max(0, ribbonSource.length - ribbonNotes.length);

  const refresh = useCallback(async () => {
    if (!nativeRuntimeAvailable) {
      setLoading(false);
      return;
    }
    const generation = ++refreshGeneration.current;
    try {
      const [nextAllNotes, nextContextNotes, nextActiveNoteId] = await Promise.all([
        invoke<SkribNote[]>('get_all_skribs'), invoke<SkribNote[]>('get_context_rail_notes'),
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
    if (!nativeRuntimeAvailable) return;
    const subscriptions = [
      listen('skribly://overlay-update', () => void refresh()),
      listen('skribly://rich-content-updated', () => void refresh()),
      listen('skribly://context-rail-refresh', () => void refresh()),
      listen('skribly://global-rail-refresh', () => void refresh()),
    ];
    return () => { void Promise.all(subscriptions).then((unlisten) => unlisten.forEach((dispose) => dispose())); };
  }, [refresh]);

  useEffect(() => {
    setSelectedGroupKey((current) => current && allGroups.some((group) => group.key === current) ? current : null);
  }, [allGroups]);

  const toggleCollapsed = async () => {
    if (resizing.current || opening.current) return;
    resizing.current = true;
    const next = !collapsed;
    setMenuOpen(false);
    setMessage(null);
    try {
      if (!nativeRuntimeAvailable) {
        setCollapsed(next);
        return;
      }
      await invoke('set_context_rail_expanded', {
        expanded: !next, contextual: contextualDock, noteCount: visibleNotes.length,
      });
      setCollapsed(next);
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      resizing.current = false;
    }
  };

  const launcherDrag = useNativeDrag(() => void toggleCollapsed(), (reason) => setMessage(String(reason)));

  const openContext = async (note: SkribNote) => {
    if (opening.current) return;
    opening.current = true;
    setOpeningId(note.id);
    setOpeningProgress({ phase: 'preparing', title: 'Keeping this thought safe…', detail: 'Getting ready to return to its saved place.' });
    setMessage(null);
    try {
      const result = await openNoteInSavedContext(note, setOpeningProgress);
      setActiveNoteId(note.id);
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
      setMessage('This Skrib is active again.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      opening.current = false;
      setOpeningId(null);
    }
  };

  const selectScope = (nextScope: RailScope) => {
    setScope(nextScope); setSelectedGroupKey(null); setShowAllRibbons(false); setMenuOpen(false);
  };

  if (collapsed) {
    if (!contextualDock) {
      return (
        <main className="context-rail collapsed global-widget">
          <button type="button" className="context-rail-global-widget" {...launcherDrag}
            aria-label={`Open My Skribs, ${pillCount} saved ${pillCount === 1 ? 'Skrib' : 'Skribs'}`}
            title={message || 'Your Skribs are right here. Click to open; double-click and drag to move.'}>
            <span className="global-widget-strip strip-yellow" aria-hidden="true" />
            <span className="global-widget-strip strip-peach" aria-hidden="true" />
            <span className="global-widget-strip strip-lavender" aria-hidden="true" />
          </button>
        </main>
      );
    }
    return (
      <main className="context-rail collapsed context-widget">
        <button type="button" className="context-rail-launcher" {...launcherDrag}
          aria-label={`Open ${pillCount} ${contextualDock ? 'Skribs here' : 'saved Skribs'}`}
          title={message || 'One click unfolds your Skribs. Double-click and drag to move this ribbon.'}>
          <span className="context-rail-launcher-layer layer-sky" aria-hidden="true" />
          <span className="context-rail-launcher-layer layer-peach" aria-hidden="true" />
          <span className="context-rail-launcher-face">
            <StickyNote size={15} strokeWidth={1.8} aria-hidden="true" />
            <strong>{pillCount}</strong>
            <span>{contextualDock ? 'here' : pillCount === 1 ? 'Skrib' : 'Skribs'}</span>
            <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        </button>
      </main>
    );
  }

  return (
    <main className="context-rail expanded">
      {openingProgress && <OpeningJourney progress={openingProgress} compact />}
      <header className="ribbon-rail-head" data-tauri-drag-region>
        <span className="ribbon-rail-brand" data-tauri-drag-region>
          <GripHorizontal size={15} aria-hidden="true" data-tauri-drag-region />
          <img src={skribliLogo} alt="" aria-hidden="true" data-tauri-drag-region />
          <span data-tauri-drag-region><strong data-tauri-drag-region>{scopeLabel(scope)}</strong>
            <small data-tauri-drag-region>{visibleNotes.length} {visibleNotes.length === 1 ? 'Skrib' : 'Skribs'}</small></span>
        </span>
        <span className="ribbon-rail-actions">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Choose which Skribs to show"
            aria-expanded={menuOpen} title="Here, everything, or archived Skribs"><MoreHorizontal size={16} aria-hidden="true" /></button>
          <button type="button" onClick={() => void toggleCollapsed()} aria-label="Collapse Skrib ribbons"
            title="Fold these ribbons back to the edge"><ChevronLeft size={16} aria-hidden="true" /></button>
        </span>
      </header>

      {menuOpen && <nav className="ribbon-scope-menu" aria-label="Which Skribs to show">
        <button className={scope === 'context' ? 'active' : ''} type="button" onClick={() => selectScope('context')}>
          <MapPin size={14} aria-hidden="true" /> Here <span>{activeContextNotes.length}</span></button>
        <button className={scope === 'all' ? 'active' : ''} type="button" onClick={() => selectScope('all')}>
          <Search size={14} aria-hidden="true" /> Everything <span>{activeNotes.length}</span></button>
        <button className={scope === 'archive' ? 'active' : ''} type="button" onClick={() => selectScope('archive')}>
          <ArchiveRestore size={14} aria-hidden="true" /> Archived <span>{archivedNotes.length}</span></button>
      </nav>}

      {allGroups.length > 1 && <nav className="ribbon-context-strip" aria-label="Apps with Skribs">
        <button type="button" className={selectedGroupKey === null ? 'active' : ''} onClick={() => { setSelectedGroupKey(null); setShowAllRibbons(false); }}
          aria-label="Show all apps" title="Every app in this view"><StickyNote size={14} aria-hidden="true" /><span>{visibleNotes.length}</span></button>
        {allGroups.map((group) => <button type="button" key={group.key} className={selectedGroupKey === group.key ? 'active' : ''}
          onClick={() => { setSelectedGroupKey(group.key); setShowAllRibbons(false); }} aria-label={`${group.label}, ${group.notes.length} Skribs`} title={`${group.label} · ${group.notes.length}`}>
          <ContextIcon processName={group.notes[0]?.target_process_name ?? group.key} /><span>{group.notes.length}</span></button>)}
      </nav>}

      <div className="ribbon-fan" aria-live="polite">
        {loading ? <div className="ribbon-empty" role="status">Gathering your Skribs…</div>
          : ribbonNotes.length === 0 ? <div className="ribbon-empty">
            {scope === 'archive' ? 'Completed thoughts will rest here.' : scope === 'context'
              ? 'No Skribs here yet. Ctrl + Shift + Space starts one.' : 'Your first thought is one shortcut away.'}
          </div> : ribbonNotes.map((note, index) => <article
            className={`skrib-ribbon skrib-color-${note.color} ${activeNoteId === note.id ? 'active' : ''}`} key={note.id}
            style={{ '--ribbon-index': index } as React.CSSProperties} aria-busy={openingId === note.id}>
            <button type="button" className="skrib-ribbon-read" onClick={() => void (scope === 'archive' ? restoreArchived(note) : openHere(note))}
              disabled={openingId !== null} title={scope === 'archive' ? 'Return this Skrib to your active notes' : 'Open this Skrib beside the ribbon'}>
              <span className="skrib-ribbon-mark" aria-hidden="true"><StickyNote size={14} strokeWidth={1.8} /></span>
              <span className="skrib-ribbon-copy"><strong>{noteTitle(note)}</strong>
                <small>{note.target_title || applicationLabel(note.target_process_name)}</small></span>
              {openingId === note.id && <LoaderCircle className="rail-opening-spinner" size={16} aria-hidden="true" />}
            </button>
            {scope !== 'archive' && <button type="button" className="skrib-ribbon-return" onClick={() => void openContext(note)}
              disabled={openingId !== null} aria-label={`Return to where ${noteTitle(note)} was placed`}
              title="Return to the app where this Skrib was placed"><MapPinned size={16} strokeWidth={1.9} aria-hidden="true" /></button>}
          </article>)}
        {hiddenRibbonCount > 0 && <button className="ribbon-more" type="button" onClick={() => setShowAllRibbons(true)}>
          +{hiddenRibbonCount} more</button>}
        {message && <div className="ribbon-message" role="status">{message}</div>}
      </div>
    </main>
  );
};
