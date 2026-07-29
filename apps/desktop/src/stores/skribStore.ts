import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { OverlayInitializationStatus, OverlayMetrics, SkribNote, TargetWindowInfo } from '../lib/geometry';
import { useLicenseStore } from './licenseStore';

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

export interface StorageNotice {
  message: string;
  source: 'primary' | 'temporary' | 'backup1' | 'legacyBackup' | 'backup2';
  revision: number;
  migratedFromSchema: number | null;
  quarantinedFiles: string[];
  backupDirectory: string;
}

export interface StorageHealthPayload {
  notice: StorageNotice | null;
  error: string | null;
  writable: boolean;
  revision: number;
  backupDirectory: string;
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

function writeBlockMessage(): string | null {
  const storage = useSkribStore.getState();
  if (!storage.storageWritable) {
    return storage.storageErrorMessage || 'Local note storage is currently read-only to protect existing data.';
  }

  const status = useLicenseStore.getState().status;
  if (!status.enforcementEnabled || status.canWrite) return null;
  return status.message || 'Skribli is currently read-only on this device.';
}

interface SkribStoreState {
  activeTarget: TargetWindowInfo | null;
  availableWindows: TargetWindowInfo[];
  skribs: SkribNote[];
  overlayMetrics: OverlayMetrics;
  initStatus: OverlayInitializationStatus;
  isAmbiguous: boolean;
  isTauriAvailable: boolean;
  errorMessage: string | null;
  storageErrorMessage: string | null;
  storageNotice: StorageNotice | null;
  storageWritable: boolean;
  storageRevision: number;
  storageBackupDirectory: string;
  allSkribs: SkribNote[];
  isLibraryOpen: boolean;

  activeInteractionRect: { x: number; y: number; width: number; height: number } | null;
  setActiveInteractionRect: (
    rect: { x: number; y: number; width: number; height: number } | null
  ) => void;

  clearError: () => void;
  dismissStorageNotice: () => void;
  refreshStorageHealth: () => Promise<void>;
  exportStorageDiagnostics: () => Promise<string | null>;
  openLibrary: () => Promise<void>;
  closeLibrary: () => void;
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
  updateSkribText: (id: string, text: string) => Promise<boolean>;
  updateSkribColor: (id: string, color: SkribNote['color']) => Promise<void>;
  toggleSkribCollapse: (id: string) => Promise<void>;
  deleteSkrib: (id: string) => Promise<boolean>;
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
  isAmbiguous: false,
  isTauriAvailable: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  errorMessage: null,
  storageErrorMessage: null,
  storageNotice: null,
  storageWritable: true,
  storageRevision: 0,
  storageBackupDirectory: '',
  allSkribs: [],
  isLibraryOpen: false,
  activeInteractionRect: null,

  setActiveInteractionRect: (rect) => {
    set({ activeInteractionRect: rect });
  },

  clearError: () => {
    set({ errorMessage: null });
  },

  dismissStorageNotice: () => {
    set({ storageNotice: null });
  },

  refreshStorageHealth: async () => {
    if (!get().isTauriAvailable) return;
    try {
      const storageHealth = await invoke<StorageHealthPayload>('get_storage_health');
      set({
        storageNotice: storageHealth.notice,
        storageWritable: storageHealth.writable,
        storageRevision: storageHealth.revision,
        storageBackupDirectory: storageHealth.backupDirectory,
        storageErrorMessage: storageHealth.error
          ? `Local note storage needs attention: ${storageHealth.error}`
          : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ errorMessage: `Failed to read local storage health: ${message}` });
    }
  },

