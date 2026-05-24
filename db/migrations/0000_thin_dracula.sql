CREATE TABLE `check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_checkins_habit_id` ON `check_ins` (`habit_id`);--> statement-breakpoint
CREATE INDEX `idx_checkins_date` ON `check_ins` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_checkin_habit_date` ON `check_ins` (`habit_id`,`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`ritual_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`target_per_day` integer DEFAULT 1 NOT NULL,
	`reminder_time` text,
	`reminder_days` text DEFAULT '1111111' NOT NULL,
	`grace_days_per_week` integer DEFAULT 1 NOT NULL,
	`archived_at` integer,
	`order_index` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`ritual_id`) REFERENCES `rituals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_habits_ritual_id` ON `habits` (`ritual_id`);--> statement-breakpoint
CREATE INDEX `idx_habits_archived` ON `habits` (`archived_at`);--> statement-breakpoint
CREATE TABLE `rituals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slot` text NOT NULL,
	`order_index` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
