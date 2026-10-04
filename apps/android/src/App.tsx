import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellPlus,
  Check,
  CheckCircle2,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createSharedReminder,
  mobileColours,
  mobileNoteTitle,
  mobileTextLimit,
  type MobileColour,
  type MobileNote,
  type SharedReminderRepeat,
} from "@skribly/shared";
import { listNotes, saveNote } from "./persistence";

type Draft = { note: MobileNote; original: MobileNote | null };
type LibraryTab = "notes" | "reminders" | "trash";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Storage failed. Please retry.";

function toLocalInput(timestamp: number): string {
  const date = new Date(timestamp);
  const local = new Date(timestamp - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultReminderTime(now = new Date()): number {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

function reminderLabel(dueAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dueAt);
}

export function App() {
  const [notes, setNotes] = useState<MobileNote[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<LibraryTab>("notes");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const actionLock = useRef(false);
  const loadGeneration = useRef(0);
  const draftId = draft?.note.id;
  const dirty =
    draft !== null &&
    (!draft.original || JSON.stringify(draft.note) !== JSON.stringify(draft.original));

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

  useEffect(() => void reload(), [reload]);
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

  function openDraft(note: MobileNote) {
    setError("");
    setFeedback("");
    setReminderOpen(false);
    setDraft({ note, original: note });
  }

  function newNote() {
    if (!ready || actionLock.current) return;
    const now = Date.now();
    setError("");
    setFeedback("");
    setReminderOpen(false);
    setDraft({
      original: null,
      note: {
        schemaVersion: 2,
        documentType: "skrib",
        id: crypto.randomUUID(),
        text: "",
        colour: "yellow",
        context: null,
        reminder: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        archivedAt: null,
        trashedAt: null,
      },
    });
  }

  function change(patch: Partial<Pick<MobileNote, "text" | "colour" | "reminder">>) {
    if (busy || actionLock.current) return;
    setFeedback("");
    setDraft((value) => value && { ...value, note: { ...value.note, ...patch } });
  }

  function addReminder() {
    if (!draft || busy) return;
    const now = Date.now();
    const reminder = createSharedReminder(
      defaultReminderTime(),
      "none",
      mobileNoteTitle(draft.note.text),
      now,
    );
    change({ reminder });
    setReminderOpen(true);
  }

  function updateReminder(patch: { dueAt?: number; repeat?: SharedReminderRepeat }) {
    if (!draft?.note.reminder) return;
    const dueAt = patch.dueAt ?? draft.note.reminder.dueAt;
    const repeat = patch.repeat ?? draft.note.reminder.repeat;
    change({
      reminder: {
        ...draft.note.reminder,
        ...patch,
        title: mobileNoteTitle(draft.note.text),
        updatedAt: Date.now(),
        repeatAnchorDay: repeat === "monthly" ? new Date(dueAt).getDate() : null,
      },
    });
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
    if (draft.note.reminder && draft.note.reminder.dueAt <= Date.now()) {
      setError("Choose a reminder time in the future before saving.");
      setReminderOpen(true);
      return;
    }
    actionLock.current = true;
    ++loadGeneration.current;
    setBusy(true);
    setError("");
    const saved: MobileNote = {
      ...draft.note,
      reminder: draft.note.reminder
        ? { ...draft.note.reminder, title: mobileNoteTitle(draft.note.text) }
        : null,
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
      setFeedback("Saved and available offline");
      setDraft(closeAfter ? null : { note: saved, original: saved });
      setCloseDialog(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function updateStored(note: MobileNote, patch: Partial<MobileNote>) {
    if (actionLock.current) return;
    actionLock.current = true;
    ++loadGeneration.current;
    setBusy(true);
    setError("");
    const saved: MobileNote = {
      ...note,
      ...patch,
      updatedAt: Math.max(Date.now(), note.createdAt),
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
      setFeedback(saved.reminder?.completedAt ? "Reminder completed" : "Skrib updated");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  const activeNotes = notes.filter(
    (note) => note.trashedAt === null && note.archivedAt === null,
  );
  const reminderNotes = activeNotes
    .filter(
      (note) =>
        note.reminder &&
        note.reminder.completedAt === null &&
        note.reminder.dismissedAt === null,
    )
    .sort((a, b) => (a.reminder?.dueAt ?? 0) - (b.reminder?.dueAt ?? 0));
  const normalizedQuery = query.toLocaleLowerCase();
  const shown = (tab === "trash" ? notes.filter((note) => note.trashedAt !== null) : tab === "reminders" ? reminderNotes : activeNotes).filter(
    (note) =>
      `${note.text} ${note.context?.label ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
  );

  return (
    <main className="mobile-shell">
      {!draft ? (
        <>
          <header className="library-heading">
            <div>
              <p className="eyebrow">YOUR SKRIBS, WHEREVER YOU THINK</p>
              <h1>My Skribs<span className="heading-dot" /></h1>
              <p className="subtitle">Notes and reminders, available offline.</p>
            </div>
            <button className="round-button primary" aria-label="New Skrib" onClick={newNote} disabled={!ready || busy}>
              <Plus />
            </button>
          </header>
          <div className="search-field">
            <Search aria-hidden="true" />
            <input type="search" aria-label="Search Skribs" placeholder="Find a thought…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <nav className="library-tabs" aria-label="Library">
            <button aria-pressed={tab === "notes"} onClick={() => setTab("notes")}>Skribs <span>{activeNotes.length}</span></button>
            <button aria-pressed={tab === "reminders"} onClick={() => setTab("reminders")}>Reminders <span>{reminderNotes.length}</span></button>
            <button aria-pressed={tab === "trash"} onClick={() => setTab("trash")}>Trash</button>
          </nav>
          {!ready && !error && <p role="status">Opening My Skribs…</p>}
          {ready && shown.length === 0 && (
            <div className="empty-state">
              <span className="empty-symbol">{tab === "reminders" ? <Bell /> : <FileText />}</span>
              <h2>{query ? "No matching thoughts" : tab === "trash" ? "Nothing in Trash" : tab === "reminders" ? "No upcoming reminders" : "Start with a thought"}</h2>
              <p>{query ? "Try a shorter word or another phrase." : tab === "trash" ? "Skribs moved here can be restored." : tab === "reminders" ? "Open a Skrib and add a time to see it here." : "A line, an idea, or a reminder for later."}</p>
              {!query && tab === "notes" && <button className="text-button" onClick={newNote}>Write your first Skrib <Plus size={18} /></button>}
            </div>
          )}
          <section className="note-list" aria-label={tab === "trash" ? "Trashed Skribs" : tab === "reminders" ? "Upcoming reminders" : "Saved Skribs"}>
            {shown.map((note) => (
              <article className="note-card" key={note.id} style={{ "--note-colour": `var(--${note.colour})` } as React.CSSProperties}>
                <button className="note-open" onClick={() => openDraft(note)}>
                  <span className="note-swatch" />
                  <span className="note-card-content">
                    <strong>{mobileNoteTitle(note.text)}</strong>
                    <span className="note-preview">{note.text.split("\n").filter((line) => line.trim()).slice(1).join(" ") || "A thought worth keeping."}</span>
                    {note.context && <span className="context-label">{note.context.label}</span>}
                    {note.reminder && note.reminder.completedAt === null && <small className={note.reminder.dueAt <= Date.now() ? "overdue" : ""}><Bell size={12} /> {reminderLabel(note.reminder.dueAt)}{note.reminder.repeat !== "none" ? ` · ${note.reminder.repeat}` : ""}</small>}
                    {!note.reminder && <small>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · Available offline</small>}
                  </span>
                </button>
                {tab === "trash" && <button className="round-button card-action" disabled={busy} aria-label={`Restore ${mobileNoteTitle(note.text)}`} onClick={() => void updateStored(note, { trashedAt: null })}><RotateCcw size={18} /></button>}
                {tab === "reminders" && note.reminder && <button className="round-button card-action" disabled={busy} aria-label={`Complete reminder for ${mobileNoteTitle(note.text)}`} onClick={() => void updateStored(note, { reminder: { ...note.reminder!, completedAt: Date.now(), updatedAt: Date.now() } })}><CheckCircle2 size={20} /></button>}
              </article>
            ))}
          </section>
          <footer className="library-footnote">Available offline. Encrypted account sync still needs connection and approval.</footer>
        </>
      ) : (
        <section className="editor-screen" style={{ "--note-colour": `var(--${draft.note.colour})` } as React.CSSProperties}>
          <header className="editor-heading">
            <button className="round-button" aria-label="Back to My Skribs" onClick={close} disabled={busy}><ArrowLeft /></button>
            <span className="save-state">{busy ? "Saving…" : dirty ? "Unsaved changes" : "Saved · available offline"}</span>
            {draft.original && <button className="round-button" aria-label="Move Skrib to Trash" disabled={busy || dirty} title={dirty ? "Save your changes before moving to Trash" : "Move to Trash"} onClick={() => void updateStored(draft.original!, { trashedAt: Date.now() })}><Trash2 size={19} /></button>}
            <button className="save-button" onClick={() => void persist()} disabled={busy || !dirty}><Check size={18} /> Save</button>
          </header>
          <div className="note-paper">
            <label className="sr-only" htmlFor="note-text">Skrib text</label>
            <textarea ref={editor} id="note-text" maxLength={mobileTextLimit} value={draft.note.text} disabled={busy} placeholder="Write a thought…" onChange={(event) => change({ text: event.target.value })} />
          </div>
          <footer className="editor-tools">
            <fieldset>
              <legend className="sr-only">Paper colour</legend>
              {mobileColours.map((colour) => <button key={colour} className="colour-button" aria-label={`${colour} paper`} aria-pressed={draft.note.colour === colour} disabled={busy} onClick={() => change({ colour: colour as MobileColour })}><span style={{ background: `var(--${colour})` }}>{draft.note.colour === colour && <Check size={14} />}</span></button>)}
            </fieldset>
            <button className="reminder-button" aria-expanded={reminderOpen} onClick={() => draft.note.reminder ? setReminderOpen((value) => !value) : addReminder()} disabled={busy}>{draft.note.reminder ? <Bell size={18} /> : <BellPlus size={18} />}{draft.note.reminder ? "Reminder" : "Remind me"}</button>
          </footer>
          {reminderOpen && draft.note.reminder && (
            <section className="reminder-panel" aria-label="Reminder settings">
              <div><strong>Reminder</strong><button className="text-button danger" onClick={() => { change({ reminder: null }); setReminderOpen(false); }}>Remove</button></div>
              <label>When<input type="datetime-local" min={toLocalInput(Date.now() + 60_000)} value={toLocalInput(draft.note.reminder.dueAt)} onChange={(event) => { const dueAt = new Date(event.target.value).getTime(); if (Number.isFinite(dueAt)) updateReminder({ dueAt }); }} /></label>
              <label>Repeat<select value={draft.note.reminder.repeat} onChange={(event) => updateReminder({ repeat: event.target.value as SharedReminderRepeat })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
              <p>Saved with this Skrib. Android notification delivery still needs device permission support.</p>
            </section>
          )}
        </section>
      )}
      {error && <div className="storage-error" role="alert"><p>{error}</p>{!draft && <button className="text-button" onClick={() => void reload()}>Retry storage</button>}</div>}
      {feedback && <p className="feedback" role="status">{feedback}</p>}
      <dialog ref={dialog} className="close-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) setCloseDialog(false); }}>
        <button className="round-button dialog-x" aria-label="Keep editing" disabled={busy} onClick={() => setCloseDialog(false)}><X size={18} /></button>
        <h2>Keep this thought?</h2><p>Your changes haven't been saved yet.</p>
        {error && <p role="alert">{error}</p>}
        <button className="save-button" disabled={busy} onClick={() => void persist(true)}>Save and close</button>
        <button className="text-button" disabled={busy} onClick={() => { setDraft(null); setCloseDialog(false); void reload(); }}>Close without saving</button>
        <button className="text-button" disabled={busy} onClick={() => setCloseDialog(false)}>Keep editing</button>
      </dialog>
    </main>
  );
}
