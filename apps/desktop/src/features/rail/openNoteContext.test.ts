import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import type { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import { openNoteHere, openNoteInSavedContext } from './openNoteContext';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn(), listen: vi.fn() }));
const invokeMock = vi.mocked(invoke);
const note: SkribNote = {
  id: 'saved-note', target_process_name: 'chrome.exe', target_title: 'Project — Google Chrome',
  rel_x: 180, rel_y: 120, width: 420, height: 360, text: 'A thought', color: 'mint',
  collapsed: true, created_at: 1, updated_at: 1,
};
const target = { hwnd_val: 42, process_name: 'chrome.exe', title: note.target_title } as TargetWindowInfo;

beforeEach(() => { vi.resetAllMocks(); });

describe('rail note actions', () => {
  it('Open here opens a real detached note without focus, navigation, or collapse mutations', async () => {
    invokeMock.mockResolvedValue(undefined);
    await openNoteHere(note);
    expect(invokeMock.mock.calls).toEqual([['get_open_skrib_note_id'], ['open_skrib_note_here', { id: note.id }]]);
    expect(note.collapsed).toBe(true);
    expect([note.rel_x, note.rel_y]).toEqual([180, 120]);
  });

  it('Open at saved location focuses the matching target before opening the note', async () => {
    invokeMock.mockImplementation(async (command) => command === 'list_target_windows' ? [target] : undefined);
    await expect(openNoteInSavedContext(note)).resolves.toBe('Opened in Chrome.');
    expect(invokeMock.mock.calls).toEqual([
      ['get_open_skrib_note_id'],
      ['list_target_windows'],
      ['focus_target_window', { hwndVal: 42 }],
      ['set_active_target', { target }],
      ['set_skrib_window_collapsed', { id: note.id, collapsed: false }],
    ]);
  });

  it('waits for the current draft to save before replacing the editor', async () => {
    invokeMock.mockImplementation(async (command) => command === 'get_open_skrib_note_id' ? 'other-note' : undefined);
    const dispose = vi.fn();
    let respond: (event: { payload: { requestId: string; ready: boolean } }) => void;
    vi.mocked(listen).mockImplementation(async (_event, callback) => {
      respond = callback as typeof respond;
      return dispose;
    });
    vi.mocked(emitTo).mockImplementation(async (_window, _event, payload) => {
      expect(invokeMock).not.toHaveBeenCalledWith('open_skrib_note_here', expect.anything());
      respond({ payload: { requestId: (payload as { requestId: string }).requestId, ready: true } });
    });
    await openNoteHere(note);
    expect(invokeMock).toHaveBeenLastCalledWith('open_skrib_note_here', { id: note.id });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('keeps the current editor when a draft or drawing could not be saved', async () => {
    invokeMock.mockResolvedValue('other-note');
    let respond: (event: { payload: { requestId: string; ready: boolean } }) => void;
    vi.mocked(listen).mockImplementation(async (_event, callback) => {
      respond = callback as typeof respond;
      return vi.fn<() => void>();
    });
    vi.mocked(emitTo).mockImplementation(async (_window, _event, payload) => {
      respond({ payload: { requestId: (payload as { requestId: string }).requestId, ready: false } });
    });
    await expect(openNoteHere(note)).rejects.toThrow('Finish saving');
    expect(invokeMock).not.toHaveBeenCalledWith('open_skrib_note_here', expect.anything());
  });

  it('surfaces an opening failure instead of pretending the note opened', async () => {
    invokeMock.mockRejectedValue(new Error('The note is unavailable.'));
    await expect(openNoteHere(note)).rejects.toThrow('The note is unavailable.');
  });
});
