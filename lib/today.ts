import { format } from 'date-fns';

// Returns yyyy-MM-dd in the device's LOCAL timezone.
// Never use toISOString().slice(0,10) — that's UTC and breaks at night.
export function getTodayISO(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}
