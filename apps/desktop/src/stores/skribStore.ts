import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { OverlayInitializationStatus, OverlayMetrics, SkribNote, TargetWindowInfo } from '../lib/geometry';

type UnlistenFn = () => void;

export interface OverlayStatePayload {
  active_target: TargetWindowInfo | null;
  skribs: SkribNote[];
  available_windows: TargetWindowInfo[];
  is_shortcut_active: boolean;
  is_ambiguous: boolean;
  overlay_metrics: OverlayMetrics;
  init_status?: OverlayInitializationStatus;
}

const DEFAULT_METRICS: OverlayMetrics = {
  overlay_physical_x: 0,
  overlay_physical_y: 0,
  overlay_physical_width: 1920,
  overlay_physical_height: 1080,
  dpi: 96,
  scale_factor: 1.0,
};

let listenerSetupPromise: Promise<void> | null = null;
let cleanupInstalled = false;
const unlistenCallbacks: UnlistenFn[] = [];

function disposeTauriListeners() {
  while (unlistenCallbacks.length > 0) {
    const unlisten = unlistenCallbacks.pop();
    try {
      unlisten?.();
    } catch {
      // The native window may already be shutting down.
    }
  }
  listenerSetupPromise = null;
}

interface SkribStoreState {
  activeTarget: TargetWindowInfo | null;
  availableWindows: TargetWindowInfo[];
  skribs: SkribNote[];
  overlayMetrics: OverlayMetrics;
  initStatus: OverlayInitializationStatus;
  isPickingTarget: boolean;
  isAmbiguous: boolean;
  isTauriAvailable: boolean;
  errorMessage: string | null;

  setPickingTarget: (picking: boolean) => void;
  clearError: () => void;
  fetchTargetWindows: () => Promise<void>;
  fetchOverlayMetrics: () => Promise<void>;
  retryOverlayInit: () => Promise<void>;
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
  updateHitTestRects: (
    rects: Array<{ x: number; y: number; width: number; height: number }>
  ) => Promise<void>;
  initTauri: () => Promise<void>;
}

