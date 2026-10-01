import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  AppWindow, ArchiveRestore, ChevronLeft, ChevronRight, Code2, Folder, Globe2, GripHorizontal,
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
import { observeRailWindowState, type RailWindowState } from './railWindowState';
import { createContextPresence } from './contextPresence';
import { afterRailPaint } from './railPaintReady';
import { bundledAppIcon } from '../skribs/bundledAppIcon';

type RailScope = 'context' | 'all' | 'archive';
const nativeRuntimeAvailable = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const APP_ICON_CACHE_KEY = 'skribli-app-icons-v1';
const GLOBAL_RAIL_EXIT_FALLBACK_MS = 350;

function waitForGlobalRailExit(surface: HTMLElement, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: number | undefined;
    let settled = false;
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      surface.removeEventListener('animationstart', onAnimationStart);
      surface.removeEventListener('animationend', onAnimationEnd);
      surface.removeEventListener('animationcancel', onAnimationCancel);
      signal.removeEventListener('abort', onAbort);
      if (timer !== undefined) window.clearTimeout(timer);
      resolve(completed);
    };
    const isExitAnimation = (event: AnimationEvent) =>
      event.target === surface && /^global-shelf-out-(left|right)$/.test(event.animationName);
    const onAnimationStart = (event: AnimationEvent) => {
      if (!isExitAnimation(event)) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => finish(true), GLOBAL_RAIL_EXIT_FALLBACK_MS);
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (isExitAnimation(event)) finish(true);
    };
    const onAnimationCancel = (event: AnimationEvent) => {
      if (isExitAnimation(event)) finish(true);
    };
    const onAbort = () => finish(false);
    if (signal.aborted) { resolve(false); return; }
    surface.addEventListener('animationstart', onAnimationStart);
    surface.addEventListener('animationend', onAnimationEnd);
    surface.addEventListener('animationcancel', onAnimationCancel);
    signal.addEventListener('abort', onAbort, { once: true });
    // WebView can lose animationend during focus or display transitions. Never strand collapse.
    timer = window.setTimeout(() => finish(true), GLOBAL_RAIL_EXIT_FALLBACK_MS);
  });
}

function readCachedAppIcons(): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(APP_ICON_CACHE_KEY) || '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter(([name, value]) =>
      name.length <= 128 && typeof value === 'string' && value.length <= 32_000
      && value.startsWith('data:image/png;base64,')));
  } catch { return {}; }
}

function noteTitle(note: SkribNote): string {
  const firstLine = note.text.trim().split(/\r?\n/, 1)[0]?.trim();
  return firstLine || note.target_title || applicationLabel(note.target_process_name);
}

