ALTER TABLE `message` RENAME COLUMN `message_id` TO `message_index`;--> statement-breakpoint
ALTER TABLE `session` ADD `messages_count` integer DEFAULT 0;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message` (
	`message_index` integer,
	`session_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`content` text,
	`role` text,
	CONSTRAINT `message_pk` PRIMARY KEY(`message_index`, `session_id`),
	CONSTRAINT `fk_message_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`session_id`)
);
--> statement-breakpoint
INSERT INTO `__new_message`(`message_index`, `session_id`, `created_at`, `content`, `role`) SELECT `message_index`, `session_id`, `created_at`, `content`, `role` FROM `message`;--> statement-breakpoint
DROP TABLE `message`;--> statement-breakpoint
ALTER TABLE `__new_message` RENAME TO `message`;--> statement-breakpoint
PRAGMA foreign_keys=ON;