CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`saturday` text NOT NULL,
	`actor` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog` (
	`name` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`diet` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_status` (
	`name` text PRIMARY KEY NOT NULL,
	`saturday` text NOT NULL,
	`seen_revision` integer DEFAULT -1 NOT NULL,
	`seen_at` text DEFAULT '' NOT NULL,
	`approved_revision` integer DEFAULT -1 NOT NULL,
	`approved_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `food_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL
);
