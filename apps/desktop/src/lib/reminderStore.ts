export type ReminderStatus = 'upcoming' | 'overdue' | 'completed' | 'dismissed';
export type ReminderRepeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

const REMINDER_REPEAT_VALUES = new Set<ReminderRepeat>(['none', 'daily', 'weekdays', 'weekly', 'monthly']);

export interface SkribReminder {
  id: string;
  noteId: string;
  title: string;
  dueAt: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  dismissedAt: number | null;
  notifiedAt: number | null;
  /** Missing on reminders created before repeat support; those records are treated as non-repeating. */
  repeat?: ReminderRepeat;
  /** Preserves dates such as the 31st when a monthly occurrence lands in a shorter month. */
  repeatAnchorDay?: number;
}

export interface ReminderWithStatus extends SkribReminder {
  status: ReminderStatus;
}

export interface ClaimedReminder extends ReminderWithStatus {
  missed: boolean;
}

export interface CalendarReminderGroup {
  dateKey: string;
  reminders: ReminderWithStatus[];
}

export interface ScheduleReminderInput {
  noteId: string;
  title?: string;
  dueAt: number;
  repeat?: ReminderRepeat;
}

export interface ReminderPersistence {
  get(id: string): Promise<SkribReminder | undefined>;
  list(): Promise<SkribReminder[]>;
  put(reminder: SkribReminder): Promise<void>;
  delete(id: string): Promise<void>;
  deleteForNote(noteId: string): Promise<number>;
  getLastCheckedAt(): Promise<number | null>;
  setLastCheckedAt(value: number): Promise<void>;
}

export interface ReminderStoreOptions {
  now?: () => number;
  createId?: () => string;
}

export const MAX_REMINDER_TITLE_LENGTH = 180;
const MAX_NOTE_ID_LENGTH = 240;
const DB_NAME = 'skribly-reminders';
const DB_VERSION = 1;
const REMINDERS_STORE = 'reminders';
const META_STORE = 'metadata';
const LAST_CHECKED_KEY = 'last-checked-at';

function defaultCreateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `reminder-${crypto.randomUUID()}`;
  }
  return `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validateTimestamp(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} must be a valid date and time.`);
  }
  return value;
}

function validateRepeat(value: ReminderRepeat | undefined): ReminderRepeat {
  const repeat = value ?? 'none';
  if (!REMINDER_REPEAT_VALUES.has(repeat)) throw new Error('Choose a valid reminder repeat option.');
  return repeat;
}

function normalizedRepeat(reminder: Pick<SkribReminder, 'repeat'>): ReminderRepeat {
  return REMINDER_REPEAT_VALUES.has(reminder.repeat as ReminderRepeat) ? (reminder.repeat as ReminderRepeat) : 'none';
}

function normalizedAnchorDay(reminder: Pick<SkribReminder, 'dueAt' | 'repeatAnchorDay'>): number {
  const fallback = new Date(reminder.dueAt).getDate();
  return Number.isInteger(reminder.repeatAnchorDay) && reminder.repeatAnchorDay! >= 1 && reminder.repeatAnchorDay! <= 31
    ? reminder.repeatAnchorDay!
    : fallback;
}

function normalizeStoredReminder(reminder: SkribReminder): SkribReminder {
  const repeat = normalizedRepeat(reminder);
  const { repeatAnchorDay: _storedAnchorDay, ...base } = reminder;
  return {
    ...base,
    repeat,
    ...(repeat === 'monthly' ? { repeatAnchorDay: normalizedAnchorDay(reminder) } : {}),
  };
}

function localCalendarOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000);
}

function addLocalDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function addLocalMonths(timestamp: number, months: number, anchorDay: number): number {
  const source = new Date(timestamp);
  const target = new Date(source);
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(anchorDay, lastDay));
  return target.getTime();
}

function nextWeekday(timestamp: number): number {
  let candidate = addLocalDays(timestamp, 1);
  while (new Date(candidate).getDay() === 0 || new Date(candidate).getDay() === 6) {
    candidate = addLocalDays(candidate, 1);
  }
  return candidate;
}

/**
 * Finds the first recurrence strictly after `after` using the device's local calendar.
 * Calendar arithmetic preserves the chosen wall-clock time across daylight-saving changes.
 */
