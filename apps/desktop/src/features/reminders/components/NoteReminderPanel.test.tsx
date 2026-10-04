// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteReminderPanel } from './NoteReminderPanel';
import type { ReminderWithStatus } from '../persistence/reminderStore';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../persistence/reminderStore', () => ({
  completeReminder: vi.fn(),
  deleteReminder: vi.fn(),
  dismissReminder: vi.fn(),
  listReminders: mocks.list,
  rescheduleReminder: vi.fn(),
  scheduleReminder: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('note reminder reads', () => {
  it('ignores a stale reminder response after switching to another note', async () => {
    const first = deferred<ReminderWithStatus[]>();
    const second = deferred<ReminderWithStatus[]>();
    mocks.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    await act(async () => root.render(<NoteReminderPanel noteId="first-note" noteText="First" />));
    await act(async () => root.render(<NoteReminderPanel noteId="second-note" noteText="Second" />));

    await act(async () => second.resolve([{
      id: 'second-reminder', noteId: 'second-note', title: 'Second note reminder', dueAt: Date.now() + 86_400_000,
      createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, dismissedAt: null, notifiedAt: null, status: 'upcoming',
    }]));
    expect(container.textContent).toContain('Second note reminder');

    await act(async () => first.resolve([{
      id: 'first-reminder', noteId: 'first-note', title: 'Stale first note reminder', dueAt: Date.now() + 86_400_000,
      createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, dismissedAt: null, notifiedAt: null, status: 'upcoming',
    }]));
    expect(container.textContent).toContain('Second note reminder');
    expect(container.textContent).not.toContain('Stale first note reminder');
  });
});
