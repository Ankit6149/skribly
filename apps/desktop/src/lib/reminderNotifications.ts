import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { claimDueReminders, type ClaimedReminder } from './reminderStore';

export type ReminderNotificationPermission = 'granted' | 'denied' | 'unavailable';

function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function ensureReminderNotificationPermission(): Promise<ReminderNotificationPermission> {
  if (!hasTauriRuntime()) return 'unavailable';
  if (await isPermissionGranted()) return 'granted';
  return (await requestPermission()) === 'granted' ? 'granted' : 'denied';
}

export async function deliverDueReminderNotifications(
  now = Date.now()
): Promise<ClaimedReminder[]> {
  if (!hasTauriRuntime() || !(await isPermissionGranted())) return [];
  const reminders = await claimDueReminders(now);
  for (const reminder of reminders) {
    sendNotification({
      title: reminder.missed ? 'Skribli reminder — while you were away' : 'Skribli reminder',
      body: 'A local Skrib reminder is due. Open Skribli Calendar to review it.',
    });
  }
  return reminders;
}