  exportStorageDiagnostics: async () => {
    if (!get().isTauriAvailable) return null;
    try {
      return await invoke<string>('export_storage_diagnostics');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ errorMessage: `Failed to export storage diagnostics: ${message}` });
      return null;
    }
  },

  openLibrary: async () => {
    if (!get().isTauriAvailable) {
      set({ allSkribs: get().skribs, isLibraryOpen: true });
      return;
    }
    try {
      const allSkribs = await invoke<SkribNote[]>('get_all_skribs');
      set({ allSkribs, isLibraryOpen: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ errorMessage: `Failed to open All Skribs: ${msg}` });
    }
  },

  closeLibrary: () => set({ isLibraryOpen: false }),

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
    set({ activeTarget: target, isAmbiguous: false });
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

  addSkrib: async (text = '', color = 'yellow') => {
    const blocked = writeBlockMessage();
    if (blocked) {
      set({ errorMessage: blocked });
      return;
    }

    const previousSkribs = get().skribs;
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

    set({ skribs: [...previousSkribs, newNote] });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('upsert_skrib_note', { note: newNote });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
        errorMessage: null,
        storageErrorMessage: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ skribs: previousSkribs, errorMessage: `Failed to create Skrib note: ${msg}` });
      await get().refreshStorageHealth();
    }
  },

  updateSkribPosition: async (id, rel_x, rel_y, width, height) => {
    const blocked = writeBlockMessage();
    if (blocked) {
      set({ errorMessage: blocked });
      return;
    }

    const previousSkribs = get().skribs;
    set({
      skribs: previousSkribs.map((n) =>
        n.id === id ? { ...n, rel_x, rel_y, width, height, updated_at: Math.floor(Date.now() / 1000) } : n
      ),
    });

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
        errorMessage: null,
        storageErrorMessage: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ skribs: previousSkribs, errorMessage: `Failed to save Skrib position: ${msg}` });
      await get().refreshStorageHealth();
    }
  },

  updateSkribText: async (id, text) => {
    const blocked = writeBlockMessage();
    if (blocked) {
      set({ errorMessage: blocked });
      return false;
    }

    const previousSkribs = get().skribs;
    set({
      skribs: previousSkribs.map((n) =>
        n.id === id ? { ...n, text, updated_at: Math.floor(Date.now() / 1000) } : n
      ),
    });

    if (!get().isTauriAvailable) return true;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_text', { id, text });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
        errorMessage: null,
        storageErrorMessage: null,
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({
        skribs: previousSkribs,
        errorMessage: `Failed to save text: ${msg}`,
        storageErrorMessage: `Failed to save text: ${msg}`,
      });
      await get().refreshStorageHealth();
      return false;
    }
  },

  updateSkribColor: async (id, color) => {
    const blocked = writeBlockMessage();
    if (blocked) {
      set({ errorMessage: blocked });
      return;
    }

    const previousSkribs = get().skribs;
    set({
      skribs: previousSkribs.map((n) => (n.id === id ? { ...n, color } : n)),
    });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('update_skrib_color', { id, color });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
        errorMessage: null,
        storageErrorMessage: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ skribs: previousSkribs, errorMessage: `Failed to change color: ${msg}` });
      await get().refreshStorageHealth();
    }
  },

  toggleSkribCollapse: async (id) => {
    const blocked = writeBlockMessage();
    if (blocked) {
      set({ errorMessage: blocked });
      return;
    }

    const previousSkribs = get().skribs;
    set({
      skribs: previousSkribs.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n)),
    });

    if (!get().isTauriAvailable) return;
    try {
      const payload = await invoke<OverlayStatePayload>('toggle_skrib_collapse', { id });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
        errorMessage: null,
        storageErrorMessage: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ skribs: previousSkribs, errorMessage: `Failed to toggle collapse: ${msg}` });
      await get().refreshStorageHealth();
    }
  },

  deleteSkrib: async (id) => {
    const blocked = writeBlockMessage();
    if (blocked) {
      set({ errorMessage: blocked });
      return false;
    }

    const previousSkribs = get().skribs;
    set({ skribs: previousSkribs.filter((n) => n.id !== id) });

    if (!get().isTauriAvailable) return true;
    try {
      const payload = await invoke<OverlayStatePayload>('delete_skrib_note', { id });
      set({
        skribs: payload.skribs,
        overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
        initStatus: payload.init_status || get().initStatus,
        errorMessage: null,
        storageErrorMessage: null,
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({
        skribs: previousSkribs,
        errorMessage: `Failed to delete Skrib: ${msg}`,
        storageErrorMessage: `Failed to delete Skrib: ${msg}`,
      });
      await get().refreshStorageHealth();
      return false;
    }
  },

  updateHitTestRects: async (rects) => {
    if (!get().isTauriAvailable) return;
    try {
      await invoke('set_hit_test_rects', { rects });
    } catch {
      // Hit-test synchronization is best-effort; native initialization errors are surfaced elsewhere.
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
            overlayMetrics: payload.overlay_metrics || get().overlayMetrics,
            initStatus: payload.init_status || get().initStatus,
          });
        });

        const hotkeyErrorUnlisten = await listen<string>('skribly://hotkey-error', (event) => {
          set({ errorMessage: event.payload });
        });

        const storageErrorUnlisten = await listen<string>('skribly://storage-error', (event) => {
          set({ storageErrorMessage: `Failed to save locally: ${event.payload}` });
          void get().refreshStorageHealth();
        });

        const initStatusUnlisten = await listen<OverlayInitializationStatus>('skribly://overlay-init-status', (event) => {
          set({ initStatus: event.payload });
        });

        unlistenCallbacks.push(overlayUnlisten, shortcutUnlisten, hotkeyErrorUnlisten, storageErrorUnlisten, initStatusUnlisten);

        await get().refreshStorageHealth();

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
