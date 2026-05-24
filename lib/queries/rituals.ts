import { listRituals } from '@/db/repos/rituals';
import type { Ritual } from '@/db/schema';

export async function getRituals(): Promise<Ritual[]> {
  return listRituals();
}
