import { relations } from 'drizzle-orm'
import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'
import { discordRoles } from './users.js'

export const categories = pgTable('categories', {
	id: serial('id').primaryKey(),
	guildId: integer('guild_id')
		.notNull()
		.references(() => guilds.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	ticketPrefix: text('ticket_prefix'),
	emoji: text('emoji'),
	channelMode: text('channel_mode').default('channel').notNull(),
	targetChannelId: text('target_channel_id'),
	autoCloseHours: integer('auto_close_hours'),
	maxOpenPerUser: integer('max_open_per_user').default(1),
	position: integer('position').default(0).notNull(),
	isEnabled: boolean('is_enabled').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const categoryRoleAccess = pgTable(
	'category_role_access',
	{
		id: serial('id').primaryKey(),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' }),
		discordRoleId: integer('discord_role_id')
			.notNull()
			.references(() => discordRoles.id, { onDelete: 'cascade' }),
		accessType: text('access_type').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueCategoryRole: unique('uq_category_role_access_cat_role').on(
			t.categoryId,
			t.discordRoleId,
		),
	}),
)

export const categoriesRelations = relations(categories, ({ one, many }) => ({
	guild: one(guilds, { fields: [categories.guildId], references: [guilds.id] }),
	roleAccess: many(categoryRoleAccess),
}))

export const categoryRoleAccessRelations = relations(categoryRoleAccess, ({ one }) => ({
	category: one(categories, {
		fields: [categoryRoleAccess.categoryId],
		references: [categories.id],
	}),
	discordRole: one(discordRoles, {
		fields: [categoryRoleAccess.discordRoleId],
		references: [discordRoles.id],
	}),
}))

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
