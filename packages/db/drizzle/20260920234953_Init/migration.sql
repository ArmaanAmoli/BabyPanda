CREATE TABLE `api_keys` (
	`provider` text,
	`endpoint` text,
	`key` text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE `compaction_results` (
	`session_id` text,
	`created_at` integer,
	`content` text,
	CONSTRAINT `compaction_results_pk` PRIMARY KEY(`session_id`, `created_at`),
	CONSTRAINT `fk_compaction_results_session_id_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `message` (
	`message_index` integer,
	`session_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`content` text,
	`role` text,
	CONSTRAINT `message_pk` PRIMARY KEY(`message_index`, `session_id`),
	CONSTRAINT `fk_message_session_id_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`session_id` text PRIMARY KEY,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`parent_session_id` text,
	`messages_count` integer DEFAULT 0,
	`tokens_in_context_window` integer DEFAULT 0,
	`project_directory` text
);
