import { relations } from 'drizzle-orm'
import { index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'
import { tickets } from './tickets.js'
import { users } from './users.js'

export const auditLogs = pgTable(
	'audit_logs',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		ticketId: integer('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
		actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
		actorDiscordId: text('actor_discord_id'),
		actorType: text('actor_type').default('user').notNull(),
		action: text('action').notNull(),
		metadata: jsonb('metadata').default('{}').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		guildTimeIdx: index('idx_audit_logs_guild_time').on(t.guildId, t.createdAt),
		ticketIdx: index('idx_audit_logs_ticket').on(t.ticketId),
		actorDiscordIdx: index('idx_audit_logs_actor_discord').on(t.actorDiscordId),
	}),
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	guild: one(guilds, { fields: [auditLogs.guildId], references: [guilds.id] }),
	ticket: one(tickets, { fields: [auditLogs.ticketId], references: [tickets.id] }),
	actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}))

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