export function nextRecurringDueAt(
  dueAt: number,
  repeat: Exclude<ReminderRepeat, 'none'>,
  after: number,
  monthlyAnchorDay = new Date(dueAt).getDate()
): number {
  validateTimestamp(dueAt, 'Reminder time');
  validateTimestamp(after, 'Reminder completion time');
  if (repeat === ('none' as ReminderRepeat) || !REMINDER_REPEAT_VALUES.has(repeat)) {
    throw new Error('A repeating reminder needs a valid repeat option.');
  }

  if (repeat === 'weekdays') {
    let candidate = nextWeekday(dueAt);
    if (candidate <= after) {
      const calendarDays = localCalendarOrdinal(new Date(after)) - localCalendarOrdinal(new Date(candidate));
      candidate = addLocalDays(candidate, Math.max(0, Math.floor(calendarDays / 7)) * 7);
      while (candidate <= after) candidate = nextWeekday(candidate);
    }
    return candidate;
  }

  if (repeat === 'monthly') {
    const anchorDay = Math.min(31, Math.max(1, Math.trunc(monthlyAnchorDay)));
    let candidate = addLocalMonths(dueAt, 1, anchorDay);
    if (candidate <= after) {
      const candidateDate = new Date(candidate);
      const afterDate = new Date(after);
      const monthDifference =
        (afterDate.getFullYear() - candidateDate.getFullYear()) * 12 + afterDate.getMonth() - candidateDate.getMonth();
      candidate = addLocalMonths(candidate, Math.max(0, monthDifference), anchorDay);
      while (candidate <= after) candidate = addLocalMonths(candidate, 1, anchorDay);
    }
    return candidate;
  }

  const intervalDays = repeat === 'weekly' ? 7 : 1;
  let candidate = addLocalDays(dueAt, intervalDays);
  if (candidate <= after) {
    const calendarDays = localCalendarOrdinal(new Date(after)) - localCalendarOrdinal(new Date(candidate));
    const intervalCount = Math.max(0, Math.floor(calendarDays / intervalDays));
    candidate = addLocalDays(candidate, intervalCount * intervalDays);
    while (candidate <= after) candidate = addLocalDays(candidate, intervalDays);
  }
  return candidate;
}

function validateNoteId(noteId: string): string {
  const normalized = noteId.trim();
  if (!normalized || normalized.length > MAX_NOTE_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error('A reminder must be linked to a valid note.');
  }
  return normalized;
}

function validateTitle(title: string | undefined): string {
  const normalized = (title ?? '').trim();
  if (normalized.length > MAX_REMINDER_TITLE_LENGTH) {
    throw new Error(`Reminder titles must be ${MAX_REMINDER_TITLE_LENGTH} characters or shorter.`);
  }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) throw new Error('The reminder title contains invalid characters.');
  return normalized;
}

export function getReminderStatus(reminder: SkribReminder, now = Date.now()): ReminderStatus {
  if (reminder.completedAt !== null) return 'completed';
  if (reminder.dismissedAt !== null) return 'dismissed';
  return reminder.dueAt <= now ? 'overdue' : 'upcoming';
}

function withStatus(reminder: SkribReminder, now: number): ReminderWithStatus {
  return { ...reminder, status: getReminderStatus(reminder, now) };
}

function compareReminders(a: Pick<SkribReminder, 'dueAt' | 'id'>, b: Pick<SkribReminder, 'dueAt' | 'id'>): number {
  return a.dueAt - b.dueAt || a.id.localeCompare(b.id);
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function calendarDayKey(timestamp: number, timeZone = getLocalTimeZone()): string {
  validateTimestamp(timestamp, 'Reminder time');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  if (!year || !month || !day) throw new Error('Unable to group this reminder on the calendar.');
  return `${year}-${month}-${day}`;
}

export function groupRemindersByCalendarDay(
  reminders: ReadonlyArray<SkribReminder>,
  now = Date.now(),
  timeZone = getLocalTimeZone()
): CalendarReminderGroup[] {
  const groups = new Map<string, ReminderWithStatus[]>();
  for (const reminder of [...reminders].sort(compareReminders)) {
    const dateKey = calendarDayKey(reminder.dueAt, timeZone);
    const group = groups.get(dateKey) ?? [];
    group.push(withStatus(reminder, now));
    groups.set(dateKey, group);
  }
  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([dateKey, groupedReminders]) => ({ dateKey, reminders: groupedReminders }));
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Local reminder storage is unavailable in this environment.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local reminder storage.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REMINDERS_STORE)) {
        const reminders = db.createObjectStore(REMINDERS_STORE, { keyPath: 'id' });
        reminders.createIndex('by-note', 'noteId', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction, setResult: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let hasResult = false;
    let result: T;
    let settled = false;
    const fail = (reason?: unknown) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(reason);
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      db.close();
      if (!hasResult) {
        reject(new Error('Local reminder transaction completed without a result.'));
        return;
      }
      resolve(result);
    };
    transaction.onabort = () => fail(transaction.error ?? new Error('Local reminder transaction was cancelled.'));
    transaction.onerror = () => fail(transaction.error ?? new Error('Local reminder transaction failed.'));
    operation(
      transaction,
      (value) => {
        result = value;
        hasResult = true;
      },
      fail
    );
  });
}

