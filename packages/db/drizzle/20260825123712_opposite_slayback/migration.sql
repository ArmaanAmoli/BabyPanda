CREATE TABLE `message` (
	`message_id` integer PRIMARY KEY AUTOINCREMENT DEFAULT 789667,
	`session_id` integer,
	`content` text,
	`role` text,
	CONSTRAINT `fk_message_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` integer PRIMARY KEY AUTOINCREMENT DEFAULT 789377,
	`created_at` text,
	`parent_session_id` integer
);
