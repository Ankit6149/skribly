import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';

interface Preferences {
  version: number;
  multipleNotesPerContext: boolean;
}

export function NotePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const saving = useRef(false);

  useEffect(() => {
    let disposed = false;
    setMessage('');
    void invoke<Preferences>('get_note_preferences').then((value) => {
      if (!disposed) setPreferences(value);
    }).catch(() => {
      if (!disposed) setMessage('Your preference could not be loaded. Your Skribs are safe and unchanged.');
    });
    return () => { disposed = true; };
  }, [retry]);

  async function change(multipleNotesPerContext: boolean) {
    if (saving.current || !preferences) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      const saved = await invoke<Preferences>('set_note_preferences', { multipleNotesPerContext });
      setPreferences(saved);
      setMessage('Saved on this PC. Your existing Skribs stay exactly as they are.');
    } catch {
      setMessage('That choice did not save. Your previous setting is still in place—please try again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="home-announcement" aria-labelledby="note-preference-title" aria-busy={busy}>
      <span className="account-kicker">MAKE IT YOURS</span>
      <h2 id="note-preference-title">One place for each thought.</h2>
      <p>Your shortcut returns to the first active Skrib in an app. Turn on multiple Skribs when you need a fresh note each time.</p>
      <label className="account-consent">
        <input
          type="checkbox"
          checked={preferences?.multipleNotesPerContext ?? false}
          disabled={busy || preferences == null}
          aria-describedby="note-preference-help"
          onChange={(event) => void change(event.target.checked)}
        />
        <span>Start a new Skrib every time I press the shortcut</span>
      </label>
      <p id="note-preference-help">Existing notes are never merged or removed. In browsers, matching uses the tab’s title for now—not its website address.</p>
      {message && <p role="status">{message}</p>}
      {!preferences && message && <button type="button" className="account-secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button>}
    </section>
  );
}
