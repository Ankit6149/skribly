import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { createClient, type Session, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { LicenseStatus } from '../../stores/licenseStore';

export interface AccountConfiguration {
  supabaseUrl: string;
  publishableKey: string;
  entitlementFunction: string;
  appVersion: string;
}

export interface AccountEntitlementResult {
  status: LicenseStatus;
  productUpdatesOptIn: boolean;
  announcements: AccountAnnouncement[];
}

export interface AccountAnnouncement {
  id: string;
  title: string;
  body: string;
  actionLabel: string | null;
  actionUrl: string | null;
}

const DEFAULT_ACCOUNT_URL = 'https://bccgutpkjxtogqbywsxr.supabase.co';
const DEFAULT_ACCOUNT_PUBLISHABLE_KEY = 'sb_publishable_bjfNO80Oxx-gjuOAl8uXEA_YtdvCSHL';

const browserFallbackStorage = new Map<string, string>();

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const protectedSessionStorage: SupportedStorage = {
  getItem: async (key) => {
    if (!isTauriRuntime()) return browserFallbackStorage.get(key) ?? null;
    return invoke<string | null>('account_session_get', { key });
  },
  setItem: async (key, value) => {
    if (!isTauriRuntime()) {
      browserFallbackStorage.set(key, value);
      return;
    }
    await invoke('account_session_set', { key, value });
  },
  removeItem: async (key) => {
    if (!isTauriRuntime()) {
      browserFallbackStorage.delete(key);
      return;
    }
    await invoke('account_session_remove', { key });
  },
};

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function readAccountConfiguration(): AccountConfiguration | null {
  const supabaseUrl = String(
    import.meta.env.VITE_SKRIBLY_ACCOUNT_URL || DEFAULT_ACCOUNT_URL
  ).trim();
  const publishableKey = String(
    import.meta.env.VITE_SKRIBLY_ACCOUNT_PUBLISHABLE_KEY || DEFAULT_ACCOUNT_PUBLISHABLE_KEY
  ).trim();
  const entitlementFunction = String(
    import.meta.env.VITE_SKRIBLY_ACCOUNT_FUNCTION || 'account-session'
  ).trim();
  const appVersion = String(import.meta.env.VITE_SKRIBLY_APP_VERSION || '0.1.6').trim();

  if (
    !isHttpsUrl(supabaseUrl) ||
    publishableKey.length < 24 ||
    !/^[a-z0-9-]{3,80}$/.test(entitlementFunction) ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(appVersion)
  ) {
    return null;
  }

  return { supabaseUrl, publishableKey, entitlementFunction, appVersion };
}

let accountClient: SupabaseClient | null = null;
let accountClientConfiguration: AccountConfiguration | null = null;

export function getAccountClient(): {
  client: SupabaseClient;
  configuration: AccountConfiguration;
} | null {
  const configuration = readAccountConfiguration();
  if (!configuration) return null;

  if (
    !accountClient ||
    accountClientConfiguration?.supabaseUrl !== configuration.supabaseUrl ||
    accountClientConfiguration?.publishableKey !== configuration.publishableKey
  ) {
    accountClient = createClient(configuration.supabaseUrl, configuration.publishableKey, {
      auth: {
        storage: protectedSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'X-Skribli-Client': `desktop/${configuration.appVersion}`,
        },
      },
    });
    accountClientConfiguration = configuration;
  }

  return { client: accountClient, configuration };
}

interface EntitlementFunctionPayload {
  signedEntitlement: string;
  productUpdatesOptIn: boolean;
  announcements: AccountAnnouncement[];
}

export function parseEntitlementPayload(value: unknown): EntitlementFunctionPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('The Skribli account server returned an unreadable response.');
  }
  const candidate = value as Partial<EntitlementFunctionPayload>;
  const announcements = Array.isArray(candidate.announcements)
    ? candidate.announcements.filter((item): item is AccountAnnouncement => {
        if (!item || typeof item !== 'object') return false;
        const announcement = item as Partial<AccountAnnouncement>;
        return (
          typeof announcement.id === 'string' &&
          typeof announcement.title === 'string' &&
          announcement.title.length <= 120 &&
          typeof announcement.body === 'string' &&
          announcement.body.length <= 500 &&
          (announcement.actionLabel === null || typeof announcement.actionLabel === 'string') &&
          (announcement.actionUrl === null ||
            (typeof announcement.actionUrl === 'string' &&
              announcement.actionUrl.startsWith('https://')))
        );
      })
    : [];
  if (
    typeof candidate.signedEntitlement !== 'string' ||
    candidate.signedEntitlement.length < 80 ||
    candidate.signedEntitlement.length > 16 * 1024 ||
    typeof candidate.productUpdatesOptIn !== 'boolean'
  ) {
    throw new Error('The Skribli account server returned an invalid entitlement.');
  }
  return { ...candidate, announcements } as EntitlementFunctionPayload;
}

export async function claimAccountEntitlement(
  session: Session,
  productUpdatesOptIn: boolean
): Promise<AccountEntitlementResult> {
  const configured = getAccountClient();
  if (!configured) throw new Error('Skribli account services are not configured in this build.');
  if (!isTauriRuntime()) {
    throw new Error('Account-backed trials must be claimed from the installed Windows app.');
  }

  const deviceClaim = await invoke<string>('get_account_device_claim');
  const { data, error } = await configured.client.functions.invoke(
    configured.configuration.entitlementFunction,
    {
      body: {
        deviceClaim,
        appVersion: configured.configuration.appVersion,
        productUpdatesOptIn,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );
  if (error) throw new Error(error.message || 'Skribli could not verify this account and device.');

  const payload = parseEntitlementPayload(data);
  const status = await invoke<LicenseStatus>('apply_account_entitlement', {
    token: payload.signedEntitlement,
  });
  await emit('skribly://license-status-request');
  return {
    status,
    productUpdatesOptIn: payload.productUpdatesOptIn,
    announcements: payload.announcements,
  };
}
