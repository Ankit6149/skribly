import { describe, expect, it } from 'vitest';
import {
  createReminderCalendarDays,
  createReminderTimeOptions,
  defaultReminderTimestamp,
  localDateTimeFromValues,
  reminderPresetTimestamp,
  toLocalDateKey,
  toLocalTimeValue,
} from './reminderCalendarModel';

describe('reminder calendar model', () => {
  it('builds a stable six-week Monday-first calendar without enabling past days', () => {
    const now = new Date(2026, 7, 22, 10, 30).getTime();
    const days = createReminderCalendarDays(2026, 7, '2026-08-24', now);

    expect(days).toHaveLength(42);
    expect(days[0]?.key).toBe('2026-07-27');
    expect(days[41]?.key).toBe('2026-09-06');
    expect(days.find((day) => day.key === '2026-08-21')?.isPast).toBe(true);
    expect(days.find((day) => day.key === '2026-08-22')?.isToday).toBe(true);
    expect(days.find((day) => day.key === '2026-08-24')?.isSelected).toBe(true);
  });

  it('round-trips a local date and time and rejects normalized invalid dates', () => {
    const timestamp = localDateTimeFromValues('2026-08-24', '14:35');

    expect(toLocalDateKey(timestamp)).toBe('2026-08-24');
    expect(toLocalTimeValue(timestamp)).toBe('14:35');
    expect(localDateTimeFromValues('2026-02-30', '14:35')).toBeNaN();
    expect(localDateTimeFromValues('2026-08-24', '24:00')).toBeNaN();
  });

  it('offers deterministic future presets and keeps a non-quarter-hour selection', () => {
    const now = new Date(2026, 7, 22, 10, 33, 28).getTime();

    expect(toLocalTimeValue(defaultReminderTimestamp(now))).toBe('11:35');
    expect(toLocalDateKey(reminderPresetTimestamp('tomorrowMorning', now))).toBe('2026-08-23');
    expect(toLocalTimeValue(reminderPresetTimestamp('tomorrowMorning', now))).toBe('09:00');
    expect(toLocalDateKey(reminderPresetTimestamp('nextWeek', now))).toBe('2026-08-29');
    expect(createReminderTimeOptions('11:37', 'en-US')).toContainEqual({
      value: '11:37',
      label: '11:37 AM',
    });
  });
});
