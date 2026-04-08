import { relations } from 'drizzle-orm'
import { index, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'

export const rateLimits = pgTable(
	'rate_limits',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userDiscordId: text('user_discord_id').notNull(),
		action: text('action').notNull(),
		lastActionAt: timestamp('last_action_at', { withTimezone: true }).notNull(),
	},
	(t) => ({
		uniqueGuildUserAction: unique('uq_rate_limits_guild_user_action').on(
			t.guildId,
			t.userDiscordId,
			t.action,
		),
		lastActionIdx: index('idx_rate_limits_last_action').on(t.lastActionAt),
	}),
)

export const rateLimitsRelations = relations(rateLimits, ({ one }) => ({
	guild: one(guilds, { fields: [rateLimits.guildId], references: [guilds.id] }),
}))

export type RateLimit = typeof rateLimits.$inferSelect
export type NewRateLimit = typeof rateLimits.$inferInsert
