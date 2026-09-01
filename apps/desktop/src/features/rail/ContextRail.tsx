import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  AppWindow,
  ArrowUpRight,
  ChevronRight,
  GripVertical,
  MapPin,
  PanelRightClose,
  RefreshCw,
  StickyNote,
  X,
} from 'lucide-react';
import type { SkribNote } from '../../lib/geometry';
import '../../styles/context-rail.css';
import skribliLogo from '../../../src-tauri/icons/128x128.png';
import { applicationLabel, groupNotesForRail, railPillCount } from './contextRailModel';
import { openNoteInSavedContext } from './openNoteContext';

type RailScope = 'context' | 'all';

function noteTitle(note: SkribNote): string {
  const firstLine = note.text.trim().split(/\r?\n/, 1)[0]?.trim();
  return firstLine || note.target_title || applicationLabel(note.target_process_name);
}

export const ContextRail: React.FC = () => {
  const [allNotes, setAllNotes] = useState<SkribNote[]>([]);
  const [contextNotes, setContextNotes] = useState<SkribNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<RailScope>('context');
  const [contextualDock, setContextualDock] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const activeNotes = useMemo(
    () => allNotes.filter((note) => note.deleted_at == null),
    [allNotes]
  );
  const visibleNotes = scope === 'context' && contextNotes.length > 0 ? contextNotes : activeNotes;
  const groups = useMemo(() => groupNotesForRail(visibleNotes), [visibleNotes]);
  const selected = selectedId
    ? visibleNotes.find((note) => note.id === selectedId) ?? null
    : null;
  const pillCount = railPillCount(activeNotes.length, contextNotes.length, contextualDock);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAllNotes, nextContextNotes] = await Promise.all([
        invoke<SkribNote[]>('get_all_skribs'),
        invoke<SkribNote[]>('get_context_rail_notes'),
      ]);
      const nextActive = nextAllNotes.filter((note) => note.deleted_at == null);
      setAllNotes(nextAllNotes);
      setContextNotes(nextContextNotes);
      setScope((current) => nextContextNotes.length > 0 ? current : 'all');
      setSelectedId((current) => {
        const candidates = nextContextNotes.length > 0 ? nextContextNotes : nextActive;
        return current && candidates.some((note) => note.id === current)
          ? current
          : candidates[0]?.id ?? null;
      });
      setMessage(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void getCurrentWindow().setSize(new LogicalSize(64, 64)).catch(() => undefined);
    void refresh();
    const subscriptions = [
      listen('skribly://overlay-state', () => void refresh()),
      listen('skribly://rich-content-updated', () => void refresh()),
      listen('skribly://context-rail-refresh', () => {
        setContextualDock(true);
        setScope('context');
        setCollapsed(true);
        void refresh();
      }),
      listen('skribly://global-rail-refresh', () => {
        setContextualDock(false);
        setScope('all');
        setCollapsed(true);
        void refresh();
      }),
    ];
    return () => {
      void Promise.all(subscriptions).then((unlisten) => unlisten.forEach((dispose) => dispose()));
    };
  }, [refresh]);

  const toggleCollapsed = async () => {
    const next = !collapsed;
    setMessage(null);
    try {
      await invoke('set_context_rail_expanded', {
        expanded: !next,
        contextual: contextualDock,
        noteCount: visibleNotes.length,
      });
    } catch {
      const expandedHeight = Math.min(500, Math.max(424, 260 + Math.min(visibleNotes.length, 4) * 54));
      await getCurrentWindow().setSize(new LogicalSize(next ? 64 : 336, next ? 64 : expandedHeight));
    }
    setCollapsed(next);
  };

  const openContext = async (note: SkribNote) => {
    setMessage(null);
    try {
      setMessage(await openNoteInSavedContext(note));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  };

  if (collapsed) {
    return (
      <main className="context-rail collapsed" data-tauri-drag-region>
        <button
          type="button"
          className="context-rail-pill"
          onClick={() => void toggleCollapsed()}
          aria-label={`Open My Skribs rail with ${pillCount} notes`}
          title={`My Skribs · ${pillCount} note${pillCount === 1 ? '' : 's'}`}
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
          <button type="button" onClick={() => void refresh()} aria-label="Refresh notes" title="Refresh">
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => void toggleCollapsed()} aria-label="Collapse note rail" title="Collapse">
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
                    <button
                      key={note.id}
                      type="button"
                      className={`context-rail-note ${selected?.id === note.id ? 'active' : ''}`}
                      onClick={() => setSelectedId((current) => current === note.id ? null : note.id)}
                      title={note.text.trim().slice(0, 100) || note.target_title}
                      aria-pressed={selected?.id === note.id}
                      aria-expanded={selected?.id === note.id}
                    >
                      <i className={`skrib-color-${note.color}`} aria-hidden="true" />
                      <span>
                        <strong>{noteTitle(note)}</strong>
                        <small><MapPin size={11} aria-hidden="true" /> {note.target_title || applicationLabel(note.target_process_name)}</small>
                      </span>
                      <ChevronRight className="context-rail-note-arrow" size={13} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {selected && (
          <article className={`context-rail-preview skrib-color-${selected.color}`}>
            <div className="context-rail-preview-copy">
              <div className="context-rail-preview-heading">
                <small><StickyNote size={12} aria-hidden="true" /> Read Skrib</small>
                <button
                  type="button"
                  className="context-rail-preview-close"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close note preview"
                  title="Close preview"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
              <p>{selected.text.trim() || 'Drawing, attachment, or reminder saved on this Skrib.'}</p>
              <small><MapPin size={11} aria-hidden="true" /> {selected.target_title || applicationLabel(selected.target_process_name)}</small>
            </div>
            <button className="context-rail-open-context" type="button" onClick={() => void openContext(selected)}>
              <ArrowUpRight size={13} aria-hidden="true" /> Open in app
            </button>
          </article>
        )}
        {message && <div className="context-rail-message" role="status">{message}</div>}
      </div>
    </main>
  );
};
