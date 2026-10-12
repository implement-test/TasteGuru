CREATE TABLE `food` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`store_name` text,
	`price` integer,
	`source_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `food_created_at_idx` ON `food` (`created_at`);--> statement-breakpoint
CREATE INDEX `food_name_idx` ON `food` (`name`);--> statement-breakpoint
CREATE TABLE `food_image` (
	`id` text PRIMARY KEY NOT NULL,
	`food_id` text NOT NULL,
	`storage` text NOT NULL,
	`location` text NOT NULL,
	`position` integer NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `food_image_food_id_idx` ON `food_image` (`food_id`,`position`);--> statement-breakpoint
CREATE TABLE `rating` (
	`food_id` text NOT NULL,
	`user_id` text NOT NULL,
	`overall` integer NOT NULL,
	`memo` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`food_id`, `user_id`),
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rating_user_id_idx` ON `rating` (`user_id`);--> statement-breakpoint
CREATE TABLE `rating_score` (
	`food_id` text NOT NULL,
	`user_id` text NOT NULL,
	`attribute_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`food_id`, `user_id`, `attribute_id`),
	FOREIGN KEY (`attribute_id`) REFERENCES `taste_attribute`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_id`,`user_id`) REFERENCES `rating`(`food_id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `taste_attribute` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`guide` text,
	`position` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
