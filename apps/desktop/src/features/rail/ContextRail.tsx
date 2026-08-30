import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ExternalLink, Layers3, MapPin, Minimize2, RefreshCw, StickyNote } from 'lucide-react';
import type { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import '../../styles/context-rail.css';
import { applicationLabel, contextMatchScore, groupNotesForRail } from './contextRailModel';

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
  const selected = visibleNotes.find((note) => note.id === selectedId) ?? visibleNotes[0] ?? null;
  const pillCount = contextualDock ? contextNotes.length : activeNotes.length;

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
    void getCurrentWindow().setSize(new LogicalSize(72, 54)).catch(() => undefined);
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
      const expandedHeight = Math.min(402, 210 + Math.min(visibleNotes.length, 4) * 48);
      await getCurrentWindow().setSize(new LogicalSize(next ? 72 : 304, next ? 54 : expandedHeight));
    }
    setCollapsed(next);
  };

  const openContext = async (note: SkribNote) => {
    setMessage(null);
    try {
      const targets = await invoke<TargetWindowInfo[]>('list_target_windows');
      const target = targets
        .map((candidate) => ({ candidate, score: contextMatchScore(note, candidate) }))
        .filter(({ score }) => score >= 50)
        .sort((left, right) => right.score - left.score)[0]?.candidate;
      if (!target) {
        setMessage(`${applicationLabel(note.target_process_name)} is not open at the saved location.`);
        return;
      }
      await invoke('focus_target_window', { hwndVal: target.hwnd_val });
      await invoke('set_active_target', { target });
      await invoke('set_skrib_window_collapsed', { id: note.id, collapsed: false });
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
          <Layers3 size={17} aria-hidden="true" />
          <span>{pillCount > 99 ? '99+' : pillCount}</span>
        </button>
      </main>
    );
  }

  return (
    <main className="context-rail expanded">
      <header className="context-rail-header" data-tauri-drag-region>
        <span className="context-rail-heading" data-tauri-drag-region>
          <StickyNote size={16} aria-hidden="true" />
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
            <Minimize2 size={14} aria-hidden="true" />
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
            {groups.flatMap((group) => group.notes).map((note) => (
              <button
                key={note.id}
                type="button"
                className={`context-rail-note ${selected?.id === note.id ? 'active' : ''}`}
                onClick={() => setSelectedId(note.id)}
                title={note.text.trim().slice(0, 100) || note.target_title}
              >
                <i className={`skrib-color-${note.color}`} aria-hidden="true" />
                <span>
                  <strong>{noteTitle(note)}</strong>
                  <small><MapPin size={10} aria-hidden="true" /> {note.target_title || applicationLabel(note.target_process_name)}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <article className={`context-rail-preview skrib-color-${selected.color}`}>
            <p>{selected.text.trim() || 'Drawing, attachment, or reminder saved on this Skrib.'}</p>
            <button type="button" onClick={() => void openContext(selected)}>
              <ExternalLink size={13} aria-hidden="true" /> Open there
            </button>
          </article>
        )}
        {message && <div className="context-rail-message" role="status">{message}</div>}
      </div>
    </main>
  );
};
