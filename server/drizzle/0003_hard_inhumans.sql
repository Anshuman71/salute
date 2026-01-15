ALTER TABLE `players` RENAME TO `room_players`;--> statement-breakpoint
ALTER TABLE `room_players` RENAME COLUMN "session_id" TO "player_id";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_room_players` (
	`room_id` integer NOT NULL,
	`name` text NOT NULL,
	`player_id` text NOT NULL,
	`is_host` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_room_players`("room_id", "name", "player_id", "is_host", "joined_at") SELECT "room_id", "name", "player_id", "is_host", "joined_at" FROM `room_players`;--> statement-breakpoint
DROP TABLE `room_players`;--> statement-breakpoint
ALTER TABLE `__new_room_players` RENAME TO `room_players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `room_players_player_id_unique` ON `room_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `__new_game_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` integer NOT NULL,
	`round_number` integer NOT NULL,
	`winner_id` integer NOT NULL,
	`scores` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_id`) REFERENCES `room_players`(`player_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_game_rounds`("id", "room_id", "round_number", "winner_id", "scores", "created_at") SELECT "id", "room_id", "round_number", "winner_id", "scores", "created_at" FROM `game_rounds`;--> statement-breakpoint
DROP TABLE `game_rounds`;--> statement-breakpoint
ALTER TABLE `__new_game_rounds` RENAME TO `game_rounds`;--> statement-breakpoint
CREATE TABLE `__new_rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`host_ip` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`settings` text NOT NULL,
	`game_state` text,
	`current_round` integer DEFAULT 0 NOT NULL,
	`winner_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`winner_id`) REFERENCES `room_players`(`player_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_rooms`("id", "code", "host_ip", "status", "settings", "game_state", "current_round", "winner_id", "created_at") SELECT "id", "code", "host_ip", "status", "settings", "game_state", "current_round", "winner_id", "created_at" FROM `rooms`;--> statement-breakpoint
DROP TABLE `rooms`;--> statement-breakpoint
ALTER TABLE `__new_rooms` RENAME TO `rooms`;--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);