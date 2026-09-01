import React, { useEffect, useMemo, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Repeat2 } from 'lucide-react';
import {
  ensureReminderNotificationPermission,
  type ReminderNotificationPermission,
} from '../../lib/reminderNotifications';
import {
  completeReminder,
  deleteReminder,
  dismissReminder,
  listReminders,
  rescheduleReminder,
  scheduleReminder,
  type ReminderRepeat,
  type ReminderWithStatus,
} from '../../lib/reminderStore';
import {
  createReminderCalendarDays,
  createReminderTimeOptions,
  defaultReminderTimestamp,
  localDateTimeFromValues,
  reminderPresetTimestamp,
  toLocalDateKey,
  toLocalTimeValue,
  type ReminderPreset,
} from './reminderCalendarModel';

interface NoteReminderPanelProps {
  noteId: string;
  noteText: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

function reminderTitle(noteText: string): string {
  const compact = noteText.replace(/\s+/gu, ' ').trim();
  if (!compact) return 'Skribli reminder';
  return compact.length <= 120 ? compact : `${compact.slice(0, 119).trimEnd()}…`;
}

function formatReminderTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export const NoteReminderPanel: React.FC<NoteReminderPanelProps> = ({
  noteId,
  noteText,
  disabled = false,
  onError,
  onBusyChange,
}) => {
  const [reminders, setReminders] = useState<ReminderWithStatus[]>([]);
  const [dueSelection, setDueSelection] = useState(() => {
    const timestamp = defaultReminderTimestamp();
    return { date: toLocalDateKey(timestamp), time: toLocalTimeValue(timestamp) };
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date(defaultReminderTimestamp());
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [isLoading, setIsLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [repeat, setRepeat] = useState<ReminderRepeat>('none');
  const [error, setError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<ReminderNotificationPermission | null>(null);
  const operationInProgressRef = useRef(false);
  const panelBusy = isScheduling || mutatingId !== null;

  const reportError = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message);
    onError?.(message);
  };

  const refresh = async () => {
    try {
      const all = await listReminders();
      setReminders(all.filter((reminder) => reminder.noteId === noteId));
      setError(null);
    } catch (reason) {
      reportError(reason);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [noteId]);

  const activeReminder = useMemo(
    () => reminders.find((reminder) => reminder.status === 'upcoming' || reminder.status === 'overdue'),
    [reminders]
  );

  useEffect(() => {
    if (!activeReminder) return;
    const date = new Date(activeReminder.dueAt);
    setDueSelection({
      date: toLocalDateKey(activeReminder.dueAt),
      time: toLocalTimeValue(activeReminder.dueAt),
    });
    setCalendarMonth({ year: date.getFullYear(), month: date.getMonth() });
    setRepeat(activeReminder.repeat ?? 'none');
  }, [activeReminder]);

  const calendarDays = useMemo(
    () => createReminderCalendarDays(
      calendarMonth.year,
      calendarMonth.month,
      dueSelection.date
    ),
    [calendarMonth, dueSelection.date]
  );
  const timeOptions = useMemo(
    () => createReminderTimeOptions(dueSelection.time),
    [dueSelection.time]
  );
  const calendarTitle = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
      new Date(calendarMonth.year, calendarMonth.month, 1)
    ),
    [calendarMonth]
  );

  const moveCalendarMonth = (offset: number) => {
    setCalendarMonth((current) => {
      const date = new Date(current.year, current.month + offset, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const chooseDate = (dateKey: string) => {
    const date = new Date(`${dateKey}T12:00:00`);
    setDueSelection((current) => ({ ...current, date: dateKey }));
    setCalendarMonth({ year: date.getFullYear(), month: date.getMonth() });
  };

  const applyPreset = (preset: ReminderPreset) => {
    const timestamp = reminderPresetTimestamp(preset);
    const date = new Date(timestamp);
    setDueSelection({ date: toLocalDateKey(timestamp), time: toLocalTimeValue(timestamp) });
    setCalendarMonth({ year: date.getFullYear(), month: date.getMonth() });
  };

  const schedule = async () => {
    if (disabled || operationInProgressRef.current) return;
    const dueAt = localDateTimeFromValues(dueSelection.date, dueSelection.time);
    if (!Number.isFinite(dueAt)) {
      reportError(new Error('Choose a valid reminder date and time.'));
      return;
    }
    operationInProgressRef.current = true;
    setIsScheduling(true);
    onBusyChange?.(true);
    setError(null);
    try {
      let permission: ReminderNotificationPermission = 'unavailable';
      try {
        permission = await ensureReminderNotificationPermission();
      } catch {
        // Scheduling remains local and usable even if Windows permission lookup fails.
      }
      setNotificationPermission(permission);
      if (activeReminder) await rescheduleReminder(activeReminder.id, dueAt, repeat);
      else await scheduleReminder({ noteId, title: reminderTitle(noteText), dueAt, repeat });
      await refresh();
      void emit('skribly://reminders-updated', { noteId }).catch(() => undefined);
    } catch (reason) {
      reportError(reason);
    } finally {
      setIsScheduling(false);
      operationInProgressRef.current = false;
      onBusyChange?.(false);
    }
  };

  const mutate = async (id: string, action: 'complete' | 'dismiss' | 'delete') => {
    if (disabled || operationInProgressRef.current) return;
    operationInProgressRef.current = true;
    setMutatingId(id);
    onBusyChange?.(true);
    setError(null);
    try {
      if (action === 'complete') await completeReminder(id);
      else if (action === 'dismiss') await dismissReminder(id);
      else await deleteReminder(id);
      await refresh();
      void emit('skribly://reminders-updated', { noteId }).catch(() => undefined);
    } catch (reason) {
      reportError(reason);
    } finally {
      setMutatingId(null);
      operationInProgressRef.current = false;
      onBusyChange?.(false);
    }
  };

  return (
    <section className="note-reminder-panel" aria-labelledby="note-reminder-title">
      <header className="note-panel-heading">
        <div>
          <strong id="note-reminder-title">
            <span className="note-panel-heading-icon" aria-hidden="true">
              <CalendarClock size={16} />
            </span>
            Set a reminder
          </strong>
          <span>Private to this device · visible in Skribli Calendar</span>
        </div>
      </header>

      <div className="note-reminder-scheduler">
        <div className="note-reminder-presets" aria-label="Quick reminder times">
          <span>Quick pick</span>
          <button type="button" disabled={disabled || panelBusy} onClick={() => applyPreset('hour')}>In 1 hour</button>
          <button type="button" disabled={disabled || panelBusy} onClick={() => applyPreset('tomorrowMorning')}>Tomorrow, 9:00</button>
          <button type="button" disabled={disabled || panelBusy} onClick={() => applyPreset('nextWeek')}>Next week</button>
        </div>

        <div className="note-reminder-picker">
          <div className="note-reminder-calendar">
            <div className="note-reminder-calendar-nav">
              <button type="button" aria-label="Previous month" disabled={disabled || panelBusy} onClick={() => moveCalendarMonth(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
              <strong aria-live="polite">{calendarTitle}</strong>
              <button type="button" aria-label="Next month" disabled={disabled || panelBusy} onClick={() => moveCalendarMonth(1)}><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
            <div className="note-reminder-weekdays" aria-hidden="true">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="note-reminder-days" role="grid" aria-label={calendarTitle}>
              {calendarDays.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={day.isSelected ? 'selected' : ''}
                  data-outside={!day.inDisplayedMonth || undefined}
                  data-today={day.isToday || undefined}
                  disabled={disabled || panelBusy || day.isPast}
                  aria-label={new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(`${day.key}T12:00:00`))}
                  aria-pressed={day.isSelected}
                  onClick={() => chooseDate(day.key)}
                >
                  {day.dayNumber}
                </button>
              ))}
            </div>
          </div>

          <div className="note-reminder-time">
            <span className="note-reminder-time-kicker">Time</span>
            <label className="note-reminder-select-field">
              <span className="sr-only">Reminder time</span>
              <select
                value={dueSelection.time}
                disabled={disabled || panelBusy}
                aria-label="Reminder time"
                onChange={(event) => setDueSelection((current) => ({ ...current, time: event.target.value }))}
              >
                {timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
            <label className="note-reminder-select-field repeat-field">
              <span className="sr-only">Repeat reminder</span>
              <Repeat2 size={14} aria-hidden="true" />
              <select
                value={repeat}
                disabled={disabled || panelBusy}
                aria-label="Repeat reminder"
                onChange={(event) => setRepeat(event.target.value as ReminderRepeat)}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
            <span className="note-reminder-selected-date">
              {new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(
                new Date(`${dueSelection.date}T12:00:00`)
              )}
            </span>
            <button type="button" className="primary" disabled={disabled || panelBusy} onClick={() => void schedule()}>
              {isScheduling ? 'Saving…' : activeReminder ? 'Save new time' : 'Set reminder'}
            </button>
            <small>Saved locally. Windows alerts can be enabled separately.</small>
          </div>
        </div>
      </div>

      {error && <div className="note-panel-error" role="alert">{error}</div>}
      {notificationPermission && notificationPermission !== 'granted' && (
        <div className="note-panel-notice" role="status">
          Windows notifications are {notificationPermission === 'denied' ? 'turned off' : 'unavailable'}.
          The reminder is still saved and visible in Skribli Calendar.
        </div>
      )}

      {isLoading ? (
        <div className="note-panel-empty" role="status">Reading local reminders…</div>
      ) : reminders.length === 0 ? (
        <div className="note-panel-empty">
          <strong>No reminder set</strong>
          <span>Choose a future date and time. It will also appear in the Skribli calendar.</span>
        </div>
      ) : (
        <div className="note-reminder-list">
          {reminders.map((reminder) => (
            <article key={reminder.id} className={`note-reminder-row ${reminder.status}`}>
              <div>
                <span className="note-reminder-state">{reminder.status}</span>
                <strong>{formatReminderTime(reminder.dueAt)}</strong>
                {(reminder.repeat ?? 'none') !== 'none' && (
                  <small className="note-reminder-repeat">Repeats {reminder.repeat}</small>
                )}
                <small>{reminder.title || 'Skribli reminder'}</small>
              </div>
              <div className="note-reminder-actions">
                {(reminder.status === 'upcoming' || reminder.status === 'overdue') && (
                  <>
                    <button
                      type="button"
                      disabled={disabled || panelBusy}
                      onClick={() => void mutate(reminder.id, 'complete')}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      disabled={disabled || panelBusy}
                      onClick={() => void mutate(reminder.id, 'dismiss')}
                    >
                      Dismiss
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="danger"
                  disabled={disabled || panelBusy}
                  onClick={() => void mutate(reminder.id, 'delete')}
                >
                  {mutatingId === reminder.id ? 'Working…' : 'Remove'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
