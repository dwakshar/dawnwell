/**
 * Notifications service — the ONLY module that calls expo-notifications APIs directly.
 * Nothing else in the app imports from expo-notifications.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { habits } from '@/db/schema';
import type { Habit } from '@/db/schema';
import { getHabit, listHabits } from '@/db/repos/habits';
import { logger } from '@/lib/logger';
import { djb2 } from '@/lib/hash';

// ─── Frozen copy strings ───────────────────────────────────────────────────
// Six lines, deterministically assigned per habit (djb2(id) % 6).
// Do NOT add, remove, or reorder — the index is part of the contract.

const REMINDER_LINES: readonly string[] = [
  "A small moment for this.",
  "Two minutes. That's all.",
  "Your turn — gently.",
  "Tend to this now.",
  "A quiet check-in.",
  "Begin where you are.",
] as const;

// ─── Handler ───────────────────────────────────────────────────────────────

/** Call once at app startup inside a useEffect in app/_layout.tsx. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// ─── Permissions ───────────────────────────────────────────────────────────

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const result = await Notifications.getPermissionsAsync();
    // iOS provisional (status 3) counts as granted
    if (result.ios?.status === 3 /* IosAuthorizationStatus.PROVISIONAL */) {
      return 'granted';
    }
    if (result.granted || result.status === 'granted') return 'granted';
    if (result.status === 'denied') return 'denied';
    return 'undetermined';
  } catch (e) {
    logger.error('notif: getPermissionStatus failed', e);
    return 'undetermined';
  }
}

/** Silent permission — no sound, no badge. On Android 13+ expo-notifications handles POST_NOTIFICATIONS. */
export async function requestPermission(): Promise<'granted' | 'denied'> {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      },
    });
    return status === 'granted' ? 'granted' : 'denied';
  } catch (e) {
    logger.error('notif: requestPermission failed', e);
    return 'denied';
  }
}

// ─── Android channel ───────────────────────────────────────────────────────

/**
 * Creates the "habit-reminders" channel on Android.
 * Idempotent — safe to call on every cold start.
 * Must run BEFORE any scheduleHabitReminder call on Android or the notification is silently dropped.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('habit-reminders', {
      name: 'Habit Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120, 80, 120],
      enableVibrate: true,
      sound: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (e) {
    logger.error('notif: ensureAndroidChannel failed', e);
  }
}

// ─── Schedule / cancel ─────────────────────────────────────────────────────

/**
 * Cancels the existing scheduled notification for habitId (if any),
 * then schedules a new DAILY repeating notification at habit.reminderTime.
 * Returns the new Notifications identifier, or null if reminderTime is absent.
 */
export async function scheduleHabitReminder(habit: Habit): Promise<string | null> {
  if (!habit.reminderTime) return null;

  try {
    // Cancel stale identifier (ignore if already gone)
    if (habit.reminderNotificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(habit.reminderNotificationId);
      } catch {
        // OK — already cancelled or never existed
      }
    }

    const [hourStr = '8', minuteStr = '0'] = habit.reminderTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const body = REMINDER_LINES[djb2(habit.id) % 6] ?? REMINDER_LINES[0]!;

    if (__DEV__ && Platform.OS === 'android') {
      Notifications.getNotificationChannelAsync('habit-reminders').then((ch) => {
        if (!ch) logger.warn('notif: android channel "habit-reminders" not found — scheduled notification may be silently dropped');
      });
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: habit.name,
        body,
        data: { habitId: habit.id, kind: 'habit-reminder' },
      },
      trigger: Platform.OS === 'android'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour,
            minute,
            repeats: true,
            channelId: 'habit-reminders',
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour,
            minute,
            repeats: true,
          },
    });

    // Write identifier back to the habit row (single device, not synced)
    db.update(habits)
      .set({ reminderNotificationId: identifier })
      .where(eq(habits.id, habit.id))
      .run();

    return identifier;
  } catch (e) {
    logger.error('notif: scheduleHabitReminder failed', e);
    return null;
  }
}

/** Cancels the scheduled notification for habitId and clears the stored identifier. */
export async function cancelHabitReminder(habitId: string): Promise<void> {
  try {
    const habit = await getHabit(habitId);
    if (!habit?.reminderNotificationId) return;

    try {
      await Notifications.cancelScheduledNotificationAsync(habit.reminderNotificationId);
    } catch {
      // OK — already gone
    }

    db.update(habits)
      .set({ reminderNotificationId: null })
      .where(eq(habits.id, habitId))
      .run();
  } catch (e) {
    logger.error('notif: cancelHabitReminder failed', e);
  }
}

/**
 * Cancels all scheduled notifications and clears stored identifiers.
 * Called on sign-out and account deletion. Does NOT reschedule.
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    db.update(habits).set({ reminderNotificationId: null }).run();
  } catch (e) {
    logger.error('notif: cancelAllReminders failed', e);
  }
}

/**
 * Cancels all scheduled notifications and re-schedules from current DB state.
 *
 * Called on TZ change. Android requires this; iOS would mostly handle it but
 * we reschedule for parity.
 */
export async function rescheduleAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const all = await listHabits({ includeArchived: false });
    const withReminders = all.filter((h) => h.reminderTime != null);
    await Promise.all(withReminders.map(scheduleHabitReminder));
  } catch (e) {
    logger.error('notif: rescheduleAll failed', e);
  }
}

// ─── Tap handler ───────────────────────────────────────────────────────────

/**
 * Sets up the notification tap-response listener and handles the cold-start
 * case (app launched by tapping a notification).
 * Returns a cleanup function — call it on unmount.
 */
export function setupTapHandler(onHabitReminder: () => void): () => void {
  const consumed = { current: false };

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    if (data?.kind === 'habit-reminder' && !consumed.current) {
      consumed.current = true;
      onHabitReminder();
    }
  });

  // Cold-start: app was opened by tapping the notification
  // eslint-disable-next-line deprecation/deprecation
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response || consumed.current) return;
    const data = response.notification.request.content.data as Record<string, unknown>;
    if (data?.kind === 'habit-reminder') {
      consumed.current = true;
      onHabitReminder();
    }
  });

  return () => sub.remove();
}

// ─── Dismiss delivered ─────────────────────────────────────────────────────

/**
 * Dismisses any delivered (banner-tray) notification for a habit.
 * Call best-effort after a check-in — do not await in UI path.
 */
export async function dismissDeliveredHabitReminder(habitId: string): Promise<void> {
  try {
    const delivered = await Notifications.getPresentedNotificationsAsync();
    const matching = delivered.filter(
      (n) =>
        n.request.content.data?.kind === 'habit-reminder' &&
        n.request.content.data?.habitId === habitId,
    );
    await Promise.all(
      matching.map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch (e) {
    logger.error('notif: dismissDeliveredHabitReminder failed', e);
  }
}
