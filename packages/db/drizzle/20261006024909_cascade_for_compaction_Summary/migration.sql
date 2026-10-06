PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message` (
	`message_index` integer,
	`session_id` text,
	`created_at` integer DEFAULT 1791254949952,
	`content` text,
	`role` text,
	`is_tool_result` integer DEFAULT false NOT NULL,
	CONSTRAINT `message_pk` PRIMARY KEY(`message_index`, `session_id`),
	CONSTRAINT `fk_message_session_id_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`session_id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_message`(`message_index`, `session_id`, `created_at`, `content`, `role`, `is_tool_result`) SELECT `message_index`, `session_id`, `created_at`, `content`, `role`, `is_tool_result` FROM `message`;--> statement-breakpoint
DROP TABLE `message`;--> statement-breakpoint
ALTER TABLE `__new_message` RENAME TO `message`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`session_id` text PRIMARY KEY,
	`created_at` integer DEFAULT 1791254949952,
	`parent_session_id` text,
	`messages_count` integer DEFAULT 0,
	`tokens_in_context_window` integer DEFAULT 0,
	`project_directory` text
);
--> statement-breakpoint
INSERT INTO `__new_session`(`session_id`, `created_at`, `parent_session_id`, `messages_count`, `tokens_in_context_window`, `project_directory`) SELECT `session_id`, `created_at`, `parent_session_id`, `messages_count`, `tokens_in_context_window`, `project_directory` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_compaction_results` (
	`session_id` text,
	`created_at` integer,
	`content` text,
	CONSTRAINT `compaction_results_pk` PRIMARY KEY(`session_id`, `created_at`),
	CONSTRAINT `fk_compaction_results_session_id_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`session_id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_compaction_results`(`session_id`, `created_at`, `content`) SELECT `session_id`, `created_at`, `content` FROM `compaction_results`;--> statement-breakpoint
DROP TABLE `compaction_results`;--> statement-breakpoint
ALTER TABLE `__new_compaction_results` RENAME TO `compaction_results`;--> statement-breakpoint
PRAGMA foreign_keys=ON;