import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SkribNote } from '../../lib/geometry';
import '../../styles/context-rail.css';
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
import { WidgetAppStrip } from '../widget/components/WidgetAppStrip';
import { WidgetHeader } from '../widget/components/WidgetHeader';
import { ContextWidgetLauncher, GlobalWidgetLauncher } from '../widget/components/WidgetLaunchers';
import { WidgetNoteCard } from '../widget/components/WidgetNoteCard';
import { ContextWidgetScopeMenu, GlobalWidgetControls } from '../widget/components/WidgetScopeControls';
import type { RailScope } from '../widget/model/railTypes';

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
        <GlobalWidgetLauncher
          buttonRef={launcherButton}
          dockSide={dockSide}
          pillCount={pillCount}
          message={message}
          dragProps={launcherDrag}
        />
      );
    }
    return (
      <ContextWidgetLauncher
        buttonRef={launcherButton}
        dockSide={dockSide}
        pillCount={pillCount}
        revealed={revealed}
        message={message}
        dragProps={launcherDrag}
        onEscape={handleEscape}
        onPresencePointer={(active) => presence.current?.pointer(active)}
        onPresenceFocus={(active) => presence.current?.focus(active)}
        onPresenceHold={(active) => presence.current?.hold(active)}
      />
    );
  }

  return (
    <main ref={expandedSurface} tabIndex={-1}
      className={`context-rail expanded dock-${dockSide} ${contextualDock ? 'context-list' : `global-shelf ${nativeRuntimeAvailable ? 'has-native-reveal' : ''} ${closing ? 'is-closing' : ''}`}`}
      onKeyDown={handleEscape}>
      {openingProgress && <OpeningJourney progress={openingProgress} compact />}
      <WidgetHeader
        contextual={contextualDock}
        title={!contextualDock
          ? 'My Skribs'
          : scope === 'context'
            ? `${visibleNotes.length} ${visibleNotes.length === 1 ? 'Skrib' : 'Skribs'} here`
            : scopeLabel(scope)}
        noteCount={visibleNotes.length}
        dockSide={dockSide}
        menuOpen={menuOpen}
        closing={closing}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCollapse={() => void toggleCollapsed()}
      />

      {!contextualDock && (
        <GlobalWidgetControls
          scope={scope}
          query={query}
          onScope={selectScope}
          onQuery={setQuery}
        />
      )}

      <ContextWidgetScopeMenu
        open={menuOpen}
        scope={scope}
        contextCount={activeContextNotes.length}
        activeCount={activeNotes.length}
        archivedCount={archivedNotes.length}
        onScope={selectScope}
      />

      {!contextualDock && (
        <WidgetAppStrip
          groups={allGroups}
          selectedGroupKey={selectedGroupKey}
          visibleNoteCount={visibleNotes.length}
          appIcons={appIcons}
          onSelect={setSelectedGroupKey}
        />
      )}

      <div className="ribbon-fan" aria-live="polite">
        {loading ? <div className="ribbon-empty" role="status">Gathering your Skribs…</div>
          : ribbonNotes.length === 0 ? <div className="ribbon-empty">
            {query.trim() ? 'No thoughts match your search.' : scope === 'archive' ? 'Completed thoughts will rest here.' : scope === 'context'
              ? 'No Skribs here yet. Ctrl + Shift + Space starts one.' : 'Your first thought is one shortcut away.'}
          </div> : ribbonNotes.map((note, index) => (
            <WidgetNoteCard
              key={note.id}
              note={note}
              index={index}
              active={activeNoteId === note.id}
              opening={openingId === note.id}
              anyOpening={openingId !== null}
              contextual={contextualDock}
              archived={scope === 'archive'}
              iconUrl={appIcons[(note.target_process_name ?? '').toLowerCase()]}
              onRead={() => void (scope === 'archive' ? restoreArchived(note) : openHere(note))}
              onReturn={() => void openContext(note)}
            />
          ))}
        {message && <div className="ribbon-message" role="status">{message}</div>}
      </div>
      {!contextualDock && <footer className="global-shelf-footer"><span>Capture a thought</span><span className="global-shelf-shortcut"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Space</kbd></span></footer>}
    </main>
  );
};