export function createIndexedDbReminderPersistence(): ReminderPersistence {
  return {
    get: (id) =>
      runTransaction<SkribReminder | undefined>(REMINDERS_STORE, 'readonly', (transaction, setResult, reject) => {
        const request = transaction.objectStore(REMINDERS_STORE).get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(request.result as SkribReminder | undefined);
      }),
    list: () =>
      runTransaction<SkribReminder[]>(REMINDERS_STORE, 'readonly', (transaction, setResult, reject) => {
        const request = transaction.objectStore(REMINDERS_STORE).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(request.result as SkribReminder[]);
      }),
    put: (reminder) =>
      runTransaction<void>(REMINDERS_STORE, 'readwrite', (transaction, setResult, reject) => {
        const request = transaction.objectStore(REMINDERS_STORE).put(reminder);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(undefined);
      }),
    delete: (id) =>
      runTransaction<void>(REMINDERS_STORE, 'readwrite', (transaction, setResult, reject) => {
        const request = transaction.objectStore(REMINDERS_STORE).delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(undefined);
      }),
    deleteForNote: (noteId) =>
      runTransaction<number>(REMINDERS_STORE, 'readwrite', (transaction, setResult, reject) => {
        const index = transaction.objectStore(REMINDERS_STORE).index('by-note');
        const request = index.openCursor(IDBKeyRange.only(noteId));
        let deleted = 0;
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            setResult(deleted);
            return;
          }
          cursor.delete();
          deleted += 1;
          cursor.continue();
        };
      }),
    getLastCheckedAt: () =>
      runTransaction<number | null>(META_STORE, 'readonly', (transaction, setResult, reject) => {
        const request = transaction.objectStore(META_STORE).get(LAST_CHECKED_KEY);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const value = request.result as { key: string; value: number } | undefined;
          setResult(value?.value ?? null);
        };
      }),
    setLastCheckedAt: (value) =>
      runTransaction<void>(META_STORE, 'readwrite', (transaction, setResult, reject) => {
        const request = transaction.objectStore(META_STORE).put({ key: LAST_CHECKED_KEY, value });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => setResult(undefined);
      }),
  };
}

export function createMemoryReminderPersistence(initial: SkribReminder[] = []): ReminderPersistence {
  const reminders = new Map(initial.map((reminder) => [reminder.id, normalizeStoredReminder(reminder)]));
  let lastCheckedAt: number | null = null;
  return {
    get: async (id) => reminders.get(id),
    list: async () => [...reminders.values()],
    put: async (reminder) => {
      reminders.set(reminder.id, reminder);
    },
    delete: async (id) => {
      reminders.delete(id);
    },
    deleteForNote: async (noteId) => {
      const ids = [...reminders.values()].filter((reminder) => reminder.noteId === noteId).map(({ id }) => id);
      ids.forEach((id) => reminders.delete(id));
      return ids.length;
    },
    getLastCheckedAt: async () => lastCheckedAt,
    setLastCheckedAt: async (value) => {
      lastCheckedAt = value;
    },
  };
}

