/**
 * DEV-only notification debug helpers.
 * Call from a breakpoint or dev menu — no UI surface in production.
 * P10 may expose these through a debug Settings row.
 */

import * as Notifications from 'expo-notifications';
import { logger } from '@/lib/logger';

/** Logs all currently scheduled notifications. */
export async function listScheduled(): Promise<void> {
  if (!__DEV__) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  logger.info('notif:debug scheduled count:', scheduled.length);
  logger.info('notif:debug scheduled:', JSON.stringify(scheduled, null, 2));
}

/** Schedules a one-off test notification N seconds from now. */
export async function fireTestIn(seconds: number): Promise<void> {
  if (!__DEV__) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dawnwell test',
      body: `Fired ${seconds}s after scheduling`,
      data: { kind: 'debug-test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
  logger.info('notif:debug test notification scheduled, id:', id);
}
