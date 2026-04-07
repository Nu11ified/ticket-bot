CREATE TABLE "premium_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" integer NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_premium_assignments_user_guild" UNIQUE("user_id","guild_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "polar_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_guild_quota" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "premium_assignments" ADD CONSTRAINT "premium_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_assignments" ADD CONSTRAINT "premium_assignments_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;