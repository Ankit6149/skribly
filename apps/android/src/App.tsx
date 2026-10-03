import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  mobileColours,
  mobileNoteTitle,
  mobileTextLimit,
  type MobileColour,
  type MobileNote,
} from "@skribly/shared";
import { listNotes, saveNote } from "./persistence";

type Draft = { note: MobileNote; original: MobileNote | null };
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Local storage failed. Please retry.";

export function App() {
  const [notes, setNotes] = useState<MobileNote[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"notes" | "trash">("notes");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [feedback, setFeedback] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const actionLock = useRef(false);
  const loadGeneration = useRef(0);
  const draftId = draft?.note.id;
  const dirty =
    draft !== null &&
    (!draft.original ||
      draft.note.text !== draft.original.text ||
      draft.note.colour !== draft.original.colour);

  const reload = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setError("");
    try {
      const current = await listNotes();
      if (generation === loadGeneration.current) {
        setNotes(current);
        setReady(true);
      }
    } catch (failure) {
      if (generation === loadGeneration.current) {
        setReady(false);
        setError(errorMessage(failure));
      }
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (draftId) editor.current?.focus();
  }, [draftId]);
  useEffect(() => {
    if (closeDialog) dialog.current?.showModal();
    else dialog.current?.close();
  }, [closeDialog]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function newNote() {
    if (!ready || actionLock.current) return;
    const now = Date.now();
    setError("");
    setFeedback("");
    setDraft({
      original: null,
      note: {
        schemaVersion: 1,
        id: crypto.randomUUID(),
        text: "",
        colour: "yellow",
        createdAt: now,
        updatedAt: now,
        revision: 1,
        trashedAt: null,
      },
    });
  }
  function change(text: string, colour: MobileColour) {
    if (busy || actionLock.current) return;
    setFeedback("");
    setDraft(
      (value) => value && { ...value, note: { ...value.note, text, colour } },
    );
  }
  function close() {
    if (busy || actionLock.current) return;
    if (dirty) setCloseDialog(true);
    else {
      setDraft(null);
      void reload();
    }
  }
  async function persist(closeAfter = false) {
    if (!draft || actionLock.current) return;
    actionLock.current = true;
    ++loadGeneration.current;
    setBusy(true);
    setError("");
    const saved = {
      ...draft.note,
      revision: (draft.original?.revision ?? 0) + 1,
      updatedAt: Math.max(Date.now(), draft.note.createdAt),
    };
    try {
      await saveNote(saved, draft.original?.revision ?? null);
      setNotes((value) =>
        [saved, ...value.filter((item) => item.id !== saved.id)].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
      );
      setFeedback("Saved on this device");
      setDraft(closeAfter ? null : { note: saved, original: saved });
      setCloseDialog(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function trash(note: MobileNote, restore = false) {
    if (actionLock.current) return;
    actionLock.current = true;
    ++loadGeneration.current;
    setBusy(true);
    setError("");
    const now = Math.max(Date.now(), note.createdAt);
    const saved = {
      ...note,
      trashedAt: restore ? null : now,
      updatedAt: now,
      revision: note.revision + 1,
    };
    try {
      await saveNote(saved, note.revision);
      setNotes((value) =>
        [saved, ...value.filter((item) => item.id !== saved.id)].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
      );
      setDraft(null);
      setFeedback(
        restore
          ? "Skrib restored"
          : "Moved to Trash. You can restore it anytime.",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  const shown = notes.filter(
    (note) =>
      (tab === "trash" ? note.trashedAt !== null : note.trashedAt === null) &&
      note.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );

  return (
    <main className="mobile-shell">
      {!draft ? (
        <>
          <header className="library-heading">
            <div>
              <p className="eyebrow">A LITTLE SPACE TO THINK</p>
              <h1>
                My Skribs
                <span className="heading-dot" />
              </h1>
              <p className="subtitle">Your thoughts, close at hand.</p>
            </div>
            <button
              className="round-button primary"
              aria-label="New Skrib"
              onClick={newNote}
              disabled={!ready || busy}
            >
              <Plus />
            </button>
          </header>
          <div className="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              aria-label="Search Skribs"
              placeholder="Find a thought…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <nav className="library-tabs" aria-label="Library">
            <button
              aria-pressed={tab === "notes"}
              onClick={() => setTab("notes")}
            >
              Skribs{" "}
              <span>
                {notes.filter((note) => note.trashedAt === null).length}
              </span>
            </button>
            <button
              aria-pressed={tab === "trash"}
              onClick={() => setTab("trash")}
            >
              Trash
            </button>
          </nav>
          {!ready && !error && <p role="status">Opening your local Skribs…</p>}
          {ready && shown.length === 0 && (
            <div className="empty-state">
              <span className="empty-symbol">
                <FileText />
              </span>
              <h2>
                {query
                  ? "No matching thoughts"
                  : tab === "trash"
                    ? "Nothing in Trash"
                    : "Start with a thought"}
              </h2>
              <p>
                {query
                  ? "Try a shorter word or another phrase."
                  : tab === "trash"
                    ? "Skribs you close here can be restored."
                    : "A line, an idea, a little reminder to yourself."}
              </p>
              {!query && tab === "notes" && (
                <button className="text-button" onClick={newNote}>
                  Write your first Skrib <Plus size={18} />
                </button>
              )}
            </div>
          )}
          <section
            className="note-list"
            aria-label={tab === "trash" ? "Trashed Skribs" : "Saved Skribs"}
          >
            {shown.map((note) => (
              <article
                className="note-card"
                key={note.id}
                style={
                  {
                    "--note-colour": `var(--${note.colour})`,
                  } as React.CSSProperties
                }
              >
                <button
                  className="note-open"
                  onClick={() => {
                    setError("");
                    setFeedback("");
                    setDraft({ note, original: note });
                  }}
                >
                  <span className="note-swatch" />
                  <span className="note-card-content">
                    <strong>{mobileNoteTitle(note.text)}</strong>
                    <span className="note-preview">
                      {note.text
                        .split("\n")
                        .filter((line) => line.trim())
                        .slice(1)
                        .join(" ") || "A thought worth keeping."}
                    </span>
                    <small>
                      {new Date(note.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · On this device
                    </small>
                  </span>
                </button>
                {tab === "trash" && (
                  <button
                    className="round-button"
                    disabled={busy}
                    aria-label={`Restore ${mobileNoteTitle(note.text)}`}
                    onClick={() => void trash(note, true)}
                  >
                    <RotateCcw size={18} />
                  </button>
                )}
              </article>
            ))}
          </section>
          <footer className="library-footnote">
            Saved locally. A space that's yours.
          </footer>
        </>
      ) : (
        <section
          className="editor-screen"
          style={
            {
              "--note-colour": `var(--${draft.note.colour})`,
            } as React.CSSProperties
          }
        >
          <header className="editor-heading">
            <button
              className="round-button"
              aria-label="Back to My Skribs"
              onClick={close}
              disabled={busy}
            >
              <ArrowLeft />
            </button>
            <span className="save-state">
              {busy
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : "Saved on this device"}
            </span>
            {draft.original && (
              <button
                className="round-button"
                aria-label="Move Skrib to Trash"
                disabled={busy || dirty}
                title={
                  dirty
                    ? "Save your changes before moving to Trash"
                    : "Move to Trash"
                }
                onClick={() => void trash(draft.original!)}
              >
                <Trash2 size={19} />
              </button>
            )}
            <button
              className="save-button"
              onClick={() => void persist()}
              disabled={busy || !dirty}
            >
              <Check size={18} /> Save
            </button>
          </header>
          <div className="note-paper">
            <label className="sr-only" htmlFor="note-text">
              Skrib text
            </label>
            <textarea
              ref={editor}
              id="note-text"
              maxLength={mobileTextLimit}
              value={draft.note.text}
              disabled={busy}
              placeholder="Write a thought…"
              onChange={(event) =>
                change(event.target.value, draft.note.colour)
              }
            />
          </div>
          <footer className="editor-tools">
            <fieldset>
              <legend className="sr-only">Paper colour</legend>
              {mobileColours.map((colour) => (
                <button
                  key={colour}
                  className="colour-button"
                  aria-label={`${colour} paper`}
                  aria-pressed={draft.note.colour === colour}
                  disabled={busy}
                  onClick={() => change(draft.note.text, colour)}
                >
                  <span style={{ background: `var(--${colour})` }}>
                    {draft.note.colour === colour && <Check size={14} />}
                  </span>
                </button>
              ))}
            </fieldset>
          </footer>
        </section>
      )}
      {error && (
        <div className="storage-error" role="alert">
          <p>{error}</p>
          {!draft && (
            <button className="text-button" onClick={() => void reload()}>
              Retry storage
            </button>
          )}
        </div>
      )}
      {feedback && (
        <p className="feedback" role="status">
          {feedback}
        </p>
      )}
      <dialog
        ref={dialog}
        className="close-dialog"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setCloseDialog(false);
        }}
      >
        <button
          className="round-button dialog-x"
          aria-label="Keep editing"
          disabled={busy}
          onClick={() => setCloseDialog(false)}
        >
          <X size={18} />
        </button>
        <h2>Keep this thought?</h2>
        <p>Your changes haven't been saved yet.</p>
        {error && <p role="alert">{error}</p>}
        <button
          className="save-button"
          disabled={busy}
          onClick={() => void persist(true)}
        >
          Save and close
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setDraft(null);
            setCloseDialog(false);
            void reload();
          }}
        >
          Close without saving
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => setCloseDialog(false)}
        >
          Keep editing
        </button>
      </dialog>
    </main>
  );
}
