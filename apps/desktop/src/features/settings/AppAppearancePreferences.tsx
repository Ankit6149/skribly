import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import type { SkribNote } from '../notes/model/noteTypes';
import { readAppAppearance, saveAppAppearance, useAppAppearance } from './appAppearance';

export function AppAppearancePreferences() {
  const preferences = useAppAppearance();
  const [apps, setApps] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void invoke<SkribNote[]>('get_all_skribs').then((notes) => {
      if (live) setApps([...new Set(notes.map((note) => note.target_process_name.trim().toLowerCase()).filter(Boolean))].sort());
    }).catch(() => { if (live) setMessage('App choices could not load. Reopen Settings to try again.'); });
    return () => { live = false; };
  }, []);
  const save = (next: typeof preferences) => {
    try { saveAppAppearance(next); setMessage('Appearance saved on this PC.'); }
    catch { setMessage('Appearance could not save. Your previous choice is unchanged.'); }
  };
  return <section className="app-logo-settings" aria-labelledby="app-appearance-title">
    <h3 id="app-appearance-title">App logos</h3>
    <p>Supericons supplies familiar app marks, with Windows icons for other apps. Choose quieter fallback logos or a custom image for an app with Skribs.</p>
    <label className="account-consent"><input type="checkbox" checked={preferences.quietIcons}
      onChange={(event) => save({ ...preferences, quietIcons: event.target.checked })} />
      <span>Use quiet monochrome logos in the widget</span></label>
    <div className="desktop-setting-row">
      <label>Application<select aria-label="Application logo to customize" value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">Choose an app</option>{apps.map((app) => <option key={app} value={app}>{app}</option>)}
      </select></label>
      <label>Custom logo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!selected || busy}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!file || !selected) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 128_000) {
            setMessage('Choose a PNG, JPEG or WebP image smaller than 128 KB.'); return;
          }
          setBusy(true);
          try {
            const data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Read failed')); reader.readAsDataURL(file);
            });
            const current = readAppAppearance();
            save({ ...current, customIcons: { ...current.customIcons, [selected]: data } });
          } catch { setMessage('The image could not be read. Your previous logo is unchanged.'); }
          finally { setBusy(false); }
        }} /></label>
      <button className="account-secondary" type="button" disabled={!selected || !preferences.customIcons[selected] || busy} onClick={() => {
        const icons = { ...preferences.customIcons }; delete icons[selected]; save({ ...preferences, customIcons: icons });
      }}>Use automatic logo</button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
