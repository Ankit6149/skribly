import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SkribNote } from '../../lib/geometry';
import '../../styles/library.css';
import {
  createLibraryExportRequest,
  isLibraryExportResult,
  LIBRARY_EXPORT_REQUEST_EVENT,
  LIBRARY_EXPORT_RESULT_EVENT,
} from './libraryExport';
import {
  filterLibraryNotes,
  noteContextLabel,
  noteDisplayTitle,
  notePreview,
  sortLibraryNotes,
} from './libraryModel';

type ExportMessage =
  | { type: 'success'; path: string }
  | { type: 'error'; message: string }
  | null;

const EXPORT_RESPONSE_TIMEOUT_MS = 15_000;

function dateFromTimestamp(timestampSeconds: number): Date | null {
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) return null;
  const date = new Date(timestampSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUpdatedTime(timestampSeconds: number): string {
  const date = dateFromTimestamp(timestampSeconds);
  if (!date) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function timestampDateTime(timestampSeconds: number): string | undefined {
  return dateFromTimestamp(timestampSeconds)?.toISOString();
}

export const LibraryHost: React.FC = () => {
  const [notes, setNotes] = useState<SkribNote[]>([]);
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<ExportMessage>(null);
  const pendingExportRequest = useRef<string | null>(null);
  const pendingExportTimeout = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const clearExportTimeout = useCallback(() => {
    if (pendingExportTimeout.current !== null) {
      window.clearTimeout(pendingExportTimeout.current);
      pendingExportTimeout.current = null;
    }
  }, []);

  const refreshNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await invoke<SkribNote[]>('get_all_skribs');
      const ordered = sortLibraryNotes(loaded);
      setNotes(ordered);
      setSelectedNoteId((current) => {
        if (current && ordered.some((note) => note.id === current)) return current;
        return ordered[0]?.id ?? null;
      });
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(`Skribli could not read the local note library: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!disposed && focused) void refreshNotes();
      })
      .then((callback) => {
        if (disposed) callback();
        else unlisten = callback;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [refreshNotes]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<unknown>(LIBRARY_EXPORT_RESULT_EVENT, (event) => {
      if (disposed || !isLibraryExportResult(event.payload)) return;
      if (event.payload.requestId !== pendingExportRequest.current) return;

      clearExportTimeout();
      pendingExportRequest.current = null;
      setIsExporting(false);
      if (event.payload.path) {
        setExportMessage({ type: 'success', path: event.payload.path });
      } else {
        setExportMessage({
          type: 'error',
          message: event.payload.error || 'Skribli could not export the selected notes.',
        });
      }
    }).then((callback) => {
      if (disposed) callback();
      else unlisten = callback;
    });

    return () => {
      disposed = true;
      clearExportTimeout();
      unlisten?.();
    };
  }, [clearExportTimeout]);

  const filteredNotes = useMemo(() => filterLibraryNotes(notes, query), [notes, query]);
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  useEffect(() => {
    if (filteredNotes.length === 0) {
      if (selectedNoteId !== null) setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !filteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0]!.id);
    }
  }, [filteredNotes, selectedNoteId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key !== 'Escape') return;
      if (query) {
        event.preventDefault();
        setQuery('');
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query]);

  const requestExport = async (noteIds: string[] | null) => {
    if (isExporting) return;

    try {
      const request = createLibraryExportRequest(noteIds);
      clearExportTimeout();
      pendingExportRequest.current = request.requestId;
      setIsExporting(true);
      setExportMessage(null);
      pendingExportTimeout.current = window.setTimeout(() => {
        if (pendingExportRequest.current !== request.requestId) return;
        pendingExportRequest.current = null;
        pendingExportTimeout.current = null;
        setIsExporting(false);
        setExportMessage({
          type: 'error',
          message: 'Skribli did not receive an export result. Try again or restart the app.',
        });
      }, EXPORT_RESPONSE_TIMEOUT_MS);
      await emit(LIBRARY_EXPORT_REQUEST_EVENT, request);
    } catch (error) {
      clearExportTimeout();
      pendingExportRequest.current = null;
      setIsExporting(false);
      setExportMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const hideLibrary = async () => {
    try {
      await getCurrentWindow().hide();
    } catch {
      // The process may already be exiting from the tray.
    }
  };

  return (
    <main className="library-shell" aria-labelledby="library-title">
      <header className="library-topbar">
        <div>
          <span className="library-kicker">LOCAL NOTE LIBRARY</span>
          <h1 id="library-title">All Skribs</h1>
          <p>Find and export every saved note without reopening its original application.</p>
        </div>
        <div className="library-topbar-actions">
          <button
            type="button"
            className="library-button secondary"
            onClick={() => void refreshNotes()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="library-button secondary"
            onClick={() => void hideLibrary()}
          >
            Hide library
          </button>
          <button
            type="button"
            className="library-button primary"
            onClick={() => void requestExport(null)}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting…' : 'Export complete backup'}
          </button>
        </div>
      </header>

      <section className="library-toolbar" aria-label="Library search and status">
        <label className="library-search">
          <span className="sr-only">Search saved notes</span>
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            autoFocus
            placeholder="Search note text, application, or context…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>/</kbd>
        </label>
        <span className="library-result-count" aria-live="polite">
          {filteredNotes.length.toLocaleString()} of {notes.length.toLocaleString()} notes
        </span>
      </section>

      {exportMessage && (
        <div
          className={`library-export-message ${exportMessage.type}`}
          role={exportMessage.type === 'error' ? 'alert' : 'status'}
        >
          {exportMessage.type === 'success' ? (
            <>
              <strong>Export saved</strong>
              <code>{exportMessage.path}</code>
            </>
          ) : (
            <>
              <strong>Export failed</strong>
              <span>{exportMessage.message}</span>
            </>
          )}
          <button type="button" onClick={() => setExportMessage(null)} aria-label="Dismiss export message">
            Dismiss
          </button>
        </div>
      )}

      <div className="library-workspace">
        <section className="library-sidebar" aria-label="Saved note results">
          {isLoading && notes.length === 0 ? (
            <div className="library-state" role="status">
              <strong>Reading local notes…</strong>
              <span>Skribli is loading the storage-backed library.</span>
            </div>
          ) : loadError ? (
            <div className="library-state error" role="alert">
              <strong>All Skribs is unavailable</strong>
              <span>{loadError}</span>
              <button type="button" onClick={() => void refreshNotes()}>
                Retry
              </button>
            </div>
          ) : notes.length === 0 ? (
            <div className="library-state">
              <strong>No saved notes yet</strong>
              <span>Focus an application and press Ctrl+Shift+Space to create the first Skrib.</span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="library-state">
              <strong>No matching notes</strong>
              <span>Try a different word, application name, or context title.</span>
              <button type="button" onClick={() => setQuery('')}>
                Clear search
              </button>
            </div>
          ) : (
            <div className="library-results" role="listbox" aria-label="Matching saved notes">
              {filteredNotes.map((note) => {
                const selected = note.id === selectedNoteId;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    key={note.id}
                    className={`library-note-row skrib-color-${note.color} ${selected ? 'selected' : ''}`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <span className="library-note-row-title">{noteDisplayTitle(note)}</span>
                    <span className="library-note-row-context">{noteContextLabel(note)}</span>
                    <span className="library-note-row-preview">{notePreview(note)}</span>
                    <time dateTime={timestampDateTime(note.updated_at)}>
                      {formatUpdatedTime(note.updated_at)}
                    </time>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="library-detail" aria-label="Selected note detail">
          {selectedNote ? (
            <>
              <header className="library-detail-header">
                <div>
                  <span className="library-kicker">READ-ONLY LIBRARY VIEW</span>
                  <h2>{noteDisplayTitle(selectedNote)}</h2>
                  <p>{noteContextLabel(selectedNote)}</p>
                </div>
                <button
                  type="button"
                  className="library-button primary"
                  onClick={() => void requestExport([selectedNote.id])}
                  disabled={isExporting}
                >
                  Export this note
                </button>
              </header>

              <article className={`library-note-paper skrib-color-${selectedNote.color}`}>
                <p>{selectedNote.text || 'This note has no saved text.'}</p>
              </article>

              <dl className="library-note-metadata">
                <div>
                  <dt>Application</dt>
                  <dd>{selectedNote.target_process_name || 'Unavailable'}</dd>
                </div>
                <div>
                  <dt>Stored context</dt>
                  <dd>{selectedNote.target_title || 'Unavailable'}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatUpdatedTime(selectedNote.updated_at)}</dd>
                </div>
              </dl>

              <p className="library-safety-note">
                All Skribs never launches or guesses the original application. Context reopening and re-anchoring remain separate safety-reviewed workflows.
              </p>
            </>
          ) : (
            <div className="library-detail-empty">
              <strong>Select a note to read it</strong>
              <span>The library remains usable even when the original application is closed.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
