import { create } from 'zustand';
import { storage, StorageKey } from '@/lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeStoreState = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const VALID = new Set<ThemePreference>(['system', 'light', 'dark']);

function readStored(): ThemePreference {
  const v = storage.getString(StorageKey.SETTINGS_THEME);
  return v && VALID.has(v as ThemePreference) ? (v as ThemePreference) : 'system';
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  preference: readStored(),
  setPreference: (preference) => {
    storage.setString(StorageKey.SETTINGS_THEME, preference);
    set({ preference });
  },
}));
