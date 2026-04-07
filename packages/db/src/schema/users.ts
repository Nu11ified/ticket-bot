import { relations } from 'drizzle-orm'
import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'

export const users = pgTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	discordId: text('discord_id').notNull().unique(),
	username: text('username').notNull(),
	displayName: text('display_name'),
	avatarUrl: text('avatar_url'),
	email: text('email'),
	emailVerified: boolean('email_verified').default(false).notNull(),
	isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
	polarCustomerId: text('polar_customer_id'),
	subscriptionStatus: text('subscription_status').default('none').notNull(),
	premiumGuildQuota: integer('premium_guild_quota').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const guildMembers = pgTable(
	'guild_members',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueGuildUser: unique('uq_guild_members_guild_user').on(t.guildId, t.userId),
	}),
)

export const permissions = pgTable('permissions', {
	id: serial('id').primaryKey(),
	key: text('key').notNull().unique(),
	description: text('description'),
	category: text('category').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const discordRoles = pgTable(
	'discord_roles',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		discordRoleId: text('discord_role_id').notNull(),
		name: text('name').notNull(),
		color: integer('color'),
		position: integer('position'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueGuildRole: unique('uq_discord_roles_guild_role').on(t.guildId, t.discordRoleId),
	}),
)

export const rolePermissions = pgTable(
	'role_permissions',
	{
		id: serial('id').primaryKey(),
		discordRoleId: integer('discord_role_id')
			.notNull()
			.references(() => discordRoles.id, { onDelete: 'cascade' }),
		permissionId: integer('permission_id')
			.notNull()
			.references(() => permissions.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueRolePermission: unique('uq_role_permissions_role_perm').on(
			t.discordRoleId,
			t.permissionId,
		),
	}),
)

export const guildMemberRoles = pgTable(
	'guild_member_roles',
	{
		id: serial('id').primaryKey(),
		guildMemberId: integer('guild_member_id')
			.notNull()
			.references(() => guildMembers.id, { onDelete: 'cascade' }),
		discordRoleId: integer('discord_role_id')
			.notNull()
			.references(() => discordRoles.id, { onDelete: 'cascade' }),
		syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
	},
	(t) => ({
		uniqueMemberRole: unique('uq_guild_member_roles_member_role').on(
			t.guildMemberId,
			t.discordRoleId,
		),
	}),
)

export const usersRelations = relations(users, ({ many }) => ({
	guildMembers: many(guildMembers),
}))

export const guildMembersRelations = relations(guildMembers, ({ one, many }) => ({
	guild: one(guilds, { fields: [guildMembers.guildId], references: [guilds.id] }),
	user: one(users, { fields: [guildMembers.userId], references: [users.id] }),
	roles: many(guildMemberRoles),
}))

export const discordRolesRelations = relations(discordRoles, ({ one, many }) => ({
	guild: one(guilds, { fields: [discordRoles.guildId], references: [guilds.id] }),
	permissions: many(rolePermissions),
	memberRoles: many(guildMemberRoles),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
	discordRole: one(discordRoles, {
		fields: [rolePermissions.discordRoleId],
		references: [discordRoles.id],
	}),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id],
	}),
}))

export const guildMemberRolesRelations = relations(guildMemberRoles, ({ one }) => ({
	guildMember: one(guildMembers, {
		fields: [guildMemberRoles.guildMemberId],
		references: [guildMembers.id],
	}),
	discordRole: one(discordRoles, {
		fields: [guildMemberRoles.discordRoleId],
		references: [discordRoles.id],
	}),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type GuildMember = typeof guildMembers.$inferSelect
export type NewGuildMember = typeof guildMembers.$inferInsert
export type Permission = typeof permissions.$inferSelect
export type DiscordRole = typeof discordRoles.$inferSelect
export type NewDiscordRole = typeof discordRoles.$inferInsert
