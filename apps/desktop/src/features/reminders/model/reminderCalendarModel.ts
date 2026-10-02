export interface ReminderCalendarDay {
  key: string;
  dayNumber: number;
  inDisplayedMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
}

export interface ReminderTimeOption {
  value: string;
  label: string;
}

export type ReminderPreset = 'hour' | 'tomorrowMorning' | 'nextWeek';

const pad = (value: number) => String(value).padStart(2, '0');

export function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeFromValues(dateValue: string, timeValue: string): number {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return Number.NaN;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return Number.NaN;

  const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day ||
    candidate.getHours() !== hour ||
    candidate.getMinutes() !== minute
  ) {
    return Number.NaN;
  }
  return candidate.getTime();
}

export function defaultReminderTimestamp(now = Date.now()): number {
  const date = new Date(now + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return date.getTime();
}

export function reminderPresetTimestamp(preset: ReminderPreset, now = Date.now()): number {
  if (preset === 'hour') return defaultReminderTimestamp(now);

  const date = new Date(now);
  if (preset === 'tomorrowMorning') {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date.getTime();
  }

  date.setDate(date.getDate() + 7);
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5);
  return date.getTime();
}

export function createReminderCalendarDays(
  year: number,
  monthIndex: number,
  selectedDateKey: string,
  now = Date.now()
): ReminderCalendarDay[] {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('The reminder calendar month is invalid.');
  }

  const firstOfMonth = new Date(year, monthIndex, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const cursor = new Date(year, monthIndex, 1 - mondayOffset);
  const todayKey = toLocalDateKey(now);

  return Array.from({ length: 42 }, () => {
    const key = toLocalDateKey(cursor.getTime());
    const day: ReminderCalendarDay = {
      key,
      dayNumber: cursor.getDate(),
      inDisplayedMonth: cursor.getMonth() === monthIndex,
      isToday: key === todayKey,
      isSelected: key === selectedDateKey,
      isPast: key < todayKey,
    };
    cursor.setDate(cursor.getDate() + 1);
    return day;
  });
}

export function createReminderTimeOptions(
  selectedTime: string,
  locale?: string
): ReminderTimeOption[] {
  const values = new Set<string>();
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    values.add(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  if (/^\d{2}:\d{2}$/.test(selectedTime)) values.add(selectedTime);

  const formatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return [...values]
    .sort()
    .map((value) => {
      const [hours, minutes] = value.split(':').map(Number);
      return {
        value,
        label: formatter.format(new Date(2000, 0, 1, hours, minutes)),
      };
    });
}
