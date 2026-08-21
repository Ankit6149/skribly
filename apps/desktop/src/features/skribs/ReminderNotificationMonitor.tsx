import React, { useEffect } from 'react';
import { emit } from '@tauri-apps/api/event';
import { deliverDueReminderNotifications } from '../../lib/reminderNotifications';

const REMINDER_CHECK_INTERVAL_MS = 15_000;

export const ReminderNotificationMonitor: React.FC = () => {
  useEffect(() => {
    let disposed = false;
    const check = async () => {
      try {
        const delivered = await deliverDueReminderNotifications();
        if (!disposed && delivered.length > 0) {
          await emit('skribly://reminders-updated', {
            dueReminderIds: delivered.map((reminder) => reminder.id),
          });
        }
      } catch {
        // The calendar retains overdue reminders if the OS notification service is unavailable.
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), REMINDER_CHECK_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
};
