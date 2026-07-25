import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import { countNoteAttachments } from '../../lib/richContentStore';
import { useSkribStore } from '../../stores/skribStore';
import { useSkribUiStore } from '../../stores/skribUiStore';

interface NotesWidgetProps {
  visibleNotes: SkribNote[];
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
    void refreshNotes();
  }, [visibleNotes.length]);

  useEffect(() => {
    if (isNotesWidgetOpen) void refreshNotes();
  }, [isNotesWidgetOpen]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === widgetNoteId) ?? null,
    [notes, widgetNoteId]
  );

  useEffect(() => {
    setContextMessage(null);
    if (!selectedNote) {
      setAttachmentCount(0);
      return;
    }
    void countNoteAttachments(selectedNote.id)
      .then(setAttachmentCount)
      .catch(() => setAttachmentCount(0));
  }, [selectedNote?.id]);

  const openSelectedNote = async () => {
    if (!selectedNote) return;
    const count = await countNoteAttachments(selectedNote.id).catch(() => 0);
    closeNotesWidget();
    if (selectedNote.text.length > 280 || count > 0) {
      openComposer(selectedNote.id, count > 0 ? 'write' : 'type');
    } else {
      openPreview(selectedNote.id);
    }
  };

  const focusOriginalApp = async () => {
    if (!selectedNote) return;
    setContextMessage(null);
    if (!isTauriAvailable) {
      setContextMessage('Open the original application from the desktop build.');
      return;
    }
    try {
      const target = await invoke<TargetWindowInfo>('focus_skrib_context', { id: selectedNote.id });
      await bindTarget(target);
      setContextMessage(`Opened ${target.process_name}.`);
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
                <span>Skribly will focus the matching open application. It will not launch unknown files silently.</span>
              </div>
              {contextMessage && <div className="notes-widget-message">{contextMessage}</div>}
              <div className="notes-widget-detail-actions">
                <button type="button" onClick={() => void openSelectedNote()}>Open note</button>
                <button type="button" className="primary" onClick={() => void focusOriginalApp()}>Open original app</button>
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
