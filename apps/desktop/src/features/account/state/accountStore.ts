import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import {
  clearAccountEntitlement,
  claimAccountEntitlement,
  getAccountClient,
  withAccountTimeout,
  type AccountAnnouncement,
  type AccountEntitlementResult,
  type AccountRole,
} from '../accountClient';
import { emit } from '@tauri-apps/api/event';
import type { LicenseStatus } from '../../licensing/state/licenseStore';

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
  signIn: (email: string, password: string, productUpdatesOptIn: boolean | null) => Promise<void>;
  retry: () => Promise<void>;
  signOut: () => Promise<void>;
  resetToSignIn: () => void;
  clearMessage: () => void;
}

let initialization: Promise<void> | null = null;
let accountActionGeneration = 0;
let entitlementOperationGeneration = 0;
let pendingSignOutAuth = false;
let pendingSignOutClear = false;

function beginAccountAction(): number {
  accountActionGeneration += 1;
  entitlementOperationGeneration += 1;
  return accountActionGeneration;
}

function isCurrentAccountAction(generation: number): boolean {
  return generation === accountActionGeneration;
}

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
  productUpdatesOptIn: boolean | null,
  generation: number
): Promise<AccountEntitlementResult> {
  const entitlementGeneration = ++entitlementOperationGeneration;
  const isCurrentEntitlement = () =>
    isCurrentAccountAction(generation) && entitlementGeneration === entitlementOperationGeneration;
  try {
    return await withAccountTimeout(
      claimAccountEntitlement(session, productUpdatesOptIn, isCurrentEntitlement),
      'Account and device verification'
    );
  } catch (error) {
    if (isCurrentEntitlement()) entitlementOperationGeneration += 1;
    throw error;
  }
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
      const generation = beginAccountAction();
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
        if (!isCurrentAccountAction(generation)) return;
        set({
          phase: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      if (!isCurrentAccountAction(generation)) return;
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
        const result = await claim(data.session, null, generation);
        if (!isCurrentAccountAction(generation)) return;
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
        if (!isCurrentAccountAction(generation)) return;
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
    if (pendingSignOutAuth || pendingSignOutClear) {
      set({ phase: 'error', message: 'Finish signing out of the current account before creating another account.' });
      return;
    }
    const generation = beginAccountAction();
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
      if (!isCurrentAccountAction(generation)) return;
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
    if (!isCurrentAccountAction(generation)) return;
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
      const result = await claim(data.session, productUpdatesOptIn, generation);
      if (!isCurrentAccountAction(generation)) return;
      set({
        phase: 'ready',
        email: data.user?.email ?? email,
        accountRole: result.accountRole,
        entitlement: result.status,
        productUpdatesOptIn: result.productUpdatesOptIn,
        announcements: result.announcements,
      });
    } catch (claimError) {
      if (!isCurrentAccountAction(generation)) return;
      set({ phase: 'error', message: claimError instanceof Error ? claimError.message : String(claimError) });
    }
  },

  signIn: async (emailValue, password, productUpdatesOptIn) => {
    if (pendingSignOutAuth || pendingSignOutClear) {
      set({ phase: 'error', message: 'Finish signing out of the current account before signing in to another account.' });
      return;
    }
    const generation = beginAccountAction();
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

    set({ phase: 'loading', email, message: null });
    let response: Awaited<ReturnType<typeof configured.client.auth.signInWithPassword>>;
    try {
      response = await withAccountTimeout(
        configured.client.auth.signInWithPassword({ email, password }),
        'Sign in'
      );
    } catch (error) {
      if (!isCurrentAccountAction(generation)) return;
      set({
        phase: 'signedOut',
        email,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (!isCurrentAccountAction(generation)) return;
    const { data, error } = response;
    if (error || !data.session) {
      set({ phase: 'signedOut', message: error?.message || 'Sign-in did not create a session.' });
      return;
    }

    set({ phase: 'claiming' });
    try {
      const result = await claim(data.session, productUpdatesOptIn, generation);
      if (!isCurrentAccountAction(generation)) return;
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
      if (!isCurrentAccountAction(generation)) return;
      set({ phase: 'error', message: claimError instanceof Error ? claimError.message : String(claimError) });
    }
  },

  retry: async () => {
    if (pendingSignOutAuth) {
      await get().signOut();
      return;
    }
    if (pendingSignOutClear) {
      const generation = beginAccountAction();
      try {
        await clearAccountEntitlement();
        if (!isCurrentAccountAction(generation)) return;
        pendingSignOutClear = false;
        set({
          phase: 'signedOut',
          email: null,
          accountRole: null,
          entitlement: null,
          productUpdatesOptIn: false,
          announcements: [],
          message: null,
        });
        try {
          await emit('skribly://license-status-request');
        } catch (error) {
          if (!isCurrentAccountAction(generation)) return;
          set({
            message: `Signed out and cleared device access, but Skribli could not refresh the displayed access status: ${error instanceof Error ? error.message : String(error)}.`,
          });
        }
      } catch (error) {
        if (!isCurrentAccountAction(generation)) return;
        set({
          phase: 'error',
          message: `Skribli could not clear device access: ${error instanceof Error ? error.message : String(error)}. Try again.`,
        });
      }
      return;
    }
    await get().init();
  },

  signOut: async () => {
    const generation = beginAccountAction();
    const configured = getAccountClient();
    pendingSignOutAuth = Boolean(configured);
    try {
      if (configured) {
        const response = await withAccountTimeout(
          configured.client.auth.signOut({ scope: 'local' }),
          'Sign out'
        );
        if (response.error) throw response.error;
      }
    } catch (error) {
      if (isCurrentAccountAction(generation)) {
        set({ phase: 'error', message: `Skribli could not finish signing out: ${error instanceof Error ? error.message : String(error)}.` });
      }
      return;
    }
    pendingSignOutAuth = false;
    if (!isCurrentAccountAction(generation)) return;
    pendingSignOutClear = true;
    try {
      await clearAccountEntitlement();
    } catch (error) {
      if (isCurrentAccountAction(generation)) {
        set({
          phase: 'error',
          message: `Account signed out, but Skribli could not clear device access: ${error instanceof Error ? error.message : String(error)}. Retry to finish sign-out.`,
        });
      }
      return;
    }
    pendingSignOutClear = false;
    if (!isCurrentAccountAction(generation)) return;
    set({
      phase: 'signedOut',
      email: null,
      accountRole: null,
      entitlement: null,
      productUpdatesOptIn: false,
      announcements: [],
      message: null,
    });
    try {
      await emit('skribly://license-status-request');
    } catch (error) {
      set({
        message: `Signed out and cleared device access, but Skribli could not refresh the displayed access status: ${error instanceof Error ? error.message : String(error)}.`,
      });
    }
  },

  resetToSignIn: () => {
    beginAccountAction();
    set((state) => ({
      phase: 'signedOut',
      accountRole: null,
      entitlement: null,
      announcements: [],
      message: null,
      email: state.email,
    }));
  },

  clearMessage: () => set({ message: null }),
}));
