import { create } from 'zustand';

type TodayStore = {
  hasIncompleteHabits: boolean;
  setHasIncompleteHabits: (val: boolean) => void;
};

export const useTodayStore = create<TodayStore>((set) => ({
  hasIncompleteHabits: false,
  setHasIncompleteHabits: (val) => set({ hasIncompleteHabits: val }),
}));
