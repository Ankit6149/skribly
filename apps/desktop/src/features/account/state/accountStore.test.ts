import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccountClient: vi.fn(),
  claimAccountEntitlement: vi.fn(),
  clearAccountEntitlement: vi.fn(),
}));

vi.mock('../accountClient', () => ({
  getAccountClient: mocks.getAccountClient,
  claimAccountEntitlement: mocks.claimAccountEntitlement,
  clearAccountEntitlement: mocks.clearAccountEntitlement,
  withAccountTimeout: (operation: PromiseLike<unknown>) => Promise.resolve(operation),
}));
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn().mockResolvedValue(undefined) }));

const status = {
  mode: 'licensed' as const,
  enforcementEnabled: true,
  canWrite: true,
  trialDaysTotal: 0,
  trialDaysRemaining: 0,
  trialExpiresAt: null,
  deviceId: 'test-device',
  licensedEmail: 'person@example.test',
  updatesUntil: null,
  message: 'Verified',
};
const session = { user: { email: 'person@example.test' }, access_token: 'synthetic-session' } as never;

function fakeClient(getSession: () => Promise<unknown>) {
  return {
    client: { auth: { getSession } },
    configuration: {},
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.claimAccountEntitlement.mockResolvedValue({
    status,
    accountRole: 'owner',
    productUpdatesOptIn: true,
    announcements: [],
  });
  mocks.clearAccountEntitlement.mockResolvedValue(undefined);
});

describe('account session operations', () => {
  it('restores entitlement without treating an in-memory false default as a consent choice', async () => {
    mocks.getAccountClient.mockReturnValue(fakeClient(async () => ({ data: { session }, error: null })));
    const { useAccountStore } = await import('./accountStore');

    await useAccountStore.getState().init();

    expect(mocks.claimAccountEntitlement).toHaveBeenCalledWith(session, null, expect.any(Function));
    expect(useAccountStore.getState()).toMatchObject({ phase: 'ready', productUpdatesOptIn: true });
  });

  it('ignores an entitlement response after a newer sign-in reset', async () => {
    let resolveSession!: (value: unknown) => void;
    mocks.getAccountClient.mockReturnValue(fakeClient(() => new Promise((resolve) => { resolveSession = resolve; })));
    const { useAccountStore } = await import('./accountStore');
    const init = useAccountStore.getState().init();
    useAccountStore.getState().resetToSignIn();
    resolveSession({ data: { session }, error: null });

    await init;

    expect(mocks.claimAccountEntitlement).not.toHaveBeenCalled();
    expect(useAccountStore.getState().phase).toBe('signedOut');
  });

  it('shows a retryable error after a claim failure, then retries from session restore', async () => {
    mocks.getAccountClient.mockReturnValue(fakeClient(async () => ({ data: { session }, error: null })));
    mocks.claimAccountEntitlement
      .mockRejectedValueOnce(new Error('The account service timed out.'))
      .mockResolvedValueOnce({
        status,
        accountRole: 'owner',
        productUpdatesOptIn: true,
        announcements: [],
      });
    const { useAccountStore } = await import('./accountStore');

    await useAccountStore.getState().init();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'error',
      message: 'The account service timed out.',
    });

    await useAccountStore.getState().retry();

    expect(mocks.claimAccountEntitlement).toHaveBeenCalledTimes(2);
    expect(useAccountStore.getState()).toMatchObject({ phase: 'ready', productUpdatesOptIn: true });
  });

  it('does not report sign-out complete when clearing device access fails, and retry clears it', async () => {
    mocks.getAccountClient.mockReturnValue({
      client: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
      configuration: {},
    });
    mocks.clearAccountEntitlement
      .mockRejectedValueOnce(new Error('native service unavailable'))
      .mockResolvedValueOnce(undefined);
    const { useAccountStore } = await import('./accountStore');

    await useAccountStore.getState().signOut();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'error',
      message: expect.stringContaining('could not clear device access'),
    });

    await useAccountStore.getState().retry();

    expect(mocks.clearAccountEntitlement).toHaveBeenCalledTimes(2);
    expect(useAccountStore.getState()).toMatchObject({ phase: 'signedOut', entitlement: null });
  });

  it('keeps sign-out retryable when Supabase resolves with an auth error', async () => {
    const signOut = vi.fn()
      .mockResolvedValueOnce({ error: new Error('session revoke failed') })
      .mockResolvedValueOnce({ error: null });
    mocks.getAccountClient.mockReturnValue({
      client: { auth: { signOut } },
      configuration: {},
    });
    const { useAccountStore } = await import('./accountStore');

    await useAccountStore.getState().signOut();
    expect(useAccountStore.getState()).toMatchObject({
      phase: 'error',
      message: expect.stringContaining('session revoke failed'),
    });
    expect(mocks.clearAccountEntitlement).not.toHaveBeenCalled();

    await useAccountStore.getState().retry();

    expect(signOut).toHaveBeenCalledTimes(2);
    expect(mocks.clearAccountEntitlement).toHaveBeenCalledTimes(1);
    expect(useAccountStore.getState()).toMatchObject({ phase: 'signedOut', entitlement: null });
  });
});
