CREATE TABLE `game_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` integer NOT NULL,
	`round_number` integer NOT NULL,
	`winner_id` text NOT NULL,
	`scores` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_id`) REFERENCES `room_players`(`player_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`action` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `room_players` (
	`room_id` integer NOT NULL,
	`name` text NOT NULL,
	`player_id` text NOT NULL,
	`is_host` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_players_player_id_unique` ON `room_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`host_ip` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`settings` text NOT NULL,
	`game_state` text,
	`current_round` integer DEFAULT 0 NOT NULL,
	`winner_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`winner_id`) REFERENCES `room_players`(`player_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);