import { describe, expect, it, vi } from 'vitest';
import {
  applyEntitlementWhenCurrent,
  parseEntitlementPayload,
  protectedSessionStorage,
  readAccountConfiguration,
  withAccountTimeout,
} from './accountClient';

const SIGNED_TOKEN = `${'a'.repeat(90)}.${'b'.repeat(86)}`;

describe('account client boundary', () => {
  it('skips a stale entitlement after the account action changes while a native update is queued', async () => {
    let current = true;
    let resolveFirst!: (value: { mode: 'beta'; enforcementEnabled: false; canWrite: true; trialDaysTotal: number; trialDaysRemaining: number; trialExpiresAt: null; deviceId: string; licensedEmail: null; updatesUntil: null; message: string }) => void;
    const status = {
      mode: 'beta' as const, enforcementEnabled: false as const, canWrite: true as const,
      trialDaysTotal: 7, trialDaysRemaining: 7, trialExpiresAt: null, deviceId: 'test',
      licensedEmail: null, updatesUntil: null, message: 'test',
    };
    const firstApply = vi.fn(() => new Promise<typeof status>((resolve) => { resolveFirst = resolve; }));
    const staleApply = vi.fn(async () => status);
    const first = applyEntitlementWhenCurrent('first-token', () => true, firstApply);
    await Promise.resolve();
    const stale = applyEntitlementWhenCurrent('stale-token', () => current, staleApply);
    current = false;
    resolveFirst(status);

    await expect(first).resolves.toEqual(status);
    await expect(stale).rejects.toThrow('superseded');
    expect(firstApply).toHaveBeenCalledOnce();
    expect(staleApply).not.toHaveBeenCalled();
  });

  it('ships a functional free account-service configuration', () => {
    const configuration = readAccountConfiguration();
    expect(configuration?.supabaseUrl).toBe('https://bccgutpkjxtogqbywsxr.supabase.co');
    expect(configuration?.publishableKey).toMatch(/^sb_publishable_/);
    expect(configuration?.entitlementFunction).toBe('account-session');
    expect(configuration?.appVersion).toBe('0.1.32');
  });

  it('uses an async storage contract outside the installed Tauri runtime', async () => {
    const key = 'sb-account-client-test-auth-token';
    await protectedSessionStorage.setItem(key, 'protected-session-value');
    await expect(protectedSessionStorage.getItem(key)).resolves.toBe('protected-session-value');
    await protectedSessionStorage.removeItem(key);
    await expect(protectedSessionStorage.getItem(key)).resolves.toBeNull();
  });

  it('accepts a bounded signed entitlement and safe announcement', () => {
    const parsed = parseEntitlementPayload({
      signedEntitlement: SIGNED_TOKEN,
      accountRole: 'owner',
      productUpdatesOptIn: true,
      announcements: [
        {
          id: 'announcement-1',
          title: 'A safer update',
          body: 'Restart Skribli after installing the next private candidate.',
          actionLabel: 'Read details',
          actionUrl: 'https://skribly-desktop.vercel.app/release-notes',
        },
      ],
    });
    expect(parsed.productUpdatesOptIn).toBe(true);
    expect(parsed.accountRole).toBe('owner');
    expect(parsed.announcements).toHaveLength(1);
  });

  it('drops unsafe announcement actions without rejecting the entitlement', () => {
    const parsed = parseEntitlementPayload({
      signedEntitlement: SIGNED_TOKEN,
      accountRole: 'member',
      productUpdatesOptIn: false,
      announcements: [
        {
          id: 'announcement-1',
          title: 'Unsafe action',
          body: 'This action must not reach the UI.',
          actionLabel: 'Open',
          actionUrl: 'javascript:alert(1)',
        },
      ],
    });
    expect(parsed.announcements).toEqual([]);
  });

  it('rejects malformed entitlement responses', () => {
    expect(() =>
      parseEntitlementPayload({
        signedEntitlement: 'not-signed',
        accountRole: 'member',
        productUpdatesOptIn: false,
        announcements: [],
      })
    ).toThrow('invalid entitlement');
  });

  it('bounds account operations so the startup gate cannot spin forever', async () => {
    await expect(
      withAccountTimeout(new Promise(() => undefined), 'Session restore', 5)
    ).rejects.toThrow('will not stay stuck');
  });

  it('rejects client payloads that omit the trusted server account role', () => {
    expect(() =>
      parseEntitlementPayload({
        signedEntitlement: SIGNED_TOKEN,
        productUpdatesOptIn: false,
        announcements: [],
      })
    ).toThrow('invalid entitlement');
  });
});
