CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lesson_id` integer,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_user_status_lesson` ON `attempts` (`user_id`,`status`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `learners` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`write_token` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
