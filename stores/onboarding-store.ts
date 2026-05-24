import { create } from 'zustand';
import { storage, StorageKey } from '@/lib/storage';

type OnboardingState = {
  completed: boolean;
  currentStep: 0 | 1 | 2;
  complete: () => void;
  reset: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: storage.getBoolean(StorageKey.APP_ONBOARDED) ?? false,
  currentStep: 0,

  complete: () => {
    storage.setBoolean(StorageKey.APP_ONBOARDED, true);
    set({ completed: true });
  },

  reset: () => {
    storage.setBoolean(StorageKey.APP_ONBOARDED, false);
    set({ completed: false, currentStep: 0 });
  },
}));
