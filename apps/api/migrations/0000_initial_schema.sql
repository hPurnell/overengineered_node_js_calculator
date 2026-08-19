CREATE TABLE `calculations` (
	`id` text PRIMARY KEY NOT NULL,
	`expression` text NOT NULL,
	`display_expression` text NOT NULL,
	`result` text NOT NULL,
	`display_result` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calculations_created_at_id_idx` ON `calculations` (`created_at`,`id`);