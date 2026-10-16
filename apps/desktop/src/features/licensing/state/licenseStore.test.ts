import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLicenseStore } from './licenseStore';

const events=vi.hoisted(()=>({emit:vi.fn(async()=>undefined)}));
vi.mock('@tauri-apps/api/event',()=>({emit:events.emit,listen:vi.fn(async()=>()=>undefined)}));
afterEach(()=>{vi.unstubAllGlobals();events.emit.mockReset();});

const betaStatus = {
  mode: 'beta' as const,
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

describe('licenseStore', () => {
  beforeEach(() => {
    useLicenseStore.setState({
      status: betaStatus,
      isReady: true,
      isActivating: false,
      errorMessage: null,
    });
  });

  it('keeps the browser preview in unrestricted beta mode', async () => {
    await useLicenseStore.getState().refresh();
    expect(useLicenseStore.getState().status).toEqual(betaStatus);
    expect(useLicenseStore.getState().isReady).toBe(true);
  });

  it('rejects an empty activation key without entering a loading state', async () => {
    await useLicenseStore.getState().activate('   ');
    expect(useLicenseStore.getState().isActivating).toBe(false);
    expect(useLicenseStore.getState().errorMessage).toBe('Paste the licence key before activating.');
  });

  it('keeps an unresolved native edition unresolved when requesting status fails',async()=>{
    vi.stubGlobal('window',{__TAURI_INTERNALS__:{}});
    useLicenseStore.setState({hasNativeStatus:false});
    events.emit.mockRejectedValueOnce(new Error('Native bridge unavailable'));
    await expect(useLicenseStore.getState().refresh()).resolves.toBeUndefined();
    expect(useLicenseStore.getState().hasNativeStatus).toBe(false);
    expect(useLicenseStore.getState().errorMessage).toBe('Native bridge unavailable');
  });

  it('clears activation errors explicitly', () => {
    useLicenseStore.setState({ errorMessage: 'Invalid licence' });
    useLicenseStore.getState().clearError();
    expect(useLicenseStore.getState().errorMessage).toBeNull();
  });
});