function ContextIcon({ processName, iconUrl }: { processName: string; iconUrl: string | undefined }) {
  const logo = iconUrl || bundledAppIcon(processName);
  if (logo) return <img className="ribbon-app-icon" src={logo} alt="" aria-hidden="true" />;
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

const EMPTY_PREVIEW_NOTES: SkribNote[] = [];
export const ContextRail: React.FC<{ contextual: boolean; previewNotes?: SkribNote[]; previewDockSide?: 'left' | 'right' }> = ({ contextual, previewNotes = EMPTY_PREVIEW_NOTES, previewDockSide = 'right' }) => {
  const previewContextual = !nativeRuntimeAvailable && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('railMode') === 'context';
  const contextualDock = contextual || previewContextual;
  const [allNotes, setAllNotes] = useState<SkribNote[]>(nativeRuntimeAvailable ? [] : previewNotes);
  const [contextNotes, setContextNotes] = useState<SkribNote[]>(nativeRuntimeAvailable ? [] : previewNotes);
  const [scope, setScope] = useState<RailScope>(contextualDock ? 'context' : 'all');
  const [collapsed, setCollapsed] = useState(true);
  const [closing, setClosing] = useState(false);
  const [surfaceRevision, setSurfaceRevision] = useState<number | undefined>();
  const [query, setQuery] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [dockSide, setDockSide] = useState<'left' | 'right'>(nativeRuntimeAvailable ? 'right' : previewDockSide);
  const presence = useRef<ReturnType<typeof createContextPresence> | null>(null);
  const launcherButton = useRef<HTMLButtonElement>(null);
  const focusLauncherAfterCollapse = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const opening = useRef(false);
  const resizing = useRef(false);
  const dismissAfterOpening = useRef(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [appIcons, setAppIcons] = useState<Record<string, string>>(readCachedAppIcons);
  const [openingProgress, setOpeningProgress] = useState<OpenNoteProgress | null>(null);
  const refreshGeneration = useRef(0);
  const arrivalRevision = useRef<number | undefined>(undefined);
  const nativeRailRevision = useRef<number | undefined>(undefined);
  const expandedSurface = useRef<HTMLElement | null>(null);
  const exitAbort = useRef<AbortController | null>(null);

  useEffect(() => () => exitAbort.current?.abort(), []);

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
  const ribbonNotes = useMemo(() => ribbonSource.filter(note => {
    const term = query.trim().toLocaleLowerCase();
    return contextualDock || !term || `${note.text} ${note.target_title ?? ''} ${applicationLabel(note.target_process_name)}`.toLocaleLowerCase().includes(term);
  }), [ribbonSource, query, contextualDock]);
  const pillCount = railPillCount(activeNotes.length, contextNotes.length, contextualDock);
  const iconProcessNames = useMemo(() => [...new Set(visibleNotes.map((note) => note.target_process_name)
    .filter((name): name is string => Boolean(name)))].sort().join('\n'), [visibleNotes]);

  useEffect(() => {
    if (collapsed || !nativeRuntimeAvailable || !iconProcessNames) return;
    let live = true;
    const names = iconProcessNames.split('\n');
    void Promise.allSettled(names.map(async (processName) => {
      const iconUrl = await invoke<string | null>('get_app_icon', { processName });
      return { processName: processName.toLowerCase(), iconUrl };
    })).then((results) => {
      if (!live) return;
      setAppIcons((previous) => {
        const next = { ...previous };
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.iconUrl?.startsWith('data:image/png;base64,')
            && result.value.iconUrl.length <= 32_000) {
            next[result.value.processName] = result.value.iconUrl;
          }
        }
        return next;
      });
    });
    return () => { live = false; };
  }, [collapsed, iconProcessNames]);

  useEffect(() => {
    try { window.localStorage.setItem(APP_ICON_CACHE_KEY, JSON.stringify(appIcons)); } catch { /* cache is optional */ }
  }, [appIcons]);

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
      listen<string>('skribly://global-rail-presentation-error', ({ payload }) => { setMessage(payload); setClosing(false); }),
    ];
    return () => {
      refreshGeneration.current += 1;
      void Promise.allSettled(subscriptions).then((results) => results.forEach((result) => {
        if (result.status === 'fulfilled') result.value();
      }));
    };
  }, [refresh]);

  useEffect(() => {
    const controller = contextualDock ? createContextPresence((next) => {
      if (!nativeRuntimeAvailable) { setRevealed(next); return; }
      void invoke('set_context_rail_peek', { revealed: next, arrivalRevision: arrivalRevision.current }).catch((reason) => setMessage(String(reason)));
    }) : null;
    presence.current = controller;
    if (!nativeRuntimeAvailable) {
      controller?.sync({ expanded: false, revealed: true, arrivalRevision: 1 });
      if (controller) setRevealed(true);
      return () => { controller?.dispose(); presence.current = null; };
    }
    const dispose = observeRailWindowState({
      contextual: contextualDock,
      subscribe: (onState) => getCurrentWindow().listen<RailWindowState>('skribly://rail-state-changed', ({ payload }) => onState(payload)),
      read: () => invoke<RailWindowState>('get_rail_window_state', { contextual: contextualDock }),
      onState: (state) => {
        arrivalRevision.current = state.arrivalRevision;
        nativeRailRevision.current = state.revision;
        setCollapsed(!state.expanded);
        setSurfaceRevision(state.surfaceRevision);
        if (!state.expanded) { exitAbort.current?.abort(); setClosing(false); }
        else if (state.surfaceRevision !== undefined) setClosing(false);
        setRevealed(Boolean(state.revealed));
        setDockSide(state.dockSide ?? 'right');
        controller?.sync(state);
        if (!state.expanded) setMenuOpen(false);
      },
      onError: (reason) => setMessage(String(reason)),
    });
    return () => { dispose(); controller?.dispose(); presence.current = null; };
  }, [contextualDock]);

  useEffect(() => {
    if (contextualDock || !nativeRuntimeAvailable || surfaceRevision === undefined) return;
    return afterRailPaint(() => {
      const surface = collapsed ? launcherButton.current : expandedSurface.current;
      if (!surface || surface.getBoundingClientRect().width <= 0) return;
      void invoke('acknowledge_global_rail_surface', { surfaceRevision }).catch(reason => setMessage(String(reason)));
    }, {
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: id => window.cancelAnimationFrame(id),
      setTimer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: id => window.clearTimeout(id),
    });
  }, [surfaceRevision, collapsed, contextualDock]);

  useEffect(() => {
    // Native focus arrives after reveal. Move DOM focus only when its paint token is cleared,
    // so Escape works immediately without activating an incompletely revealed surface.
    if (!collapsed && (!nativeRuntimeAvailable || surfaceRevision === undefined)) expandedSurface.current?.focus();
    if (collapsed && focusLauncherAfterCollapse.current) {
      focusLauncherAfterCollapse.current = false;
      launcherButton.current?.focus();
    }
  }, [collapsed, surfaceRevision]);

  useEffect(() => {
    const release = () => presence.current?.hold(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, []);

  useEffect(() => {
    setSelectedGroupKey((current) => current && allGroups.some((group) => group.key === current) ? current : null);
  }, [allGroups]);

  const toggleCollapsed = useCallback(async () => {
    if (resizing.current || opening.current) return;
    resizing.current = true;
    const next = !collapsed;
    const requestArrivalRevision = arrivalRevision.current;
    const requestRailRevision = nativeRailRevision.current;
    setMenuOpen(false);
    setMessage(null);
    try {
      if (next && !contextualDock && !nativeRuntimeAvailable && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        const surface = expandedSurface.current;
        if (surface) {
          const controller = new AbortController();
          exitAbort.current = controller;
          const exit = waitForGlobalRailExit(surface, controller.signal);
          setClosing(true);
          const completed = await exit;
          exitAbort.current = null;
          // A newer native state wins over this delayed close request.
          if (!completed || nativeRailRevision.current !== requestRailRevision) {
            setClosing(false);
            return;
          }
        }
      }
      if (!nativeRuntimeAvailable) {
        setCollapsed(next);
        setRevealed(false);
        presence.current?.sync({ expanded: !next, revealed: false });
        return;
      }
      if (next && contextualDock) await invoke('set_context_rail_peek', { revealed: false, arrivalRevision: requestArrivalRevision });
      if (next && !contextualDock) setClosing(true);
      await invoke('set_context_rail_expanded', {
        expanded: !next, contextual: contextualDock, noteCount: visibleNotes.length,
        ...(contextualDock ? { arrivalRevision: requestArrivalRevision } : {}),
        ...(!contextualDock ? { reducedMotion: Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) } : {}),
      });
      // The native state event drives rendering; a late command response must not
      // undo a newer collapse caused by switching the foreground application.
    } catch (reason) {
      setMessage(String(reason));
      setClosing(false);
    } finally {
      exitAbort.current = null;
      resizing.current = false;
      if (!next || contextualDock || !nativeRuntimeAvailable) setClosing(false);
    }
  }, [collapsed, contextualDock, visibleNotes.length]);

  useEffect(() => {
    if (!nativeRuntimeAvailable || contextualDock || collapsed) return;
    let live = true;
    let unlisten: (() => void) | undefined;
    void listen('skribly://global-rail-dismiss', () => {
      if (!live) return;
      if (opening.current) { dismissAfterOpening.current = true; return; }
      void toggleCollapsed();
    }).then((release) => { if (live) unlisten = release; else release(); })
      .catch((reason) => { if (live) setMessage(String(reason)); });
    return () => { live = false; unlisten?.(); };
  }, [collapsed, contextualDock, toggleCollapsed]);

  const launcherDrag = useNativeDrag(() => void toggleCollapsed(), (reason) => setMessage(String(reason)));

  const handleEscape = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    if (!contextualDock && query) { setQuery(''); return; }
    if (menuOpen) { setMenuOpen(false); return; }
    if (!collapsed) {
      focusLauncherAfterCollapse.current = true;
      void toggleCollapsed();
    } else presence.current?.escape();
  };

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
      if (dismissAfterOpening.current) {
        dismissAfterOpening.current = false;
        void toggleCollapsed();
      }
    }
  };

  const openHere = async (note: SkribNote) => {
    if (opening.current) return;
    opening.current = true;
    setOpeningId(note.id);
    setMessage(null);
    try {
      await openNoteHere(note, contextualDock ? arrivalRevision.current : undefined);
      setActiveNoteId(note.id);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      opening.current = false;
      setOpeningId(null);
      if (dismissAfterOpening.current) {
        dismissAfterOpening.current = false;
        void toggleCollapsed();
      }
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
    setScope(nextScope); setSelectedGroupKey(null); setMenuOpen(false);
  };

  if (collapsed) {
    if (!contextualDock) {
      return (
        <main className={`context-rail collapsed global-widget dock-${dockSide}`}>
          <button ref={launcherButton} type="button" className="context-rail-global-widget" {...launcherDrag}
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
      <main className={`context-rail collapsed context-widget dock-${dockSide} ${revealed ? 'is-revealed' : ''}`} onKeyDown={handleEscape}>
        <button ref={launcherButton} type="button" className="context-presence" {...launcherDrag}
          onPointerEnter={() => presence.current?.pointer(true)}
          onPointerLeave={() => presence.current?.pointer(false)}
          onPointerDown={(event) => { presence.current?.hold(true); launcherDrag.onPointerDown(event); }}
          onPointerUp={() => { launcherDrag.onPointerUp(); presence.current?.hold(false); }}
          onPointerCancel={() => { launcherDrag.onPointerCancel(); presence.current?.hold(false); }}
          onFocus={() => presence.current?.focus(true)} onBlur={() => { presence.current?.focus(false); presence.current?.hold(false); }}
          aria-expanded={false} aria-label={`Open ${pillCount} ${pillCount === 1 ? 'Skrib' : 'Skribs'} here`}
          title={message || 'A thought lives here. Click to unfold it; double-click and drag to move.'}>
          <span className="context-presence-label" aria-hidden="true">{pillCount} {pillCount === 1 ? 'Skrib' : 'Skribs'} here</span>
          <span className="context-presence-dot" aria-hidden="true" />
        </button>
      </main>
    );
  }

  return (
    <main ref={expandedSurface} tabIndex={-1}
      className={`context-rail expanded dock-${dockSide} ${contextualDock ? 'context-list' : `global-shelf ${nativeRuntimeAvailable ? 'has-native-reveal' : ''} ${closing ? 'is-closing' : ''}`}`}
      onKeyDown={handleEscape}>
      {openingProgress && <OpeningJourney progress={openingProgress} compact />}
      <header className="ribbon-rail-head" data-tauri-drag-region>
        <span className="ribbon-rail-brand" data-tauri-drag-region>
          <GripHorizontal size={15} aria-hidden="true" data-tauri-drag-region />
          <img src={skribliLogo} alt="" aria-hidden="true" data-tauri-drag-region />
          <span data-tauri-drag-region><strong data-tauri-drag-region>{!contextualDock ? 'My Skribs' : scope === 'context' ? `${visibleNotes.length} ${visibleNotes.length === 1 ? 'Skrib' : 'Skribs'} here` : scopeLabel(scope)}</strong>
            <small data-tauri-drag-region>{visibleNotes.length} {visibleNotes.length === 1 ? 'saved thought' : 'saved thoughts'}</small></span>
        </span>
        <span className="ribbon-rail-actions">
          {contextualDock && <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Choose which Skribs to show"
            aria-expanded={menuOpen} title="Here, everything, or archived Skribs"><MoreHorizontal size={16} aria-hidden="true" /></button>}
          <button type="button" disabled={closing} onClick={() => void toggleCollapsed()} aria-label="Collapse Skrib ribbons"
            title="Keep your thoughts tucked away">{dockSide === 'left' ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button>
        </span>
      </header>

      {!contextualDock && <>
        <nav className="global-shelf-scopes" aria-label="Which Skribs to show">
          <button type="button" aria-pressed={scope === 'all'} onClick={() => selectScope('all')}><StickyNote size={15} aria-hidden="true" />All notes</button>
          <button type="button" aria-pressed={scope === 'context'} onClick={() => selectScope('context')}><MapPin size={15} aria-hidden="true" />Here</button>
          <button type="button" aria-pressed={scope === 'archive'} onClick={() => selectScope('archive')}><ArchiveRestore size={15} aria-hidden="true" />Archived</button>
        </nav>
        <label className="global-shelf-search"><Search size={17} aria-hidden="true" />
          <input aria-label="Search saved Skribs" placeholder="Find a thought…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
      </>}

      {menuOpen && <nav className="ribbon-scope-menu" aria-label="Which Skribs to show">
        <button className={scope === 'context' ? 'active' : ''} type="button" onClick={() => selectScope('context')}>
          <MapPin size={14} aria-hidden="true" /> Here <span>{activeContextNotes.length}</span></button>
        <button className={scope === 'all' ? 'active' : ''} type="button" onClick={() => selectScope('all')}>
          <Search size={14} aria-hidden="true" /> Everything <span>{activeNotes.length}</span></button>
        <button className={scope === 'archive' ? 'active' : ''} type="button" onClick={() => selectScope('archive')}>
          <ArchiveRestore size={14} aria-hidden="true" /> Archived <span>{archivedNotes.length}</span></button>
      </nav>}

      {!contextualDock && allGroups.length > 1 && <nav className="ribbon-context-strip" aria-label="Apps with Skribs">
        <button type="button" className={selectedGroupKey === null ? 'active' : ''} onClick={() => setSelectedGroupKey(null)}
          aria-label="Show all apps" title="Every app in this view"><StickyNote size={14} aria-hidden="true" /><span className="rail-app-label">All apps</span><span>{visibleNotes.length}</span></button>
        {allGroups.map((group) => <button type="button" key={group.key} className={selectedGroupKey === group.key ? 'active' : ''}
          onClick={() => setSelectedGroupKey(group.key)} aria-label={`${group.label}, ${group.notes.length} Skribs`} title={`${group.label} · ${group.notes.length}`}>
          <ContextIcon processName={group.notes[0]?.target_process_name ?? group.key}
            iconUrl={appIcons[(group.notes[0]?.target_process_name ?? group.key).toLowerCase()]} /><span>{group.notes.length}</span></button>)}
      </nav>}

      <div className="ribbon-fan" aria-live="polite">
        {loading ? <div className="ribbon-empty" role="status">Gathering your Skribs…</div>
          : ribbonNotes.length === 0 ? <div className="ribbon-empty">
            {query.trim() ? 'No thoughts match your search.' : scope === 'archive' ? 'Completed thoughts will rest here.' : scope === 'context'
              ? 'No Skribs here yet. Ctrl + Shift + Space starts one.' : 'Your first thought is one shortcut away.'}
          </div> : ribbonNotes.map((note, index) => <article
            className={`skrib-ribbon skrib-color-${note.color} ${activeNoteId === note.id ? 'active' : ''}`} key={note.id}
            style={{ '--ribbon-index': index } as React.CSSProperties} aria-busy={openingId === note.id}>
            <button type="button" className="skrib-ribbon-read" onClick={() => void (scope === 'archive' ? restoreArchived(note) : openHere(note))}
              disabled={openingId !== null} title={scope === 'archive' ? 'Return this Skrib to your active notes' : 'Open this Skrib beside the ribbon'}>
              <span className="skrib-ribbon-mark" aria-hidden="true"><ContextIcon processName={note.target_process_name ?? ''}
                iconUrl={appIcons[(note.target_process_name ?? '').toLowerCase()]} /></span>
              <span className="skrib-ribbon-copy"><strong>{noteTitle(note)}</strong>
                <small>{note.target_title || applicationLabel(note.target_process_name)}</small>
                {!contextualDock && note.text.trim().includes('\n') && <span className="global-note-preview">{note.text.trim().split(/\r?\n/).slice(1).join(' ')}</span>}
                {contextualDock && <span className="skrib-card-preview">{note.text.trim() || 'A little room for your next thought.'}</span>}
                {contextualDock && <span className="skrib-card-open">{scope === 'archive' ? 'Restore Skrib' : 'Open Skrib'}</span>}</span>
              {openingId === note.id && <LoaderCircle className="rail-opening-spinner" size={16} aria-hidden="true" />}
            </button>
            {scope !== 'archive' && <button type="button" className="skrib-ribbon-return" onClick={() => void openContext(note)}
              disabled={openingId !== null} aria-label={`Return to where ${noteTitle(note)} was placed`}
              title="Return to the app where this Skrib was placed"><MapPinned size={16} strokeWidth={1.9} aria-hidden="true" /></button>}
          </article>)}
        {message && <div className="ribbon-message" role="status">{message}</div>}
      </div>
      {!contextualDock && <footer className="global-shelf-footer"><span>Capture a thought</span><span className="global-shelf-shortcut"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Space</kbd></span></footer>}
    </main>
  );
};
