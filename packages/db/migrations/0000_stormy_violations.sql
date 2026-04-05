CREATE TABLE "guilds" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guilds_discord_id_unique" UNIQUE("discord_id")
);
