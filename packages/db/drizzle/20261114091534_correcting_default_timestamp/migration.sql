PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`session_id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`parent_session_id` text,
	`messages_count` integer DEFAULT 0 NOT NULL,
	`tokens_in_context_window` integer DEFAULT 0 NOT NULL,
	`project_directory` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_session`(`session_id`, `created_at`, `parent_session_id`, `messages_count`, `tokens_in_context_window`, `project_directory`) SELECT `session_id`, `created_at`, `parent_session_id`, `messages_count`, `tokens_in_context_window`, `project_directory` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;