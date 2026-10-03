import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useLicenseStore } from '../../licensing/state/licenseStore';
import { useSkribStore } from './skribStore';
import type { SkribNote } from '../model/noteTypes';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const note: SkribNote = { id: 'color-note', text: 'A', color: 'yellow', target_process_name: 'Code.exe', target_title: 'Synthetic',
  rel_x: 0, rel_y: 0, width: 520, height: 500, collapsed: false, created_at: 1, updated_at: 1 };
beforeEach(() => {
  vi.mocked(invoke).mockReset();
  useLicenseStore.setState({ status: { ...useLicenseStore.getState().status, enforcementEnabled: false, canWrite: true } });
  useSkribStore.setState({ skribs: [note], allSkribs: [note], isTauriAvailable: true, storageWritable: true, errorMessage: null });
});

it('returns durable color success without replacing a newer typed draft from an old native payload', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementation(() => new Promise((yes) => { resolve = yes; }));
  const changing = useSkribStore.getState().updateSkribColor(note.id, 'mint');
  useSkribStore.setState({ skribs: [{ ...note, text: 'Newer B', color: 'mint' }] });
  resolve({ skribs: [{ ...note, color: 'mint' }] });
  expect(await changing).toBe(true);
  expect(useSkribStore.getState().skribs[0]).toMatchObject({ text: 'Newer B', color: 'mint' });
});

it('reports rejected color persistence and restores only color, retaining newer text', async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(invoke).mockImplementation((command) => command === 'update_skrib_color'
    ? new Promise((_yes, no) => { reject = no; }) : Promise.resolve({ writable: true, notice: null, error: null, revision: 1, backupDirectory: '' }));
  const changing = useSkribStore.getState().updateSkribColor(note.id, 'mint');
  useSkribStore.setState({ skribs: [{ ...note, text: 'Kept B', color: 'mint' }] });
  reject(new Error('Synthetic disk failure'));
  expect(await changing).toBe(false);
  expect(useSkribStore.getState().skribs[0]).toMatchObject({ text: 'Kept B', color: 'yellow' });
});
