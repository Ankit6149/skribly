import { emit, listen } from '@tauri-apps/api/event';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SkribNote } from '../notes/model/noteTypes';
import {
  completeReminder,
  dismissReminder,
  getReminderCalendar,
  type CalendarReminderGroup,
  type ReminderWithStatus,
} from '../reminders/persistence/reminderStore';
import { noteDisplayTitle } from './libraryModel';

interface ReminderCalendarProps {
  notes: SkribNote[];
  onOpenNote: (noteId: string) => void;
  canWrite: boolean;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function reminderTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(timestamp)
  );
}

function calendarDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export const ReminderCalendar: React.FC<ReminderCalendarProps> = ({ notes, onOpenNote, canWrite }) => {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKey(new Date()));
  const [groups, setGroups] = useState<CalendarReminderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const hasLoaded = useRef(false);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const refresh = useCallback(async () => {
    setIsLoading(true);
    if (hasLoaded.current) setIsStale(true);
    try {
      const nextGroups = await getReminderCalendar(Date.now(), timeZone);
      setGroups(nextGroups);
      hasLoaded.current = true;
      setIsStale(false);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoading(false);
    }
  }, [timeZone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen('skribly://reminders-updated', () => {
      if (!disposed) void refresh();
    }).then((callback) => {
      if (disposed) callback();
      else unlisten = callback;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [refresh]);

  const remindersByDate = useMemo(
    () => new Map(groups.map((group) => [group.dateKey, group.reminders])),
    [groups]
  );
  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const days = useMemo(() => calendarDays(cursor), [cursor]);
  const selectedReminders = remindersByDate.get(selectedDateKey) ?? [];
  const todayKey = dateKey(new Date());

  const changeMonth = (offset: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next);
    setSelectedDateKey(dateKey(next));
  };

  const moveSelectedDate = (offsetDays: number) => {
    const [year, month, day] = selectedDateKey.split('-').map(Number);
    const next = new Date(year!, month! - 1, day!);
    next.setDate(next.getDate() + offsetDays);
    const nextKey = dateKey(next);
    setSelectedDateKey(nextKey);
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    window.requestAnimationFrame(() => dayButtons.current.get(nextKey)?.focus());
  };

  const mutate = async (reminder: ReminderWithStatus, action: 'complete' | 'dismiss') => {
    if (mutatingId) return;
    setMutatingId(reminder.id);
    try {
      if (action === 'complete') await completeReminder(reminder.id);
      else await dismissReminder(reminder.id);
      void emit('skribly://reminders-updated', { noteId: reminder.noteId }).catch(() => undefined);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <section className="reminder-calendar" aria-labelledby="reminder-calendar-title">
      <header className="reminder-calendar-header">
        <div>
          <span className="library-kicker">LOCAL REMINDERS</span>
          <h2 id="reminder-calendar-title">{monthLabel(cursor)}</h2>
          <p>Every reminder links back to its local Skrib.</p>
        </div>
        <div className="reminder-calendar-navigation" aria-label="Calendar month">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">←</button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDateKey(dateKey(today));
            }}
          >
            Today
          </button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">→</button>
        </div>
      </header>

      {error && (
        <div className="library-export-message error" role="alert">
          <span>Could not read reminders: {error}</span>
          <button type="button" onClick={() => void refresh()}>Retry</button>
        </div>
      )}

      <div className="reminder-calendar-layout">
        <div className="reminder-month-grid" aria-label={monthLabel(cursor)}>
          <div className="reminder-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="reminder-days" role="group" aria-label={`${monthLabel(cursor)} dates`}>
            {days.map((day) => {
              const key = dateKey(day);
              const reminders = remindersByDate.get(key) ?? [];
              const outsideMonth = day.getMonth() !== cursor.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  className={`${outsideMonth ? 'outside' : ''} ${key === todayKey ? 'today' : ''} ${
                    key === selectedDateKey ? 'selected' : ''
                  }`}
                  aria-pressed={key === selectedDateKey}
                  tabIndex={key === selectedDateKey ? 0 : -1}
                  aria-label={`${day.toLocaleDateString()}${reminders.length ? `, ${reminders.length} reminders` : ''}`}
                  ref={(element) => {
                    if (element) dayButtons.current.set(key, element);
                    else dayButtons.current.delete(key);
                  }}
                  onKeyDown={(event) => {
                    const offsets: Record<string, number> = {
                      ArrowLeft: -1,
                      ArrowRight: 1,
                      ArrowUp: -7,
                      ArrowDown: 7,
                    };
                    const offset = offsets[event.key];
                    if (offset !== undefined) {
                      event.preventDefault();
                      moveSelectedDate(offset);
                    } else if (event.key === 'Home' || event.key === 'End') {
                      event.preventDefault();
                      const weekdayOffset = day.getDay();
                      moveSelectedDate(event.key === 'Home' ? -weekdayOffset : 6 - weekdayOffset);
                    }
                  }}
                  onClick={() => setSelectedDateKey(key)}
                >
                  <span>{day.getDate()}</span>
                  <span className="reminder-day-dots" aria-hidden="true">
                    {reminders.slice(0, 4).map((reminder) => {
                      const note = noteById.get(reminder.noteId);
                      return (
                        <i
                          key={reminder.id}
                          className={`${note ? `skrib-color-${note.color}` : ''} ${reminder.status}`}
                        />
                      );
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="reminder-day-agenda" aria-label="Selected day reminders">
          <header>
            <span className="library-kicker">AGENDA</span>
            <strong aria-live="polite" aria-atomic="true">
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(
                new Date(`${selectedDateKey}T12:00:00`)
              )}
            </strong>
          </header>
          {isLoading && !hasLoaded.current ? (
            <div className="library-state" role="status">Reading reminders…</div>
          ) : error && !hasLoaded.current ? (
            <div className="library-state" role="status">
              <strong>Reminders could not be loaded</strong>
              <span>Try again to check this day.</span>
            </div>
          ) : selectedReminders.length === 0 ? (
            <div className="library-state">
              <strong>{isStale ? 'Showing saved results' : 'Nothing due'}</strong>
              <span>{isStale ? 'Refresh failed; these results may be out of date.' : 'Set a reminder from any Skrib to see it here.'}</span>
            </div>
          ) : (
            <>
            {isStale && <div className="library-state" role="status">Refresh failed. Showing saved results.</div>}
            <div className="reminder-agenda-list">
              {selectedReminders.map((reminder) => {
                const note = noteById.get(reminder.noteId);
                return (
                  <article key={reminder.id} className={note ? `skrib-color-${note.color}` : ''}>
                    <div>
                      <span className={`reminder-status ${reminder.status}`}>{reminder.status}</span>
                      <strong>{reminderTime(reminder.dueAt)}</strong>
                      <p>{note ? noteDisplayTitle(note) : reminder.title || 'Missing linked Skrib'}</p>
                    </div>
                    <div className="reminder-agenda-actions">
                      {note && (
                        <button type="button" onClick={() => onOpenNote(note.id)}>Open Skrib</button>
                      )}
                      {(reminder.status === 'upcoming' || reminder.status === 'overdue') && (
                        <>
                          <button type="button" disabled={!canWrite || mutatingId !== null} onClick={() => void mutate(reminder, 'complete')}>Complete</button>
                          <button type="button" disabled={!canWrite || mutatingId !== null} onClick={() => void mutate(reminder, 'dismiss')}>Dismiss</button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            </>
          )}
          {!canWrite && <p className="library-readonly-status" role="status">Read-only: reminder history stays visible.</p>}
        </aside>
      </div>
    </section>
  );
};
