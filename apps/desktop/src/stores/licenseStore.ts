import { emit, listen } from '@tauri-apps/api/event';
import { create } from 'zustand';

export type LicenseMode = 'beta' | 'trial' | 'licensed' | 'expired' | 'clock_error';

export interface LicenseStatus {
  mode: LicenseMode;
  enforcementEnabled: boolean;
  canWrite: boolean;
  trialDaysTotal: number;
  trialDaysRemaining: number;
  trialExpiresAt: number | null;
  deviceId: string;
  licensedEmail: string | null;
  updatesUntil: number | null;
  message: string;
}

const BETA_STATUS: LicenseStatus = {
  mode: 'beta',
  enforcementEnabled: false,
  canWrite: true,
  trialDaysTotal: 7,
  trialDaysRemaining: 7,
  trialExpiresAt: null,
  deviceId: 'SKR-BETA',
  licensedEmail: null,
  updatesUntil: null,
  message: 'The current Windows beta is free while licence activation is validated.',
};

let setupPromise: Promise<void> | null = null;

interface LicenseStoreState {
  status: LicenseStatus;
  isReady: boolean;
  isActivating: boolean;
  errorMessage: string | null;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  activate: (key: string) => Promise<void>;
  clearError: () => void;
}

export const useLicenseStore = create<LicenseStoreState>((set, get) => ({
  status: BETA_STATUS,
  isReady: false,
  isActivating: false,
  errorMessage: null,

  init: async () => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      set({ isReady: true, status: BETA_STATUS });
      return;
    }

    if (!setupPromise) {
      setupPromise = (async () => {
        await Promise.all([
          listen<LicenseStatus>('skribly://license-status', (event) => {
            set({
              status: event.payload,
              isReady: true,
              isActivating: false,
              errorMessage: null,
            });
          }),
          listen<string>('skribly://license-error', (event) => {
            set({
              isReady: true,
              isActivating: false,
              errorMessage: event.payload,
            });
          }),
        ]);
      })();
    }

    await setupPromise;
    await get().refresh();
  },

  refresh: async () => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      set({ isReady: true, status: BETA_STATUS });
      return;
    }
    await emit('skribly://license-status-request');
  },

  activate: async (key) => {
    const trimmed = key.trim();
    if (!trimmed) {
      set({ errorMessage: 'Paste the licence key before activating.' });
      return;
    }
    set({ isActivating: true, errorMessage: null });
    await emit('skribly://license-activate', { key: trimmed });
  },

  clearError: () => set({ errorMessage: null }),
}));
