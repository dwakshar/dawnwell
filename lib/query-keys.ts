export const queryKeys = {
  rituals: () => ['rituals'] as const,
  habits: () => ['habits'] as const,
  archivedHabits: () => ['habits', 'archived'] as const,
  todayCheckIns: (dateISO: string) => ['check-ins', 'today', dateISO] as const,
  todayView: (dateISO: string) => ['today', dateISO] as const,
  historyMonth: (habitId: string, monthKey: string) =>
    ['history', 'month', habitId, monthKey] as const,
  historyEarliest: () => ['history', 'earliest'] as const,
  historyDay: (dateKey: string) => ['history', 'day', dateKey] as const,
  stats: () => ['stats'] as const,
  statsAggregate: (range: string) => ['stats', 'aggregate', range] as const,
  statsSeries: (range: string) => ['stats', 'series', range] as const,
  statsScorecards: (range: string) => ['stats', 'scorecards', range] as const,
};
