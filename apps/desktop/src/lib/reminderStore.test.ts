import { describe, expect, it } from 'vitest';
import {
  createMemoryReminderPersistence,
  createReminderDeletionHook,
  createReminderStore,
  getReminderStatus,
  groupRemindersByCalendarDay,
  type SkribReminder,
} from './reminderStore';

const HOUR = 60 * 60 * 1000;
const BASE_TIME = Date.UTC(2026, 7, 21, 10, 0, 0);

function reminder(overrides: Partial<SkribReminder> = {}): SkribReminder {
  return {
    id: 'reminder-1',
    noteId: 'note-1',
    title: 'Review the sketch',
    dueAt: BASE_TIME + HOUR,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    completedAt: null,
    dismissedAt: null,
    notifiedAt: null,
    ...overrides,
  };
}

describe('reminder state', () => {
  it('derives upcoming, overdue, completed, and dismissed states', () => {
    expect(getReminderStatus(reminder(), BASE_TIME)).toBe('upcoming');
    expect(getReminderStatus(reminder(), BASE_TIME + 2 * HOUR)).toBe('overdue');
    expect(getReminderStatus(reminder({ completedAt: BASE_TIME }), BASE_TIME + 2 * HOUR)).toBe('completed');
    expect(getReminderStatus(reminder({ dismissedAt: BASE_TIME }), BASE_TIME + 2 * HOUR)).toBe('dismissed');
  });

  it('resets terminal state when a reminder is rescheduled', async () => {
    const persistence = createMemoryReminderPersistence([
      reminder({ completedAt: BASE_TIME + HOUR, dueAt: BASE_TIME + HOUR }),
    ]);
    const store = createReminderStore(persistence, { now: () => BASE_TIME + 2 * HOUR });
    const updated = await store.reschedule('reminder-1', BASE_TIME + 4 * HOUR);
    expect(updated).toMatchObject({ completedAt: null, dismissedAt: null, notifiedAt: null });
    expect((await store.get('reminder-1'))?.status).toBe('upcoming');
  });
});

describe('offline persistence and missed reminders', () => {
  it('survives a store restart with the same local persistence', async () => {
    const persistence = createMemoryReminderPersistence();
    const firstSession = createReminderStore(persistence, {
      now: () => BASE_TIME,
      createId: () => 'reminder-persisted',
    });
    await firstSession.schedule({ noteId: 'note-9', title: 'Call back', dueAt: BASE_TIME + HOUR });

    const restartedSession = createReminderStore(persistence, { now: () => BASE_TIME + 30 * 60 * 1000 });
    expect(await restartedSession.list()).toMatchObject([
      { id: 'reminder-persisted', noteId: 'note-9', status: 'upcoming' },
    ]);
  });

  it('claims a reminder missed while closed exactly once', async () => {
    const persistence = createMemoryReminderPersistence([reminder()]);
    await persistence.setLastCheckedAt(BASE_TIME);

    const restartedSession = createReminderStore(persistence, { now: () => BASE_TIME + 2 * HOUR });
    const firstClaim = await restartedSession.claimDue();
    expect(firstClaim).toMatchObject([{ id: 'reminder-1', status: 'overdue', missed: true }]);
    expect(await restartedSession.claimDue(BASE_TIME + 3 * HOUR)).toEqual([]);
  });

  it('does not claim completed or dismissed reminders', async () => {
    const persistence = createMemoryReminderPersistence([
      reminder({ id: 'complete', completedAt: BASE_TIME + HOUR }),
      reminder({ id: 'dismissed', dismissedAt: BASE_TIME + HOUR }),
    ]);
    const store = createReminderStore(persistence, { now: () => BASE_TIME + 2 * HOUR });
    expect(await store.claimDue()).toEqual([]);
  });
});

describe('calendar and note deletion integration', () => {
  it('groups and sorts reminders deterministically in the requested time zone', () => {
    const grouped = groupRemindersByCalendarDay(
      [
        reminder({ id: 'later', dueAt: Date.UTC(2026, 7, 22, 1) }),
        reminder({ id: 'earlier', dueAt: Date.UTC(2026, 7, 21, 23) }),
        reminder({ id: 'first', dueAt: Date.UTC(2026, 7, 21, 20) }),
      ],
      BASE_TIME,
      'UTC'
    );
    expect(grouped.map(({ dateKey }) => dateKey)).toEqual(['2026-08-21', '2026-08-22']);
    expect(grouped[0]?.reminders.map(({ id }) => id)).toEqual(['first', 'earlier']);
  });

  it('changes calendar days according to the user time zone', () => {
    const atLateUtc = reminder({ dueAt: Date.UTC(2026, 7, 21, 23, 30) });
    expect(groupRemindersByCalendarDay([atLateUtc], BASE_TIME, 'UTC')[0]?.dateKey).toBe('2026-08-21');
    expect(groupRemindersByCalendarDay([atLateUtc], BASE_TIME, 'Asia/Kolkata')[0]?.dateKey).toBe('2026-08-22');
  });

  it('removes every linked reminder through the note deletion hook', async () => {
    const persistence = createMemoryReminderPersistence([
      reminder({ id: 'one' }),
      reminder({ id: 'two' }),
      reminder({ id: 'kept', noteId: 'note-2' }),
    ]);
    const store = createReminderStore(persistence);
    const deleteForPurgedNote = createReminderDeletionHook(store);
    expect(await deleteForPurgedNote('note-1')).toBe(2);
    expect((await store.list()).map(({ id }) => id)).toEqual(['kept']);
  });
});
