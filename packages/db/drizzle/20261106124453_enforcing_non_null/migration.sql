ALTER TABLE `message` RENAME COLUMN `message_index` TO `seq`;--> statement-breakpoint
ALTER TABLE `message` ADD `id` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`key` text PRIMARY KEY
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`(`provider`, `endpoint`, `key`) SELECT `provider`, `endpoint`, `key` FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`content` text NOT NULL,
	`role` text NOT NULL,
	`seq` integer NOT NULL,
	CONSTRAINT `fk_message_session_id_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`session_id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_message`(`seq`, `session_id`, `content`, `role`) SELECT `seq`, `session_id`, `content`, `role` FROM `message`;--> statement-breakpoint
DROP TABLE `message`;--> statement-breakpoint
ALTER TABLE `__new_message` RENAME TO `message`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`session_id` text PRIMARY KEY,
	`created_at` integer DEFAULT 1793969071049 NOT NULL,
	`parent_session_id` text,
	`messages_count` integer DEFAULT 0 NOT NULL,
	`tokens_in_context_window` integer DEFAULT 0 NOT NULL,
	`project_directory` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_session`(`session_id`, `created_at`, `parent_session_id`, `messages_count`, `tokens_in_context_window`, `project_directory`) SELECT `session_id`, `created_at`, `parent_session_id`, `messages_count`, `tokens_in_context_window`, `project_directory` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `compaction_results`;