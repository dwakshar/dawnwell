import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import {
  getRangeAggregate,
  getRangeSeries,
  getPerHabitScorecards,
  type StatRange,
} from '@/lib/queries/stats';

function anchor(): Date {
  return new Date();
}

export function useRangeAggregate(range: StatRange) {
  return useQuery({
    queryKey: queryKeys.statsAggregate(range),
    queryFn: () => getRangeAggregate(range, anchor()),
    staleTime: 30_000,
  });
}

export function useRangeSeries(range: StatRange) {
  return useQuery({
    queryKey: queryKeys.statsSeries(range),
    queryFn: () => getRangeSeries(range, anchor()),
    staleTime: 30_000,
  });
}

export function useScorecards(range: StatRange) {
  return useQuery({
    queryKey: queryKeys.statsScorecards(range),
    queryFn: () => getPerHabitScorecards(range, anchor()),
    staleTime: 30_000,
  });
}
