import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import {
  claimAccountEntitlement,
  getAccountClient,
  withAccountTimeout,
  type AccountAnnouncement,
  type AccountEntitlementResult,
  type AccountRole,
} from '../features/account/accountClient';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { LicenseStatus } from './licenseStore';

export type AccountPhase =
  | 'loading'
  | 'configurationRequired'
  | 'signedOut'
  | 'verificationPending'
  | 'claiming'
  | 'ready'
  | 'error';

interface AccountStoreState {
  phase: AccountPhase;
  email: string | null;
  accountRole: AccountRole | null;
  entitlement: LicenseStatus | null;
  productUpdatesOptIn: boolean;
  announcements: AccountAnnouncement[];
  message: string | null;
  init: () => Promise<void>;
  signUp: (email: string, password: string, productUpdatesOptIn: boolean) => Promise<void>;
  signIn: (email: string, password: string, productUpdatesOptIn: boolean) => Promise<void>;
  retry: () => Promise<void>;
  signOut: () => Promise<void>;
  resetToSignIn: () => void;
  clearMessage: () => void;
}

let initialization: Promise<void> | null = null;

function cleanEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return 'Enter a valid email address.';
  }
  if (password.length < 12 || password.length > 128) {
    return 'Use a password between 12 and 128 characters.';
  }
  return null;
}

async function claim(
  session: Session,
  productUpdatesOptIn: boolean
): Promise<AccountEntitlementResult> {
  return withAccountTimeout(
    claimAccountEntitlement(session, productUpdatesOptIn),
    'Account and device verification'
  );
}

export const useAccountStore = create<AccountStoreState>((set, get) => ({
  phase: 'loading',
  email: null,
  accountRole: null,
  entitlement: null,
  productUpdatesOptIn: false,
  announcements: [],
  message: null,

  init: async () => {
    if (initialization) return initialization;
    initialization = (async () => {
      const configured = getAccountClient();
      if (!configured) {
        set({
          phase: 'configurationRequired',
          message: 'This build is missing the Skribli account service configuration.',
        });
        return;
      }

      set({ phase: 'loading', message: null });
      let response: Awaited<ReturnType<typeof configured.client.auth.getSession>>;
      try {
        response = await withAccountTimeout(
          configured.client.auth.getSession(),
          'Protected session restore'
        );
      } catch (error) {
        set({
          phase: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      const { data, error } = response;
      if (error) {
        set({ phase: 'error', message: error.message });
        return;
      }
      if (!data.session) {
        set({ phase: 'signedOut', email: null, accountRole: null, entitlement: null });
        return;
      }

      set({ phase: 'claiming', email: data.session.user.email ?? null });
      try {
        const result = await claim(data.session, get().productUpdatesOptIn);
        set({
          phase: 'ready',
          email: data.session.user.email ?? null,
          accountRole: result.accountRole,
          entitlement: result.status,
          productUpdatesOptIn: result.productUpdatesOptIn,
          announcements: result.announcements,
          message: null,
        });
      } catch (error) {
        set({
          phase: 'error',
          email: data.session.user.email ?? null,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })().finally(() => {
      initialization = null;
    });
    return initialization;
  },

  signUp: async (emailValue, password, productUpdatesOptIn) => {
    const email = cleanEmail(emailValue);
    const validation = validateCredentials(email, password);
    if (validation) {
      set({ phase: 'signedOut', message: validation });
      return;
    }
    const configured = getAccountClient();
    if (!configured) {
      set({ phase: 'configurationRequired', message: 'Account services are unavailable.' });
      return;
    }

    set({ phase: 'loading', email, productUpdatesOptIn, message: null });
    let response: Awaited<ReturnType<typeof configured.client.auth.signUp>>;
    try {
      response = await withAccountTimeout(
        configured.client.auth.signUp({ email, password }),
        'Account creation'
      );
    } catch (error) {
      set({
        phase: 'verificationPending',
        email,
        message:
          error instanceof Error
            ? `${error.message} If the account was created, use Sign in instead of creating it again.`
            : String(error),
      });
      return;
    }
    const { data, error } = response;
    if (error) {
      set({ phase: 'signedOut', message: error.message });
      return;
    }
    if (!data.session) {
      set({
        phase: 'verificationPending',
        email,
        message: 'Check your email, verify the address, then return here and sign in.',
      });
      return;
    }

    set({ phase: 'claiming' });
    try {
      const result = await claim(data.session, productUpdatesOptIn);
      set({
        phase: 'ready',
        email: data.user?.email ?? email,
        accountRole: result.accountRole,
        entitlement: result.status,
        productUpdatesOptIn: result.productUpdatesOptIn,
        announcements: result.announcements,
      });
    } catch (claimError) {
      set({ phase: 'error', message: claimError instanceof Error ? claimError.message : String(claimError) });
    }
  },

  signIn: async (emailValue, password, productUpdatesOptIn) => {
    const email = cleanEmail(emailValue);
    const validation = validateCredentials(email, password);
    if (validation) {
      set({ phase: 'signedOut', message: validation });
      return;
    }
    const configured = getAccountClient();
    if (!configured) {
      set({ phase: 'configurationRequired', message: 'Account services are unavailable.' });
      return;
    }

    set({ phase: 'loading', email, productUpdatesOptIn, message: null });
    let response: Awaited<ReturnType<typeof configured.client.auth.signInWithPassword>>;
    try {
      response = await withAccountTimeout(
        configured.client.auth.signInWithPassword({ email, password }),
        'Sign in'
      );
    } catch (error) {
      set({
        phase: 'signedOut',
        email,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const { data, error } = response;
    if (error || !data.session) {
      set({ phase: 'signedOut', message: error?.message || 'Sign-in did not create a session.' });
      return;
    }

    set({ phase: 'claiming' });
    try {
      const result = await claim(data.session, productUpdatesOptIn);
      set({
        phase: 'ready',
        email: data.user.email ?? email,
        accountRole: result.accountRole,
        entitlement: result.status,
        productUpdatesOptIn: result.productUpdatesOptIn,
        announcements: result.announcements,
        message: null,
      });
    } catch (claimError) {
      set({ phase: 'error', message: claimError instanceof Error ? claimError.message : String(claimError) });
    }
  },

  retry: async () => {
    await get().init();
  },

  signOut: async () => {
    const configured = getAccountClient();
    if (configured) await configured.client.auth.signOut({ scope: 'local' });
    await invoke('clear_account_entitlement').catch(() => undefined);
    await emit('skribly://license-status-request');
    set({
      phase: 'signedOut',
      email: null,
      accountRole: null,
      entitlement: null,
      productUpdatesOptIn: false,
      announcements: [],
      message: null,
    });
  },

  resetToSignIn: () =>
    set((state) => ({
      phase: 'signedOut',
      accountRole: null,
      entitlement: null,
      announcements: [],
      message: null,
      email: state.email,
    })),

  clearMessage: () => set({ message: null }),
}));
