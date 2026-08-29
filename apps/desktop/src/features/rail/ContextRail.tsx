import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, X } from 'lucide-react';
import type { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import '../../styles/context-rail.css';
import { applicationLabel, contextMatchScore, groupNotesForRail } from './contextRailModel';

export const ContextRail: React.FC = () => {
  const [notes, setNotes] = useState<SkribNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const groups = useMemo(() => groupNotesForRail(notes), [notes]);
  const selected = notes.find((note) => note.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextNotes = await invoke<SkribNote[]>('get_all_skribs');
      setNotes(nextNotes);
      setSelectedId((current) =>
        current && nextNotes.some((note) => note.id === current)
          ? current
          : nextNotes.find((note) => note.deleted_at == null)?.id ?? null
      );
      setMessage(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscriptions = [
      listen('skribly://overlay-state', () => void refresh()),
      listen('skribly://rich-content-updated', () => void refresh()),
    ];
    return () => {
      void Promise.all(subscriptions).then((unlisten) => unlisten.forEach((dispose) => dispose()));
    };
  }, [refresh]);

  const toggleCollapsed = async () => {
    const next = !collapsed;
    await getCurrentWindow().setSize(new LogicalSize(360, next ? 64 : 480));
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
        setMessage(
          `${applicationLabel(note.target_process_name)} is not open in the saved context. You can still read the note here.`
        );
        return;
      }
      await invoke('focus_target_window', { hwndVal: target.hwnd_val });
      await invoke('set_active_target', { target });
      await invoke('set_skrib_window_collapsed', { id: note.id, collapsed: false });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <main className={`context-rail ${collapsed ? 'collapsed' : ''}`}>
      <header className="context-rail-header" data-tauri-drag-region>
        <div data-tauri-drag-region>
          <strong data-tauri-drag-region>My Skribs</strong>
          <span data-tauri-drag-region>{notes.filter((note) => note.deleted_at == null).length} across {groups.length} apps</span>
        </div>
        <div className="context-rail-actions">
          <button type="button" onClick={() => void refresh()} aria-label="Refresh notes" title="Refresh">
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => void toggleCollapsed()} aria-label={collapsed ? 'Expand note rail' : 'Collapse note rail'} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => void getCurrentWindow().hide()} aria-label="Hide note rail" title="Hide">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="context-rail-body">
          {loading ? (
            <div className="context-rail-empty" role="status">Reading local notes…</div>
          ) : groups.length === 0 ? (
            <div className="context-rail-empty">Press Ctrl + Shift + Space in any app to create your first Skrib.</div>
          ) : (
            <div className="context-rail-groups">
              {groups.map((group) => (
                <section key={group.key} className="context-rail-group">
                  <header><strong>{group.label}</strong><span>{group.notes.length}</span></header>
                  <div className="context-rail-dots" aria-label={`${group.label} notes`}>
                    {group.notes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        className={`context-note-dot skrib-color-${note.color} ${selectedId === note.id ? 'active' : ''}`}
                        aria-label={`Read note for ${note.target_title || group.label}`}
                        aria-pressed={selectedId === note.id}
                        title={note.text.trim().slice(0, 90) || 'Untitled Skrib'}
                        onClick={() => setSelectedId(note.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {selected && (
            <article className={`context-rail-preview skrib-color-${selected.color}`}>
              <span>{selected.target_title || applicationLabel(selected.target_process_name)}</span>
              <p>{selected.text.trim() || 'This Skrib contains drawing, attachments, or a reminder.'}</p>
              <button type="button" onClick={() => void openContext(selected)}>
                <ExternalLink size={14} aria-hidden="true" /> Open in context
              </button>
            </article>
          )}
          {message && <div className="context-rail-message" role="status">{message}</div>}
        </div>
      )}
    </main>
  );
};
