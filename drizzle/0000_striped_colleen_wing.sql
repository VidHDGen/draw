CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_expires` ON `rooms` (`expires`);