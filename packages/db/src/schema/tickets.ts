import { relations } from 'drizzle-orm'
import {
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core'
import { boolean } from 'drizzle-orm/pg-core'
import { categories } from './categories.js'
import { guilds } from './guilds.js'
import { formFields } from './panels.js'
import { users } from './users.js'

export const tickets = pgTable(
	'tickets',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id),
		ticketNumber: text('ticket_number').notNull(),
		subject: text('subject'),
		status: text('status').default('open').notNull(),
		priority: text('priority').default('normal').notNull(),
		channelId: text('channel_id'),
		creatorId: integer('creator_id')
			.notNull()
			.references(() => users.id),
		assignedToId: integer('assigned_to_id').references(() => users.id),
		closedById: integer('closed_by_id').references(() => users.id),
		closeReason: text('close_reason'),
		reopenedCount: integer('reopened_count').default(0).notNull(),
		firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		closedAt: timestamp('closed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueGuildTicketNumber: unique('uq_tickets_guild_number').on(t.guildId, t.ticketNumber),
		guildStatusIdx: index('idx_tickets_guild_status').on(t.guildId, t.status),
		guildCategoryIdx: index('idx_tickets_guild_category').on(t.guildId, t.categoryId),
		guildAssigneeIdx: index('idx_tickets_guild_assignee').on(t.guildId, t.assignedToId),
		creatorIdx: index('idx_tickets_creator').on(t.creatorId),
	}),
)

export const ticketFormResponses = pgTable('ticket_form_responses', {
	id: serial('id').primaryKey(),
	ticketId: integer('ticket_id')
		.notNull()
		.references(() => tickets.id, { onDelete: 'cascade' }),
	fieldId: integer('field_id')
		.notNull()
		.references(() => formFields.id),
	value: text('value').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const ticketMessages = pgTable(
	'ticket_messages',
	{
		id: serial('id').primaryKey(),
		ticketId: integer('ticket_id')
			.notNull()
			.references(() => tickets.id, { onDelete: 'cascade' }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id),
		discordMessageId: text('discord_message_id').unique(),
		content: text('content').notNull(),
		isStaff: boolean('is_staff').default(false).notNull(),
		isInternalNote: boolean('is_internal_note').default(false).notNull(),
		attachments: jsonb('attachments').default('[]').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		editedAt: timestamp('edited_at', { withTimezone: true }),
	},
	(t) => ({
		ticketTimelineIdx: index('idx_ticket_messages_ticket_time').on(t.ticketId, t.createdAt),
		discordMsgIdx: index('idx_ticket_messages_discord_id').on(t.discordMessageId),
	}),
)

export const transcripts = pgTable(
	'transcripts',
	{
		id: serial('id').primaryKey(),
		ticketId: integer('ticket_id')
			.notNull()
			.unique()
			.references(() => tickets.id, { onDelete: 'cascade' }),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id),
		messages: jsonb('messages').notNull(),
		messageCount: integer('message_count').notNull(),
		participants: jsonb('participants').notNull(),
		metadata: jsonb('metadata').default('{}').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		guildIdx: index('idx_transcripts_guild').on(t.guildId),
		expiresIdx: index('idx_transcripts_expires').on(t.expiresAt),
	}),
)

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
	guild: one(guilds, { fields: [tickets.guildId], references: [guilds.id] }),
	category: one(categories, { fields: [tickets.categoryId], references: [categories.id] }),
	creator: one(users, {
		fields: [tickets.creatorId],
		references: [users.id],
		relationName: 'ticketCreator',
	}),
	assignedTo: one(users, {
		fields: [tickets.assignedToId],
		references: [users.id],
		relationName: 'ticketAssignee',
	}),
	closedBy: one(users, {
		fields: [tickets.closedById],
		references: [users.id],
		relationName: 'ticketCloser',
	}),
	formResponses: many(ticketFormResponses),
	messages: many(ticketMessages),
	transcript: one(transcripts, { fields: [tickets.id], references: [transcripts.ticketId] }),
}))

export const ticketFormResponsesRelations = relations(ticketFormResponses, ({ one }) => ({
	ticket: one(tickets, { fields: [ticketFormResponses.ticketId], references: [tickets.id] }),
	field: one(formFields, { fields: [ticketFormResponses.fieldId], references: [formFields.id] }),
}))

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
	ticket: one(tickets, { fields: [ticketMessages.ticketId], references: [tickets.id] }),
	user: one(users, { fields: [ticketMessages.userId], references: [users.id] }),
}))

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
	ticket: one(tickets, { fields: [transcripts.ticketId], references: [tickets.id] }),
	guild: one(guilds, { fields: [transcripts.guildId], references: [guilds.id] }),
}))

export type Ticket = typeof tickets.$inferSelect
export type NewTicket = typeof tickets.$inferInsert
export type TicketMessage = typeof ticketMessages.$inferSelect
export type NewTicketMessage = typeof ticketMessages.$inferInsert
export type Transcript = typeof transcripts.$inferSelect
export type NewTranscript = typeof transcripts.$inferInsert