export function createReminderStore(persistence: ReminderPersistence, options: ReminderStoreOptions = {}) {
  const now = options.now ?? Date.now;
  const createId = options.createId ?? defaultCreateId;
  const read = async (id: string): Promise<SkribReminder | undefined> => {
    const reminder = await persistence.get(id);
    return reminder ? normalizeStoredReminder(reminder) : undefined;
  };
  const readAll = async (): Promise<SkribReminder[]> => (await persistence.list()).map(normalizeStoredReminder);

  const schedule = async (input: ScheduleReminderInput): Promise<SkribReminder> => {
    const currentTime = now();
    const dueAt = validateTimestamp(input.dueAt, 'Reminder time');
    if (dueAt <= currentTime) throw new Error('Choose a reminder time in the future.');
    const repeat = validateRepeat(input.repeat);
    const reminder: SkribReminder = {
      id: createId(),
      noteId: validateNoteId(input.noteId),
      title: validateTitle(input.title),
      dueAt,
      createdAt: currentTime,
      updatedAt: currentTime,
      completedAt: null,
      dismissedAt: null,
      notifiedAt: null,
      repeat,
      ...(repeat === 'monthly' ? { repeatAnchorDay: new Date(dueAt).getDate() } : {}),
    };
    await persistence.put(reminder);
    return reminder;
  };

  const get = async (id: string, at = now()): Promise<ReminderWithStatus | null> => {
    const reminder = await read(id);
    return reminder ? withStatus(reminder, at) : null;
  };

  const list = async (at = now()): Promise<ReminderWithStatus[]> =>
    (await readAll()).sort(compareReminders).map((reminder) => withStatus(reminder, at));

  const reschedule = async (id: string, dueAt: number, repeatOverride?: ReminderRepeat): Promise<SkribReminder> => {
    const reminder = await read(id);
    if (!reminder) throw new Error('This reminder no longer exists.');
    const currentTime = now();
    validateTimestamp(dueAt, 'Reminder time');
    if (dueAt <= currentTime) throw new Error('Choose a reminder time in the future.');
    const repeat = repeatOverride === undefined ? normalizedRepeat(reminder) : validateRepeat(repeatOverride);
    const { repeatAnchorDay: _storedAnchorDay, ...base } = reminder;
    const updated: SkribReminder = {
      ...base,
      dueAt,
      updatedAt: currentTime,
      completedAt: null,
      dismissedAt: null,
      notifiedAt: null,
      repeat,
      ...(repeat === 'monthly' ? { repeatAnchorDay: new Date(dueAt).getDate() } : {}),
    };
    await persistence.put(updated);
    return updated;
  };

  const complete = async (id: string): Promise<SkribReminder> => {
    const reminder = await read(id);
    if (!reminder) throw new Error('This reminder no longer exists.');
    const completedAt = now();
    const repeat = normalizedRepeat(reminder);
    const updated: SkribReminder =
      repeat === 'none'
        ? { ...reminder, completedAt, dismissedAt: null, updatedAt: completedAt }
        : {
            ...reminder,
            dueAt: nextRecurringDueAt(
              reminder.dueAt,
              repeat,
              Math.max(completedAt, reminder.dueAt),
              normalizedAnchorDay(reminder)
            ),
            completedAt: null,
            dismissedAt: null,
            notifiedAt: null,
            updatedAt: completedAt,
          };
    await persistence.put(updated);
    return updated;
  };

  const dismiss = async (id: string): Promise<SkribReminder> => {
    const reminder = await read(id);
    if (!reminder) throw new Error('This reminder no longer exists.');
    const dismissedAt = now();
    const repeat = normalizedRepeat(reminder);
    const updated: SkribReminder =
      repeat === 'none'
        ? { ...reminder, completedAt: null, dismissedAt, updatedAt: dismissedAt }
        : {
            ...reminder,
            dueAt: nextRecurringDueAt(
              reminder.dueAt,
              repeat,
              Math.max(dismissedAt, reminder.dueAt),
              normalizedAnchorDay(reminder)
            ),
            completedAt: null,
            dismissedAt: null,
            notifiedAt: null,
            updatedAt: dismissedAt,
          };
    await persistence.put(updated);
    return updated;
  };

  const claimDue = async (at = now()): Promise<ClaimedReminder[]> => {
    validateTimestamp(at, 'Reminder check time');
    const lastCheckedAt = await persistence.getLastCheckedAt();
    const due = (await readAll())
      .filter(
        (reminder) =>
          reminder.completedAt === null &&
          reminder.dismissedAt === null &&
          reminder.notifiedAt === null &&
          reminder.dueAt <= at
      )
      .sort(compareReminders);

    const claimed: ClaimedReminder[] = [];
    for (const reminder of due) {
      const updated = { ...reminder, notifiedAt: at, updatedAt: at };
      await persistence.put(updated);
      claimed.push({
        ...withStatus(updated, at),
        missed: reminder.dueAt < at && (lastCheckedAt === null || reminder.dueAt > lastCheckedAt),
      });
    }
    await persistence.setLastCheckedAt(at);
    return claimed;
  };

  const calendar = async (at = now(), timeZone = getLocalTimeZone()): Promise<CalendarReminderGroup[]> =>
    groupRemindersByCalendarDay(await readAll(), at, timeZone);

  return {
    schedule,
    get,
    list,
    reschedule,
    complete,
    dismiss,
    claimDue,
    calendar,
    delete: (id: string) => persistence.delete(id),
    deleteForNote: (noteId: string) => persistence.deleteForNote(validateNoteId(noteId)),
  };
}

const defaultStore = createReminderStore(createIndexedDbReminderPersistence());

export const scheduleReminder = defaultStore.schedule;
export const getReminder = defaultStore.get;
export const listReminders = defaultStore.list;
export const rescheduleReminder = defaultStore.reschedule;
export const completeReminder = defaultStore.complete;
export const dismissReminder = defaultStore.dismiss;
export const claimDueReminders = defaultStore.claimDue;
export const getReminderCalendar = defaultStore.calendar;
export const deleteReminder = defaultStore.delete;
export const deleteRemindersForNote = defaultStore.deleteForNote;

export function createReminderDeletionHook(
  store: Pick<ReturnType<typeof createReminderStore>, 'deleteForNote'> = defaultStore
): (noteId: string) => Promise<number> {
  return (noteId) => store.deleteForNote(noteId);
}
