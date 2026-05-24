import { createMMKV } from 'react-native-mmkv';

const kv = createMMKV({ id: 'dawnwell-kv' });

export const StorageKey = {
  SETTINGS_THEME: 'settings.theme',
  SETTINGS_HAPTICS: 'settings.haptics',
  SETTINGS_NOTIFICATIONS: 'settings.notifications',
  SYNC_LAST_PULL_AT: 'sync.lastPullAt',
  SYNC_LAST_PUSH_AT: 'sync.lastPushAt',
  APP_ONBOARDED: 'app.onboarded',
  APP_INSTALL_ID: 'app.installId',
  NOTIFICATIONS_PERMISSION: 'app.notificationsPermission',
} as const;

export type StorageKeyType = (typeof StorageKey)[keyof typeof StorageKey];

export const storage = {
  getString(key: string): string | undefined {
    return kv.getString(key);
  },
  setString(key: string, value: string): void {
    kv.set(key, value);
  },

  getBoolean(key: string): boolean | undefined {
    return kv.getBoolean(key);
  },
  setBoolean(key: string, value: boolean): void {
    kv.set(key, value);
  },

  getNumber(key: string): number | undefined {
    return kv.getNumber(key);
  },
  setNumber(key: string, value: number): void {
    kv.set(key, value);
  },

  getJSON<T>(key: string): T | undefined {
    const raw = kv.getString(key);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },
  setJSON<T>(key: string, value: T): void {
    kv.set(key, JSON.stringify(value));
  },

  delete(key: string): void {
    kv.remove(key);
  },
  clearAll(): void {
    kv.clearAll();
  },
};
