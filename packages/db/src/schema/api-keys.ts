import { relations } from 'drizzle-orm'
import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'
import { users } from './users.js'

export const apiKeys = pgTable(
	'api_keys',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		createdById: text('created_by_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		keyHash: text('key_hash').notNull().unique(),
		keyPrefix: text('key_prefix').notNull(),
		permissions: text('permissions').array().notNull(),
		rateLimitPerMinute: integer('rate_limit_per_minute'),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		guildIdx: index('idx_api_keys_guild').on(t.guildId),
		keyHashIdx: index('idx_api_keys_key_hash').on(t.keyHash),
	}),
)

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	guild: one(guilds, { fields: [apiKeys.guildId], references: [guilds.id] }),
	createdBy: one(users, { fields: [apiKeys.createdById], references: [users.id] }),
}))

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
