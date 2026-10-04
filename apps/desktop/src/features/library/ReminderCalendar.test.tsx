// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReminderCalendar } from './ReminderCalendar';

const mocks = vi.hoisted(() => ({ getCalendar: vi.fn(), complete: vi.fn(), dismiss: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => undefined),
}));
vi.mock('../reminders/persistence/reminderStore', () => ({
  completeReminder: mocks.complete,
  dismissReminder: mocks.dismiss,
  getReminderCalendar: mocks.getCalendar,
}));

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
  vi.restoreAllMocks();
});

describe('reminder calendar recovery and keyboard behavior', () => {
  it('does not show an empty agenda after a failed read and retries successfully', async () => {
    mocks.getCalendar.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    await act(async () => root.render(<ReminderCalendar notes={[]} onOpenNote={() => undefined} canWrite={false} />));
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain('Could not read reminders: offline');
    expect(container.textContent).toContain('Reminders could not be loaded');
    expect(container.textContent).not.toContain('Nothing due');

    const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retry')!;
    await act(async () => retry.click());
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('Nothing due');
  });

  it('keeps one day in the Tab order and moves selection by arrow keys', async () => {
    mocks.getCalendar.mockResolvedValue([]);
    await act(async () => root.render(<ReminderCalendar notes={[]} onOpenNote={() => undefined} canWrite />));
    await act(async () => Promise.resolve());

    const dayButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.reminder-days button'));
    expect(dayButtons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    const selected = dayButtons.find((button) => button.getAttribute('aria-pressed') === 'true')!;
    const before = selected.getAttribute('aria-label');
    await act(async () => selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    const nextSelected = container.querySelector<HTMLButtonElement>('.reminder-days button[aria-pressed="true"]')!;
    expect(nextSelected.getAttribute('aria-label')).not.toBe(before);
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.reminder-days button')).filter((button) => button.tabIndex === 0)).toHaveLength(1);
  });
});
