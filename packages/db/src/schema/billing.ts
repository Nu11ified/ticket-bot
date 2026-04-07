import { relations } from 'drizzle-orm'
import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'
import { users } from './users.js'

export const premiumAssignments = pgTable(
	'premium_assignments',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueUserGuild: unique('uq_premium_assignments_user_guild').on(t.userId, t.guildId),
	}),
)

export const premiumAssignmentsRelations = relations(premiumAssignments, ({ one }) => ({
	user: one(users, { fields: [premiumAssignments.userId], references: [users.id] }),
	guild: one(guilds, { fields: [premiumAssignments.guildId], references: [guilds.id] }),
}))

export type PremiumAssignment = typeof premiumAssignments.$inferSelect
