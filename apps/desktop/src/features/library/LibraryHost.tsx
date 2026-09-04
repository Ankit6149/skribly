import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SkribNote } from '../../lib/geometry';
import { deleteOrphanedRichContent } from '../../lib/richContentStore';
import { deleteRemindersForNote } from '../../lib/reminderStore';
import { useLicenseStore } from '../../stores/licenseStore';
import type { StorageHealthPayload } from '../../stores/skribStore';
import '../../styles/library.css';
import {
  createLibraryExportRequest,
  isLibraryExportResult,
  LIBRARY_EXPORT_REQUEST_EVENT,
  LIBRARY_EXPORT_RESULT_EVENT,
} from './libraryExport';
import { LibraryImportPanel } from './LibraryImportPanel';
import { LibraryRichContent } from './LibraryRichContent';
import { ReminderCalendar } from './ReminderCalendar';
import { openNoteInSavedContext } from '../rail/openNoteContext';
import {
  filterLibraryNotes,
  noteContextLabel,
  noteDisplayTitle,
  notePreview,
  sortLibraryNotes,
} from './libraryModel';
import {
  filterNotesForLifecycle,
  isTrashedNote,
  type LibraryLifecycleView,
  trashRetentionInfo,
  trashRetentionLabel,
} from './trashLifecycle';

type ExportMessage =
  | { type: 'success'; path: string }
  | { type: 'error'; message: string }
  | null;

type LibraryView = LibraryLifecycleView | 'calendar';

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

