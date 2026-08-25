ALTER TABLE `message` RENAME COLUMN `messageId` TO `message_id`;--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN `id` TO `session_id`;--> statement-breakpoint
ALTER TABLE `message` ADD `created_at` text DEFAULT (CURRENT_TIMESTAMP);