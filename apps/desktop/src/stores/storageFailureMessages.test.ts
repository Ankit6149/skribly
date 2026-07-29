import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { SkribNote } from '../lib/geometry';
import { useLicenseStore } from './licenseStore';
import { StorageHealthPayload, useSkribStore } from './skribStore';

const BETA_LICENSE = {
  mode: 'beta' as const,
  enforcementEnabled: false,
  canWrite: true,
  trialDaysTotal: 7,
  trialDaysRemaining: 7,
  trialExpiresAt: null,
  deviceId: 'SKR-STORAGE-FAILURE-TEST',
  licensedEmail: null,
  updatesUntil: null,
  message: 'Free beta',
};

const NOTE: SkribNote = {
  id: 'storage-failure-note',
  target_process_name: 'notepad.exe',
  target_title: 'Storage failure fixture',
  rel_x: 40,
  rel_y: 40,
  width: 320,
  height: 230,
  text: 'Last durable text',
  color: 'yellow',
  collapsed: false,
  created_at: 1,
  updated_at: 1,
};

function blockedHealth(error: string): StorageHealthPayload {
  return {
    notice: null,
    error,
    writable: false,
    revision: 7,
    backupDirectory: 'C:\\Users\\test\\AppData\\Roaming\\app.skribly.desktop',
  };
}

describe('storage failure messages', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useLicenseStore.setState({
      status: BETA_LICENSE,
      isReady: true,
      isActivating: false,
      errorMessage: null,
    });
    useSkribStore.setState({
      activeTarget: null,
      availableWindows: [],
      skribs: [NOTE],
      allSkribs: [NOTE],
      isLibraryOpen: false,
      isTauriAvailable: true,
      errorMessage: null,
      storageErrorMessage: null,
      storageNotice: null,
      storageWritable: true,
      storageRevision: 7,
      storageBackupDirectory: 'C:\\Users\\test\\AppData\\Roaming\\app.skribly.desktop',
    });
  });

  it.each([
    ['disk full', 'There is not enough space on the disk. (os error 112)'],
    ['permission denied', 'Access is denied. (os error 5)'],
    ['antivirus or indexer lock', 'The process cannot access the file because it is being used by another process. (os error 32)'],
    ['atomic rename denied', 'atomically replace storage generation failed for skribs.json: Access is denied. (os error 5)'],
  ])('keeps the durable note visible and surfaces a %s error', async (_name, nativeError) => {
    invokeMock
      .mockRejectedValueOnce(nativeError)
      .mockResolvedValueOnce(blockedHealth(nativeError));

    const saved = await useSkribStore
      .getState()
      .updateSkribText(NOTE.id, 'Unsaved replacement text');

    expect(saved).toBe(false);
    expect(useSkribStore.getState().skribs).toEqual([NOTE]);
    expect(useSkribStore.getState().errorMessage).toContain(nativeError);
    expect(useSkribStore.getState().storageErrorMessage).toContain(nativeError);
    expect(useSkribStore.getState().storageWritable).toBe(false);
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'update_skrib_text', {
      id: NOTE.id,
      text: 'Unsaved replacement text',
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'get_storage_health');
  });
});
