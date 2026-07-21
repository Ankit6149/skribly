import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SkribNote, TargetWindowInfo } from '../lib/geometry';

export interface OverlayStatePayload {
  active_target: TargetWindowInfo | null;
  skribs: SkribNote[];
  available_windows: TargetWindowInfo[];
}

interface SkribStoreState {
  activeTarget: TargetWindowInfo | null;
  availableWindows: TargetWindowInfo[];
  skribs: SkribNote[];
  isPickingTarget: boolean;
  isInteractiveHover: boolean;
  isTauriAvailable: boolean;

  // Actions
  setPickingTarget: (picking: boolean) => void;
  fetchTargetWindows: () => Promise<void>;
  bindTarget: (target: TargetWindowInfo | null) => Promise<void>;
  addSkrib: (text?: string, color?: SkribNote['color']) => Promise<void>;
  updateSkribPosition: (
    id: string,
    rel_x: number,
    rel_y: number,
    width: number,
    height: number
  ) => Promise<void>;
  updateSkribText: (id: string, text: string) => Promise<void>;
  updateSkribColor: (id: string, color: SkribNote['color']) => Promise<void>;
  toggleSkribCollapse: (id: string) => Promise<void>;
  deleteSkrib: (id: string) => Promise<void>;
  setInteractiveHover: (isHovering: boolean) => Promise<void>;
  initTauri: () => Promise<void>;
}

export const useSkribStore = create<SkribStoreState>((set, get) => ({
  activeTarget: null,
  availableWindows: [],
  skribs: [],
  isPickingTarget: false,
  isInteractiveHover: false,
  isTauriAvailable: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,

  setPickingTarget: (picking: boolean) => {
    set({ isPickingTarget: picking });
  },

  fetchTargetWindows: async () => {
    if (!get().isTauriAvailable) return;
    try {
      const windows = await invoke<TargetWindowInfo[]>('list_target_windows');
      set({ availableWindows: windows });
    } catch (e) {
      console.warn('Failed to list target windows:', e);
    }
  },

  bindTarget: async (target: TargetWindowInfo | null) => {
    set({ activeTarget: target, isPickingTarget: false });
    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('set_active_target', { target });
      set({
        activeTarget: payload.active_target,
        skribs: payload.skribs,
        availableWindows: payload.available_windows,
      });
    } catch (e) {
      console.warn('Failed to bind target:', e);
    }
  },

  addSkrib: async (text = 'This Skrib will return with its context.', color = 'yellow') => {
    const target = get().activeTarget;
    const newNote: SkribNote = {
      id: `skrib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      target_process_name: target ? target.process_name : 'demo.exe',
      target_title: target ? target.title : 'Demo Window',
      rel_x: 40,
      rel_y: 40 + get().skribs.length * 30,
      width: 320,
      height: 230,
      text,
      color,
      collapsed: false,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    };

    const updatedSkribs = [...get().skribs, newNote];
    set({ skribs: updatedSkribs });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('upsert_skrib_note', { note: newNote });
      set({ skribs: payload.skribs });
    } catch (e) {
      console.warn('Failed to add skrib:', e);
    }
  },

  updateSkribPosition: async (id, rel_x, rel_y, width, height) => {
    const skribs = get().skribs.map((n) =>
      n.id === id ? { ...n, rel_x, rel_y, width, height, updated_at: Math.floor(Date.now() / 1000) } : n
    );
    set({ skribs });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_position', {
        id,
        relX: rel_x,
        relY: rel_y,
        width,
        height,
      });
      set({ skribs: payload.skribs });
    } catch (e) {
      console.warn('Failed to update position:', e);
    }
  },

  updateSkribText: async (id, text) => {
    const skribs = get().skribs.map((n) =>
      n.id === id ? { ...n, text, updated_at: Math.floor(Date.now() / 1000) } : n
    );
    set({ skribs });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_text', { id, text });
      set({ skribs: payload.skribs });
    } catch (e) {
      console.warn('Failed to update text:', e);
    }
  },

  updateSkribColor: async (id, color) => {
    const skribs = get().skribs.map((n) =>
      n.id === id ? { ...n, color, updated_at: Math.floor(Date.now() / 1000) } : n
    );
    set({ skribs });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_color', { id, color });
      set({ skribs: payload.skribs });
    } catch (e) {
      console.warn('Failed to update color:', e);
    }
  },

  toggleSkribCollapse: async (id) => {
    const skribs = get().skribs.map((n) =>
      n.id === id ? { ...n, collapsed: !n.collapsed, updated_at: Math.floor(Date.now() / 1000) } : n
    );
    set({ skribs });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('toggle_skrib_collapse', { id });
      set({ skribs: payload.skribs });
    } catch (e) {
      console.warn('Failed to toggle collapse:', e);
    }
  },

  deleteSkrib: async (id) => {
    const skribs = get().skribs.filter((n) => n.id !== id);
    set({ skribs });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('delete_skrib_note', { id });
      set({ skribs: payload.skribs });
    } catch (e) {
      console.warn('Failed to delete skrib:', e);
    }
  },

  setInteractiveHover: async (isHovering: boolean) => {
    set({ isInteractiveHover: isHovering });
    if (!get().isTauriAvailable) return;
    try {
      // ignore = false when hovering over interactive UI element; ignore = true over empty transparent space
      await invoke('set_ignore_cursor_events', { ignore: !isHovering });
    } catch (e) {
      console.warn('Failed to set ignore_cursor_events:', e);
    }
  },

  initTauri: async () => {
    if (!get().isTauriAvailable) return;
    try {
      await get().fetchTargetWindows();
      // Listen to background updates from Rust thread
      await listen<OverlayStatePayload>('skribly://overlay-update', (event) => {
        const payload = event.payload;
        set({
          activeTarget: payload.active_target,
          skribs: payload.skribs,
          availableWindows: payload.available_windows,
        });
      });
    } catch (e) {
      console.warn('Failed to initialize Tauri listeners:', e);
    }
  },
}));
