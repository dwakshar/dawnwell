import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const RITUAL_SLOTS = ['morning', 'focus', 'evening', 'custom'] as const;
export type RitualSlot = (typeof RITUAL_SLOTS)[number];

export const HABIT_COLORS = [
  '#0066ff',
  '#06b6d4',
  '#0d9488',
  '#4f46e5',
  '#7c3aed',
  '#0284c7',
  '#475569',
  '#10b981',
] as const;

// ─── Tables ────────────────────────────────────────────────────────────────

export const rituals = sqliteTable('rituals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slot: text('slot', { enum: RITUAL_SLOTS }).notNull(),
  orderIndex: integer('order_index').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  // ── sync columns ─────────────────────────────────────────────────────────
  version: integer('version').notNull().default(1),
  /** 1 = write pending network push; 0 = clean */
  pendingSync: integer('pending_sync').notNull().default(0),
  /** Unix ms. Non-null = soft-deleted; synced then optionally hard-deleted locally. */
  deletedAt: integer('deleted_at'),
});

export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    ritualId: text('ritual_id')
      .notNull()
      .references(() => rituals.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    targetPerDay: integer('target_per_day').notNull().default(1),
    reminderTime: text('reminder_time'),
    reminderDays: text('reminder_days').notNull().default('1111111'),
    graceDaysPerWeek: integer('grace_days_per_week').notNull().default(1),
    archivedAt: integer('archived_at'),
    /**
     * Local notification identifier for the scheduled habit reminder.
     * Local to this device. Not synced. Will differ per install.
     * SYNC-EXCLUDE
     */
    reminderNotificationId: text('reminder_notification_id'),
    orderIndex: integer('order_index').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    // ── sync columns ───────────────────────────────────────────────────────
    version: integer('version').notNull().default(1),
    pendingSync: integer('pending_sync').notNull().default(0),
    deletedAt: integer('deleted_at'),
  },
  (t) => [
    index('idx_habits_ritual_id').on(t.ritualId),
    index('idx_habits_archived').on(t.archivedAt),
  ],
);

export const checkIns = sqliteTable(
  'check_ins',
  {
    id: text('id').primaryKey(),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    count: integer('count').notNull().default(1),
    completedAt: integer('completed_at').notNull(),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
    // ── sync columns ───────────────────────────────────────────────────────
    version: integer('version').notNull().default(1),
    pendingSync: integer('pending_sync').notNull().default(0),
    deletedAt: integer('deleted_at'),
  },
  (t) => [
    unique('uq_checkin_habit_date').on(t.habitId, t.date),
    index('idx_checkins_habit_id').on(t.habitId),
    index('idx_checkins_date').on(t.date),
  ],
);

// ─── Inferred types ────────────────────────────────────────────────────────

export type Ritual = InferSelectModel<typeof rituals>;
export type NewRitual = InferInsertModel<typeof rituals>;

export type Habit = InferSelectModel<typeof habits>;
export type NewHabit = InferInsertModel<typeof habits>;

export type CheckIn = InferSelectModel<typeof checkIns>;
export type NewCheckIn = InferInsertModel<typeof checkIns>;
