import * as Haptics from 'expo-haptics';

async function fire(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // silently fail on emulator or when haptics unavailable
  }
}

export async function light(): Promise<void> {
  await fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export async function medium(): Promise<void> {
  await fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export async function success(): Promise<void> {
  await fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export async function warning(): Promise<void> {
  await fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}

export async function error(): Promise<void> {
  await fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );
}
