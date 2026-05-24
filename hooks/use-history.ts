import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';

import { queryKeys } from '@/lib/query-keys';
import {
  getDayDetail,
  getEarliestActivityDate,
  getMonthCheckIns,
} from '@/lib/queries/history';
import { listHabits } from '@/db/repos/habits';

export function useHistoryHabits() {
  return useQuery({
    queryKey: queryKeys.habits(),
    queryFn: () => listHabits({ includeArchived: false }),
    staleTime: 30_000,
  });
}

export function useMonthCheckIns(habitId: string, monthDate: Date) {
  const monthKey = format(monthDate, 'yyyy-MM');
  return useQuery({
    queryKey: queryKeys.historyMonth(habitId, monthKey),
    queryFn: () =>
      getMonthCheckIns(habitId, startOfMonth(monthDate), endOfMonth(monthDate)),
    staleTime: 30_000,
  });
}

export function useEarliestActivityDate() {
  return useQuery({
    queryKey: queryKeys.historyEarliest(),
    queryFn: getEarliestActivityDate,
    staleTime: 30_000,
  });
}

export function useDayDetail(date: Date | null) {
  const dateKey = date ? format(date, 'yyyy-MM-dd') : '';
  return useQuery({
    queryKey: queryKeys.historyDay(dateKey),
    queryFn: () => getDayDetail(date!),
    enabled: date !== null,
    staleTime: 30_000,
  });
}
