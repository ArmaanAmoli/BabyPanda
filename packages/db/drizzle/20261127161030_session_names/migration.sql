ALTER TABLE `session` ADD `name` text DEFAULT 'untitled' NOT NULL;--> statement-breakpoint
UPDATE `session` SET `name` = 'untitled-' || (
  SELECT COUNT(*) FROM `session` AS `other`
  WHERE `other`.`project_directory` = `session`.`project_directory`
    AND (`other`.`created_at` < `session`.`created_at`
      OR (`other`.`created_at` = `session`.`created_at` AND `other`.`session_id` <= `session`.`session_id`))
);--> statement-breakpoint
CREATE UNIQUE INDEX `session_project_directory_name_unique` ON `session` (`project_directory`,`name`);