export const LibraryHost: React.FC<{ active?: boolean; request?: { view: LibraryView }; onBack?: () => void }> = ({ active = true, request, onBack }) => {
  const [notes, setNotes] = useState<SkribNote[]>([]);
  const [lifecycleView, setLifecycleView] = useState<LibraryView>('notes');
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageWritable, setStorageWritable] = useState(true);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [mutatingNoteId, setMutatingNoteId] = useState<string | null>(null);
  const [permanentDeleteNoteId, setPermanentDeleteNoteId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<ExportMessage>(null);
  const [openingContextId, setOpeningContextId] = useState<string | null>(null);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const pendingExportRequest = useRef<string | null>(null);
  const pendingExportTimeout = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const refreshGeneration = useRef(0);
  const hasLoaded = useRef(false);
  const licenseStatus = useLicenseStore((state) => state.status);
  const licenceAllowsWrite = !licenseStatus.enforcementEnabled || licenseStatus.canWrite;
  const canMutate = storageWritable && licenceAllowsWrite;

  const clearExportTimeout = useCallback(() => {
    if (pendingExportTimeout.current !== null) {
      window.clearTimeout(pendingExportTimeout.current);
      pendingExportTimeout.current = null;
    }
  }, []);

  const refreshNotes = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    if (!hasLoaded.current) setIsLoading(true);
    try {
      const [loaded, storageHealth] = await Promise.all([
        invoke<SkribNote[]>('get_all_skribs'),
        invoke<StorageHealthPayload>('get_storage_health'),
      ]);
      if (generation !== refreshGeneration.current) return;
      hasLoaded.current = true;
      setNotes(sortLibraryNotes(loaded));
      setStorageWritable(storageHealth.writable);
      setLoadError(null);
    } catch (error) {
      if (generation !== refreshGeneration.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(`Skribli could not read the local note library: ${message}`);
    } finally {
      if (generation === refreshGeneration.current) setIsLoading(false);
    }
  }, []);

  const handleImportApplied = useCallback(async () => {
    setQuery('');
    setSelectedNoteId(null);
    await refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    if (active) void refreshNotes();
  }, [active, refreshNotes]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!disposed && focused && active) void refreshNotes();
      })
      .then((callback) => {
        if (disposed) callback();
        else unlisten = callback;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [active, refreshNotes]);

  useEffect(() => {
    if (request) setLifecycleView(request.view);
  }, [request]);

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

  const activeNotes = useMemo(() => filterNotesForLifecycle(notes, 'notes'), [notes]);
  const trashNotes = useMemo(() => filterNotesForLifecycle(notes, 'trash'), [notes]);
  const notesInView = lifecycleView === 'trash' ? trashNotes : activeNotes;
  const filteredNotes = useMemo(
    () => filterLibraryNotes(notesInView, query),
    [notesInView, query]
  );
  const selectedNote = useMemo(
    () => filteredNotes.find((note) => note.id === selectedNoteId) ?? null,
    [filteredNotes, selectedNoteId]
  );

  useEffect(() => {
    setPermanentDeleteNoteId(null);
    setLifecycleError(null);
    if (filteredNotes.length === 0) {
      if (selectedNoteId !== null) setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !filteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0]!.id);
    }
  }, [filteredNotes, lifecycleView, selectedNoteId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!active) return;
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
      if (permanentDeleteNoteId) {
        event.preventDefault();
        setPermanentDeleteNoteId(null);
        return;
      }
      if (query) {
        event.preventDefault();
        setQuery('');
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, permanentDeleteNoteId, query]);

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

  const runLifecycleMutation = async (
    command: 'restore_skrib_note' | 'permanently_delete_skrib_note',
    note: SkribNote
  ) => {
    if (!canMutate || mutatingNoteId) return false;
    setMutatingNoteId(note.id);
    setLifecycleError(null);
    try {
      await invoke(command, { id: note.id });
      let cleanupWarning: string | null = null;
      if (command === 'permanently_delete_skrib_note') {
        try {
          const remainingNotes = await invoke<SkribNote[]>('get_all_skribs');
          await Promise.all([
            deleteOrphanedRichContent(remainingNotes.map((remainingNote) => remainingNote.id)),
            deleteRemindersForNote(note.id),
          ]);
        } catch (reason) {
          cleanupWarning = `The note was deleted, but Skribli could not finish local attachment/reminder cleanup: ${
            reason instanceof Error ? reason.message : String(reason)
          }`;
        }
      }
      await refreshNotes();
      if (cleanupWarning) setLifecycleError(cleanupWarning);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLifecycleError(
        command === 'restore_skrib_note'
          ? `Skribli could not restore this note: ${message}`
          : `Skribli could not permanently delete this note: ${message}`
      );
      return false;
    } finally {
      setMutatingNoteId(null);
    }
  };

  const restoreSelectedNote = async (note: SkribNote) => {
    if (await runLifecycleMutation('restore_skrib_note', note)) {
      setLifecycleView('notes');
      setSelectedNoteId(note.id);
    }
  };

  const permanentlyDeleteSelectedNote = async (note: SkribNote) => {
    if (permanentDeleteNoteId !== note.id) {
      setPermanentDeleteNoteId(note.id);
      return;
    }
    if (await runLifecycleMutation('permanently_delete_skrib_note', note)) {
      setPermanentDeleteNoteId(null);
    }
  };

  const returnToHome = async () => {
    if (onBack) onBack();
    else await emit('skribly://home-view');
  };

  const openSelectedNote = async (note: SkribNote) => {
    setOpeningContextId(note.id);
    setContextMessage(null);
    try {
      await openNoteInSavedContext(note);
      await getCurrentWindow().hide();
    } catch (reason) {
      setContextMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setOpeningContextId(null);
    }
  };

  const selectedTrashInfo = selectedNote && isTrashedNote(selectedNote)
    ? trashRetentionInfo(selectedNote.deleted_at)
    : null;

  return (
    <main className="library-shell" aria-labelledby="library-title">
      <header className="library-topbar">
        <div>
          <span className="library-kicker">LOCAL NOTE LIBRARY</span>
          <h1 id="library-title">All Skribs</h1>
          <p>Find, restore, reopen, import, and export notes from one local workspace.</p>
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
            onClick={() => void returnToHome()}
          >
            Back to Skribli
          </button>
          <LibraryImportPanel canApply={canMutate} onApplied={handleImportApplied} />
          <button
            type="button"
            className="library-button primary"
            onClick={() => void requestExport(null)}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting…' : 'Export note records'}
          </button>
        </div>
      </header>

      <nav className="library-lifecycle-tabs" aria-label="All Skribs lifecycle views">
        <button
          type="button"
          aria-current={lifecycleView === 'notes' ? 'page' : undefined}
          className={lifecycleView === 'notes' ? 'active' : ''}
          onClick={() => setLifecycleView('notes')}
        >
          Notes <span>{activeNotes.length.toLocaleString()}</span>
        </button>
        <button
          type="button"
          aria-current={lifecycleView === 'calendar' ? 'page' : undefined}
          className={lifecycleView === 'calendar' ? 'active' : ''}
          onClick={() => setLifecycleView('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          aria-current={lifecycleView === 'trash' ? 'page' : undefined}
          className={lifecycleView === 'trash' ? 'active' : ''}
          onClick={() => setLifecycleView('trash')}
        >
          Trash <span>{trashNotes.length.toLocaleString()}</span>
        </button>
        {!canMutate && (
          <span className="library-readonly-status" role="status">
            Read-only: notes, previews, and exports remain available
          </span>
        )}
      </nav>

      {lifecycleView === 'calendar' && (
        <ReminderCalendar
          notes={activeNotes}
          onOpenNote={(noteId) => {
            setLifecycleView('notes');
            setSelectedNoteId(noteId);
          }}
        />
      )}

      <div className="library-standard-view" hidden={lifecycleView === 'calendar'}>

      <section className="library-toolbar" aria-label="Library search and status">
        <label className="library-search">
          <span className="sr-only">
            Search {lifecycleView === 'trash' ? 'trashed' : 'active'} notes
          </span>
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            autoFocus={active}
            placeholder={`Search ${lifecycleView === 'trash' ? 'Trash' : 'notes'}, application, or context…`}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>/</kbd>
        </label>
        <span className="library-result-count" aria-live="polite">
          {filteredNotes.length.toLocaleString()} of {notesInView.length.toLocaleString()}{' '}
          {lifecycleView === 'trash' ? 'trashed' : 'active'} notes
        </span>
      </section>

      {(exportMessage || lifecycleError) && (
        <div
          className={`library-export-message ${exportMessage?.type === 'error' || lifecycleError ? 'error' : 'success'}`}
          role={exportMessage?.type === 'error' || lifecycleError ? 'alert' : 'status'}
        >
          {lifecycleError ? (
            <>
              <strong>Lifecycle action failed</strong>
              <span>{lifecycleError}</span>
            </>
          ) : exportMessage?.type === 'success' ? (
            <>
              <strong>Export saved</strong>
              <code>{exportMessage.path}</code>
            </>
          ) : (
            <>
              <strong>Export failed</strong>
              <span>{exportMessage?.message}</span>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setExportMessage(null);
              setLifecycleError(null);
            }}
            aria-label="Dismiss library message"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="library-workspace">
        <section className="library-sidebar" aria-label={`${lifecycleView} note results`}>
          {isLoading && notes.length === 0 ? (
            <div className="library-state" role="status">
              <strong>Reading local Skribs…</strong>
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
          ) : notesInView.length === 0 ? (
            <div className="library-state">
              <strong>{lifecycleView === 'trash' ? 'Trash is empty' : 'No saved notes yet'}</strong>
              <span>
                {lifecycleView === 'trash'
                  ? 'Notes moved to Trash remain recoverable here for 30 days.'
                  : 'Focus an application and press Ctrl+Shift+Space to create the first Skrib.'}
              </span>
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
                const retention = isTrashedNote(note)
                  ? trashRetentionInfo(note.deleted_at)
                  : null;
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
                    {retention ? (
                      <span className={`library-retention-label ${retention.state}`}>
                        {trashRetentionLabel(retention)}
                      </span>
                    ) : (
                      <time dateTime={timestampDateTime(note.updated_at)}>
                        {formatUpdatedTime(note.updated_at)}
                      </time>
                    )}
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
                  <span className="library-kicker">
                    {isTrashedNote(selectedNote) ? 'TRASHED NOTE — READ ONLY' : 'READ-ONLY LIBRARY VIEW'}
                  </span>
                  <h2>{noteDisplayTitle(selectedNote)}</h2>
                  <p>{noteContextLabel(selectedNote)}</p>
                </div>
                <div className="library-detail-actions">
                  {!isTrashedNote(selectedNote) && (
                    <button
                      type="button"
                      className="library-button secondary"
                      onClick={() => void openSelectedNote(selectedNote)}
                      disabled={openingContextId !== null}
                    >
                      {openingContextId === selectedNote.id ? 'Opening…' : 'Open original'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="library-button primary"
                    onClick={() => void requestExport([selectedNote.id])}
                    disabled={isExporting}
                  >
                    Export this note
                  </button>
                  {isTrashedNote(selectedNote) && (
                    <button
                      type="button"
                      className="library-button secondary"
                      onClick={() => void restoreSelectedNote(selectedNote)}
                      disabled={!canMutate || mutatingNoteId !== null}
                    >
                      {mutatingNoteId === selectedNote.id ? 'Restoring…' : 'Restore'}
                    </button>
                  )}
                </div>
              </header>

              {selectedTrashInfo && (
                <div className={`library-trash-status ${selectedTrashInfo.state}`} role="status">
                  <strong>{trashRetentionLabel(selectedTrashInfo)}</strong>
                  <span>
                    Skribli does not purge expired Trash automatically in this release. Review it before permanent deletion.
                  </span>
                </div>
              )}

              <article className={`library-note-paper skrib-color-${selectedNote.color}`}>
                <p>{selectedNote.text || 'This note has no saved text.'}</p>
              </article>

              <LibraryRichContent noteId={selectedNote.id} />

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
                  <dt>{isTrashedNote(selectedNote) ? 'Moved to Trash' : 'Last updated'}</dt>
                  <dd>
                    {formatUpdatedTime(
                      isTrashedNote(selectedNote)
                        ? selectedNote.deleted_at ?? 0
                        : selectedNote.updated_at
                    )}
                  </dd>
                </div>
              </dl>

              {isTrashedNote(selectedNote) && (
                <div className="library-permanent-delete">
                  {permanentDeleteNoteId === selectedNote.id ? (
                    <div role="alert" className="library-permanent-confirmation">
                      <div>
                        <strong>Permanently delete “{noteDisplayTitle(selectedNote)}”?</strong>
                        <span>This removes the local record and cannot be undone.</span>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="library-button secondary"
                          autoFocus
                          onClick={() => setPermanentDeleteNoteId(null)}
                          disabled={mutatingNoteId !== null}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="library-button danger"
                          onClick={() => void permanentlyDeleteSelectedNote(selectedNote)}
                          disabled={!canMutate || mutatingNoteId !== null}
                        >
                          {mutatingNoteId === selectedNote.id ? 'Deleting…' : 'Delete permanently'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="library-button danger-outline"
                      onClick={() => void permanentlyDeleteSelectedNote(selectedNote)}
                      disabled={!canMutate || mutatingNoteId !== null}
                    >
                      Delete permanently
                    </button>
                  )}
                </div>
              )}

              <p className="library-safety-note">
                Open original focuses a matching live window. For supported Windows apps, Skribli can start the app first and then restore the note when that saved window is available.
              </p>
              {contextMessage && <div className="library-inline-error" role="status">{contextMessage}</div>}
            </>
          ) : (
            <div className="library-detail-empty">
              <strong>Select a note to read it</strong>
              <span>The library remains usable even when the original application is closed.</span>
            </div>
          )}
        </section>
      </div>
      </div>
    </main>
  );
};
