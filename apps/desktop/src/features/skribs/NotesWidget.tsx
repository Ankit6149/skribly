import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import { countNoteAttachments } from '../../lib/richContentStore';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';

interface NotesWidgetProps {
  visibleNotes: SkribNote[];
}

export function scoreContextMatch(note: SkribNote, target: TargetWindowInfo): number {
  if (note.target_process_name.toLowerCase() !== target.process_name.toLowerCase()) return 0;
  const noteTitle = note.target_title.trim().toLowerCase();
  const targetTitle = target.title.trim().toLowerCase();
  if (noteTitle && targetTitle && noteTitle === targetTitle) return 100;
  if (noteTitle && targetTitle && (noteTitle.includes(targetTitle) || targetTitle.includes(noteTitle))) return 75;
  return 50;
}

export const NotesWidget: React.FC<NotesWidgetProps> = ({ visibleNotes }) => {
  const { isTauriAvailable, bindTarget } = useSkribStore();
  const {
    isNotesWidgetOpen,
    widgetNoteId,
    toggleNotesWidget,
    closeNotesWidget,
    selectWidgetNote,
    openPreview,
    openComposer,
  } = useSkribUiStore();
  const [notes, setNotes] = useState<SkribNote[]>(visibleNotes);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [contextMessage, setContextMessage] = useState<string | null>(null);

  const refreshNotes = async () => {
    if (!isTauriAvailable) {
      setNotes(visibleNotes);
      return;
    }
    try {
      const all = await invoke<SkribNote[]>('get_all_skribs');
      setNotes(all);
    } catch {
      setNotes(visibleNotes);
    }
  };

  useEffect(() => {
    if (!isTauriAvailable) setNotes(visibleNotes);
    else if (isNotesWidgetOpen) void refreshNotes();
  }, [isNotesWidgetOpen, isTauriAvailable, visibleNotes]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === widgetNoteId) ?? null,
    [notes, widgetNoteId]
  );
  const selectedNoteIsVisible = selectedNote
    ? visibleNotes.some((note) => note.id === selectedNote.id)
    : false;

  useEffect(() => {
    setContextMessage(null);
    if (!selectedNote) {
      setAttachmentCount(0);
      return;
    }
    void countNoteAttachments(selectedNote.id).then(setAttachmentCount);
  }, [selectedNote?.id]);

  const editSelectedNote = async () => {
    if (!selectedNote) return;
    if (!selectedNoteIsVisible) {
      setContextMessage('Reconnect this Skrib to its matching open app before editing it in place.');
      return;
    }

    const count = await countNoteAttachments(selectedNote.id);
    closeNotesWidget();
    if (selectedNote.text.length > 280 || count > 0) {
      openComposer(selectedNote.id, count > 0 ? 'write' : 'type');
    } else {
      openPreview(selectedNote.id);
    }
  };

  const reconnectOriginalApp = async () => {
    if (!selectedNote) return;
    setContextMessage(null);
    if (!isTauriAvailable) {
      setContextMessage('Reconnect to the original application from the desktop build.');
      return;
    }
    try {
      const windows = await invoke<TargetWindowInfo[]>('list_target_windows');
      const ranked = windows
        .map((target) => ({ target, score: scoreContextMatch(selectedNote, target) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) {
        setContextMessage(`${selectedNote.target_process_name || 'The original app'} is not open. Open it, then try again.`);
        return;
      }
      if (ranked.length > 1 && ranked[0]!.score === ranked[1]!.score) {
        setContextMessage('More than one matching window is open. Use Choose app so Skribly does not guess.');
        return;
      }

      const target = ranked[0]!.target;
      await invoke('focus_target_window', { hwndVal: target.hwnd_val });
      await bindTarget(target);
      closeNotesWidget();
      openPreview(selectedNote.id);
    } catch (error) {
      setContextMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <aside className={`notes-widget ${isNotesWidgetOpen ? 'open' : ''}`}>
      {isNotesWidgetOpen && (
        <section className="notes-widget-panel" aria-label="Saved Skribs">
          <header className="notes-widget-header">
            <div>
              <span>YOUR CONTEXT NOTES</span>
              <strong>{notes.length} Skribs</strong>
            </div>
            <button type="button" onClick={closeNotesWidget} aria-label="Close notes widget">✕</button>
          </header>

          {!selectedNote ? (
            <div className="notes-widget-list">
              {notes.length === 0 ? (
                <div className="notes-widget-empty">
                  <strong>No notes yet</strong>
                  <span>Create a Skrib inside an app and it will appear here.</span>
                </div>
              ) : (
                notes.map((note) => (
                  <button
                    type="button"
                    key={note.id}
                    className={`notes-widget-row skrib-color-${note.color}`}
                    onClick={() => selectWidgetNote(note.id)}
                  >
                    <span className="notes-widget-row-dot" />
                    <span className="notes-widget-row-copy">
                      <strong>{note.text.trim().slice(0, 58) || 'Empty Skrib'}</strong>
                      <small>{note.target_process_name || 'Unbound'} · {new Date(note.updated_at * 1000).toLocaleDateString()}</small>
                    </span>
                    <span>›</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="notes-widget-detail">
              <button type="button" className="notes-widget-back" onClick={() => selectWidgetNote(null)}>← All Skribs</button>
              <div className={`notes-widget-note skrib-color-${selectedNote.color}`}>
                <span className="notes-widget-context">{selectedNote.target_title || selectedNote.target_process_name || 'Unbound context'}</span>
                <p>{selectedNote.text || 'This Skrib has no typed text.'}</p>
                {attachmentCount > 0 && <small>{attachmentCount} attachment{attachmentCount === 1 ? '' : 's'}</small>}
              </div>
              <div className="notes-widget-question">
                <strong>Return to where this note belongs?</strong>
                <span>Skribly reconnects only to a matching open window. It never launches an unknown file silently.</span>
              </div>
              {contextMessage && <div className="notes-widget-message">{contextMessage}</div>}
              <div className="notes-widget-detail-actions">
                <button type="button" onClick={() => void editSelectedNote()}>
                  {selectedNoteIsVisible ? 'Open note' : 'Reconnect to edit'}
                </button>
                <button type="button" className="primary" onClick={() => void reconnectOriginalApp()}>
                  Open original app
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        className="notes-widget-trigger"
        onClick={toggleNotesWidget}
        aria-label={`${notes.length} saved Skribs`}
        title="Saved Skribs"
      >
        <span className="notes-widget-trigger-mark">S</span>
        <span className="notes-widget-trigger-count">{notes.length}</span>
      </button>
    </aside>
  );
};
