import { useSyncExternalStore } from 'react';

const KEY = 'skribli.app-appearance.v1';
const EVENT = 'skribli-app-appearance-changed';
export interface AppAppearance { version: 1; quietIcons: boolean; customIcons: Record<string, string> }
const defaults: AppAppearance = { version: 1, quietIcons: true, customIcons: {} };
let cachedRaw: string | null | undefined;
let cached = defaults;
export function readAppAppearance(): AppAppearance {
  let raw: string | null;
  try { raw = window.localStorage.getItem(KEY); } catch { return defaults; }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = defaults;
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1 || typeof value.quietIcons !== 'boolean') return cached;
    const customIcons: Record<string, string> = {};
    for (const [name, icon] of Object.entries(value.customIcons ?? {})) {
      if (name.length <= 180 && name !== '__proto__' && typeof icon === 'string' && icon.length <= 180_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(icon)) customIcons[name] = icon;
    }
    cached = { version: 1, quietIcons: value.quietIcons, customIcons };
  } catch { /* Invalid preferences never prevent opening notes. */ }
  return cached;
}
export function saveAppAppearance(value: AppAppearance) {
  window.localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(EVENT, listener); };
}
export function useAppAppearance() { return useSyncExternalStore(subscribe, readAppAppearance, () => defaults); }
