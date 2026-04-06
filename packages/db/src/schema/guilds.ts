import { relations } from 'drizzle-orm'
import {
	boolean,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core'

export const guilds = pgTable('guilds', {
	id: serial('id').primaryKey(),
	discordId: text('discord_id').notNull().unique(),
	name: text('name').notNull(),
	iconUrl: text('icon_url'),
	ticketPrefix: text('ticket_prefix').default('TICKET'),
	ticketCounter: integer('ticket_counter').default(0).notNull(),
	planTier: text('plan_tier').default('free').notNull(),
	polarCustomerId: text('polar_customer_id'),
	polarSubscriptionId: text('polar_subscription_id'),
	subscriptionStatus: text('subscription_status').default('none').notNull(),
	maxServers: integer('max_servers').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const guildSettings = pgTable('guild_settings', {
	id: serial('id').primaryKey(),
	guildId: integer('guild_id')
		.notNull()
		.unique()
		.references(() => guilds.id, { onDelete: 'cascade' }),
	logChannelId: text('log_channel_id'),
	transcriptChannelId: text('transcript_channel_id'),
	locale: text('locale').default('en').notNull(),
	timezone: text('timezone').default('UTC').notNull(),
	autoCloseHours: integer('auto_close_hours').default(48),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const freePremiumGrants = pgTable('free_premium_grants', {
	id: serial('id').primaryKey(),
	guildId: integer('guild_id')
		.notNull()
		.references(() => guilds.id, { onDelete: 'cascade' }),
	grantedBy: text('granted_by').notNull(),
	tier: text('tier').default('premium').notNull(),
	maxServers: integer('max_servers').default(3).notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	revoked: boolean('revoked').default(false).notNull(),
	revokedAt: timestamp('revoked_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const guildsRelations = relations(guilds, ({ one, many }) => ({
	settings: one(guildSettings, {
		fields: [guilds.id],
		references: [guildSettings.guildId],
	}),
	freePremiumGrants: many(freePremiumGrants),
}))

export const guildSettingsRelations = relations(guildSettings, ({ one }) => ({
	guild: one(guilds, {
		fields: [guildSettings.guildId],
		references: [guilds.id],
	}),
}))

export const freePremiumGrantsRelations = relations(freePremiumGrants, ({ one }) => ({
	guild: one(guilds, {
		fields: [freePremiumGrants.guildId],
		references: [guilds.id],
	}),
}))

export type Guild = typeof guilds.$inferSelect
export type NewGuild = typeof guilds.$inferInsert
export type GuildSettings = typeof guildSettings.$inferSelect
export type NewGuildSettings = typeof guildSettings.$inferInsert
export type FreePremiumGrant = typeof freePremiumGrants.$inferSelect
export type NewFreePremiumGrant = typeof freePremiumGrants.$inferInsert
