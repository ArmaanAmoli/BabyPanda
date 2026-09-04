ALTER TABLE `message` RENAME COLUMN `message_id` TO `messageId`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_message` (
	`messageId` text PRIMARY KEY,
	`session_id` text,
	`content` text,
	`role` text,
	CONSTRAINT `fk_message_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_message`(`messageId`, `session_id`, `content`, `role`) SELECT `messageId`, `session_id`, `content`, `role` FROM `message`;--> statement-breakpoint
DROP TABLE `message`;--> statement-breakpoint
ALTER TABLE `__new_message` RENAME TO `message`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`parent_session_id` text
);
--> statement-breakpoint
INSERT INTO `__new_session`(`id`, `created_at`, `parent_session_id`) SELECT `id`, `created_at`, `parent_session_id` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;