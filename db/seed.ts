import { db } from './client';
import { rituals } from './schema';
import { createRitual } from './repos/rituals';
import { createHabit } from './repos/habits';

export async function seedIfEmpty(): Promise<void> {
  const existing = db.select({ id: rituals.id }).from(rituals).all();
  if (existing.length > 0) return;

  const morning = await createRitual({ name: 'Morning', slot: 'morning', orderIndex: 0 });
  const focus = await createRitual({ name: 'Focus', slot: 'focus', orderIndex: 1 });
  const evening = await createRitual({ name: 'Evening', slot: 'evening', orderIndex: 2 });

  await createHabit({
    ritualId: morning.id,
    name: 'Drink water',
    icon: 'GlassWater',
    color: '#c2410c',
    targetPerDay: 3,
    reminderTime: '07:30',
    reminderDays: '1111111',
    graceDaysPerWeek: 1,
    archivedAt: null,
    orderIndex: 0,
  });

  await createHabit({
    ritualId: morning.id,
    name: 'Stretch',
    icon: 'Activity',
    color: '#d97706',
    targetPerDay: 1,
    reminderTime: '07:45',
    reminderDays: '1111111',
    graceDaysPerWeek: 1,
    archivedAt: null,
    orderIndex: 1,
  });

  await createHabit({
    ritualId: focus.id,
    name: 'Deep work block',
    icon: 'Brain',
    color: '#65735a',
    targetPerDay: 2,
    reminderTime: '10:00',
    reminderDays: '1111100',
    graceDaysPerWeek: 1,
    archivedAt: null,
    orderIndex: 0,
  });

  await createHabit({
    ritualId: focus.id,
    name: 'Read 20 min',
    icon: 'BookOpen',
    color: '#9a3412',
    targetPerDay: 1,
    reminderTime: '14:00',
    reminderDays: '1111111',
    graceDaysPerWeek: 1,
    archivedAt: null,
    orderIndex: 1,
  });

  await createHabit({
    ritualId: evening.id,
    name: 'Walk',
    icon: 'Footprints',
    color: '#84a07a',
    targetPerDay: 1,
    reminderTime: '18:30',
    reminderDays: '1111111',
    graceDaysPerWeek: 1,
    archivedAt: null,
    orderIndex: 0,
  });

  await createHabit({
    ritualId: evening.id,
    name: 'Journal',
    icon: 'PenLine',
    color: '#c2410c',
    targetPerDay: 1,
    reminderTime: '21:00',
    reminderDays: '1111111',
    graceDaysPerWeek: 1,
    archivedAt: null,
    orderIndex: 1,
  });
}