export const useSkribStore = create<SkribStoreState>((set, get) => ({
  activeTarget: null,
  availableWindows: [],
  skribs: [],
  overlayMetrics: DEFAULT_METRICS,
  initStatus: { type: 'Initializing' },
  isPickingTarget: false,
  isAmbiguous: false,
  isTauriAvailable: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  errorMessage: null,

  setPickingTarget: (picking: boolean) => {
    set({ isPickingTarget: picking });
  },

  clearError: () => {
    set({ errorMessage: null });
  },

  fetchTargetWindows: async () => {
    if (!get().isTauriAvailable) return;
    try {
      const windows = await invoke<TargetWindowInfo[]>('list_target_windows');
      set({ availableWindows: windows });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to load application windows: ${msg}` });
    }
  },

  fetchOverlayMetrics: async () => {
    if (!get().isTauriAvailable) return;
    try {
      const metrics = await invoke<OverlayMetrics>('get_overlay_metrics');
      if (metrics) {
        set({ overlayMetrics: metrics });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to read overlay bounds: ${msg}` });
    }
  },

  retryOverlayInit: async () => {
    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('retry_overlay_initialization');
      set({
        initStatus: payload.init_status || get().initStatus,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ initStatus: { type: 'Failed', payload: msg } });
    }
  },

  bindTarget: async (target: TargetWindowInfo | null) => {
    set({ activeTarget: target, isPickingTarget: false, isAmbiguous: false });
    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('set_active_target', { target });
      set({
        activeTarget: payload.active_target,
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to bind target window: ${msg}` });
    }
  },

  addSkrib: async (text = 'New Sticky Note', color = 'yellow') => {
    const active = get().activeTarget;
    const now = Math.floor(Date.now() / 1000);
    const newNote: SkribNote = {
      id: `skrib-${Date.now()}`,
      target_process_name: active ? active.process_name : '',
      target_title: active ? active.title : '',
      rel_x: 40,
      rel_y: 40,
      width: 320,
      height: 230,
      text,
      color,
      collapsed: false,
      created_at: now,
      updated_at: now,
    };

    set((state) => ({ skribs: [...state.skribs, newNote] }));

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('upsert_skrib_note', { note: newNote });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to create Skrib note: ${msg}` });
    }
  },

  updateSkribPosition: async (id, rel_x, rel_y, width, height) => {
    set((state) => ({
      skribs: state.skribs.map((n) =>
        n.id === id ? { ...n, rel_x, rel_y, width, height, updated_at: Math.floor(Date.now() / 1000) } : n
      ),
    }));

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_position', {
        id,
        relX: rel_x,
        relY: rel_y,
        width,
        height,
      });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to save Skrib position: ${msg}` });
    }
  },

  updateSkribText: async (id, text) => {
    set((state) => ({
      skribs: state.skribs.map((n) =>
        n.id === id ? { ...n, text, updated_at: Math.floor(Date.now() / 1000) } : n
      ),
    }));

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_text', { id, text });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to save text: ${msg}` });
    }
  },

  updateSkribColor: async (id, color) => {
    set((state) => ({
      skribs: state.skribs.map((n) => (n.id === id ? { ...n, color } : n)),
    }));

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_color', { id, color });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to change color: ${msg}` });
    }
  },

  toggleSkribCollapse: async (id) => {
    set((state) => ({
      skribs: state.skribs.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n)),
    }));

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('toggle_skrib_collapse', { id });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to toggle collapse: ${msg}` });
    }
  },

  deleteSkrib: async (id) => {
    set((state) => ({
      skribs: state.skribs.filter((n) => n.id !== id),
    }));

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('delete_skrib_note', { id });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to delete Skrib: ${msg}` });
    }
  },

  updateHitTestRects: async (rects) => {
    if (!get().isTauriAvailable) return;
    try {
      await invoke('set_hit_test_rects', { rects });
    } catch (e) {
      // Ignore hit test update errors
    }
  },

  initTauri: async () => {
    if (!get().isTauriAvailable) return;

    if (!listenerSetupPromise) {
      listenerSetupPromise = (async () => {
        const overlayUnlisten = await listen<OverlayStatePayload>('skribly://overlay-update', (event) => {
          const payload = event.payload;
          set({
            activeTarget: payload.active_target,
            skribs: payload.skribs,
            availableWindows:
              payload.available_windows.length > 0 ? payload.available_windows : get().availableWindows,
            isAmbiguous: payload.is_ambiguous,
            isPickingTarget: payload.is_ambiguous ? true : get().isPickingTarget,
            overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
            initStatus: payload.init_status || get().initStatus,
          });
        });

        const shortcutUnlisten = await listen<OverlayStatePayload>('skribly://global-shortcut', (event) => {
          const payload = event.payload;
          set({
            activeTarget: payload.active_target,
            skribs: payload.skribs,
            availableWindows:
              payload.available_windows.length > 0 ? payload.available_windows : get().availableWindows,
            isAmbiguous: payload.is_ambiguous,
            isPickingTarget: payload.active_target ? false : true,
            overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
            initStatus: payload.init_status || get().initStatus,
          });
        });

        const hotkeyErrorUnlisten = await listen<string>('skribly://hotkey-error', (event) => {
          set({ errorMessage: event.payload });
        });

        const initStatusUnlisten = await listen<OverlayInitializationStatus>('skribly://overlay-init-status', (event) => {
          set({ initStatus: event.payload });
        });

        unlistenCallbacks.push(overlayUnlisten, shortcutUnlisten, hotkeyErrorUnlisten, initStatusUnlisten);

        // Subscribe before fetching state so a fast native startup event cannot be missed.
        const payload = await invoke<OverlayStatePayload>('refresh_target_state');
        set({
          activeTarget: payload.active_target,
          skribs: payload.skribs,
          availableWindows: payload.available_windows,
          isAmbiguous: payload.is_ambiguous,
          overlayMetrics: payload.overlay_metrics,
          initStatus: payload.init_status || get().initStatus,
        });

        if (!cleanupInstalled && typeof window !== 'undefined') {
          window.addEventListener('beforeunload', disposeTauriListeners, { once: true });
          cleanupInstalled = true;
        }
      })().catch((error) => {
        disposeTauriListeners();
        throw error;
      });
    }

    try {
      await listenerSetupPromise;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to initialize native event listeners: ${msg}` });
    }
  },
}));
