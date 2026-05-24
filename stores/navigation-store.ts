import { create } from 'zustand';

type NavigationState = {
  /** Set before navigating to History to pre-select a habit; consumed once on focus and cleared. */
  historyPreselectHabitId: string | null;
  setHistoryPreselectHabitId: (id: string | null) => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  historyPreselectHabitId: null,
  setHistoryPreselectHabitId: (id) => set({ historyPreselectHabitId: id }),
}));
