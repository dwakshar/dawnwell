export const queryKeys = {
  rituals: () => ['rituals'] as const,
  habits: () => ['habits'] as const,
  todayCheckIns: (dateISO: string) => ['check-ins', 'today', dateISO] as const,
  todayView: (dateISO: string) => ['today', dateISO] as const,
};
