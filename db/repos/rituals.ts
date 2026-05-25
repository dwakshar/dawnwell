import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { db } from '../client';
import { rituals, type NewRitual, type Ritual, type RitualSlot } from '../schema';

export async function listRituals(): Promise<Ritual[]> {
  return db
    .select()
    .from(rituals)
    .where(isNull(rituals.deletedAt))
    .orderBy(rituals.orderIndex)
    .all();
}

export async function getRitual(id: string): Promise<Ritual | null> {
  const rows = db.select().from(rituals).where(eq(rituals.id, id)).all();
  return rows[0] ?? null;
}

export async function createRitual(input: {
  name: string;
  slot: RitualSlot;
  orderIndex?: number;
}): Promise<Ritual> {
  const now = Date.now();
  const allRituals = db.select({ orderIndex: rituals.orderIndex }).from(rituals).all();
  const maxOrder = allRituals.reduce((m, r) => Math.max(m, r.orderIndex), -1);

  const row: NewRitual = {
    id: nanoid(12),
    name: input.name,
    slot: input.slot,
    orderIndex: input.orderIndex ?? maxOrder + 1,
    createdAt: now,
    updatedAt: now,
    pendingSync: 1,
    version: 1,
  };

  db.insert(rituals).values(row).run();
  return (await getRitual(row.id))!;
}

export async function updateRitual(
  id: string,
  patch: Partial<Pick<Ritual, 'name' | 'slot' | 'orderIndex'>>,
): Promise<Ritual> {
  db.update(rituals)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(rituals.id, id))
    .run();
  const updated = await getRitual(id);
  if (!updated) throw new Error(`Ritual ${id} not found after update`);
  return updated;
}

export async function deleteRitual(id: string): Promise<void> {
  db.delete(rituals).where(eq(rituals.id, id)).run();
}
