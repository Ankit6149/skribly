// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryHost } from './LibraryHost';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => undefined),
}));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({
  onFocusChanged: vi.fn().mockResolvedValue(() => undefined),
}) }));
vi.mock('../licensing/state/licenseStore', () => ({
  useLicenseStore: (select: (state: unknown) => unknown) => select({ status: { enforcementEnabled: false, canWrite: true } }),
}));
vi.mock('./LibraryImportPanel', () => ({ LibraryImportPanel: () => null }));
vi.mock('./LibraryRichContent', () => ({ LibraryRichContent: () => null }));
vi.mock('./ReminderCalendar', () => ({ ReminderCalendar: () => null }));

let container: HTMLDivElement;
let root: Root;
const savedNotes = [{
  id: 'test-note', target_process_name: '', target_title: '',
  rel_x: 0, rel_y: 0, width: 400, height: 340,
  text: 'Saved thought', color: 'yellow', collapsed: false, created_at: 1, updated_at: 1,
}];
function refreshButton() {
  return Array.from(container.querySelectorAll('button')).find((button) => /Refresh/.test(button.textContent ?? ''))!;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.invoke.mockImplementation((command: string) => Promise.resolve(command === 'get_all_skribs' ? savedNotes : { writable: true }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('library refresh feedback', () => {
  it('keeps saved content visible and disables Refresh until a repeat read completes', async () => {
    await act(async () => root.render(<LibraryHost />));
    let finish!: (value: typeof savedNotes) => void;
    const pending = new Promise<typeof savedNotes>((resolve) => { finish = resolve; });
    mocks.invoke.mockImplementation((command: string) => command === 'get_all_skribs' ? pending : Promise.resolve({ writable: true }));
    await act(async () => refreshButton().click());
    expect(refreshButton().disabled).toBe(true);
    expect(refreshButton().textContent).toBe('Refreshing…');
    expect(container.textContent).toContain('Saved thought');
    await act(async () => finish(savedNotes));
    expect(refreshButton().disabled).toBe(false);
    expect(refreshButton().textContent).toBe('Refresh');
  });

  it('shows failed verification after a read error and recovers on retry', async () => {
    mocks.invoke.mockImplementation((command: string) => command === 'get_all_skribs' ? Promise.reject(new Error('Read failed')) : Promise.resolve({ writable: true }));
    await act(async () => root.render(<LibraryHost />));
    expect(container.textContent).toContain('Could not verify storage');
    expect(container.textContent).not.toContain('Checking storage:');
    expect(container.textContent).toContain('Read failed');
    mocks.invoke.mockImplementation((command: string) => Promise.resolve(command === 'get_all_skribs' ? savedNotes : { writable: true }));
    await act(async () => refreshButton().click());
    expect(container.textContent).toContain('Saved thought');
    expect(container.textContent).not.toContain('Read failed');
    expect(container.textContent).not.toContain('Could not verify storage');
  });
});
