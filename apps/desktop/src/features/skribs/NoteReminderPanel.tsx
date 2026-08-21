import React, { useEffect, useMemo, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
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
  type ReminderWithStatus,
} from '../../lib/reminderStore';

interface NoteReminderPanelProps {
  noteId: string;
  noteText: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

function toLocalDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - timezoneOffset).toISOString().slice(0, 16);
}

function defaultDueValue(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return toLocalDateTimeValue(date.getTime());
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
  const [dueValue, setDueValue] = useState(defaultDueValue);
  const [isLoading, setIsLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
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
    if (activeReminder) setDueValue(toLocalDateTimeValue(activeReminder.dueAt));
  }, [activeReminder]);

  const schedule = async () => {
    if (disabled || operationInProgressRef.current) return;
    const dueAt = new Date(dueValue).getTime();
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
      if (activeReminder) await rescheduleReminder(activeReminder.id, dueAt);
      else await scheduleReminder({ noteId, title: reminderTitle(noteText), dueAt });
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
          <strong id="note-reminder-title">Reminder</strong>
          <span>Stored locally and shown through Windows while Skribli is running.</span>
        </div>
      </header>

      <div className="note-reminder-scheduler">
        <label>
          <span>{activeReminder ? 'Change reminder time' : 'Remind me'}</span>
          <input
            type="datetime-local"
            value={dueValue}
            min={toLocalDateTimeValue(Date.now() + 60_000)}
            disabled={disabled || panelBusy}
            onChange={(event) => setDueValue(event.target.value)}
          />
        </label>
        <button type="button" className="primary" disabled={disabled || panelBusy} onClick={() => void schedule()}>
          {isScheduling ? 'Saving…' : activeReminder ? 'Reschedule' : 'Set reminder'}
        </button>
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
