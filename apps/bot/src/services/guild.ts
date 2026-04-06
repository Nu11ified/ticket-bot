import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { discordRoles, guildMembers, guildSettings, guilds, users } from '@ticketbot/db'
import { PLAN_DEFAULTS } from '@ticketbot/shared'
import type { PlanTier } from '@ticketbot/shared'
import type { Guild as DiscordGuild, Role as DiscordRole, GuildMember as DiscordMember } from 'discord.js'

export async function upsertGuild(
	db: Database,
	discordGuild: DiscordGuild,
): Promise<{ guildId: number; isNew: boolean }> {
	const existing = await db
		.select({ id: guilds.id, planTier: guilds.planTier })
		.from(guilds)
		.where(eq(guilds.discordId, discordGuild.id))
		.limit(1)

	const first = existing[0]
	if (first) {
		await db
			.update(guilds)
			.set({
				name: discordGuild.name,
				iconUrl: discordGuild.iconURL() ?? null,
				updatedAt: new Date(),
			})
			.where(eq(guilds.id, first.id))

		return { guildId: first.id, isNew: false }
	}

	const inserted = await db
		.insert(guilds)
		.values({
			discordId: discordGuild.id,
			name: discordGuild.name,
			iconUrl: discordGuild.iconURL() ?? null,
		})
		.returning({ id: guilds.id, planTier: guilds.planTier })

	const newGuild = inserted[0]
	if (!newGuild) throw new Error('Failed to insert guild')

	const tier = newGuild.planTier as PlanTier
	const defaults = PLAN_DEFAULTS[tier]

	await db.insert(guildSettings).values({
		guildId: newGuild.id,
		transcriptRetentionDays: defaults.transcriptRetentionDays,
		ticketCooldownSeconds: defaults.ticketCooldownSeconds,
	})

	return { guildId: newGuild.id, isNew: true }
}

export async function syncGuildRoles(
	db: Database,
	guildId: number,
	roles: DiscordRole[],
): Promise<void> {
	const existingRoles = await db
		.select({ id: discordRoles.id, discordRoleId: discordRoles.discordRoleId })
		.from(discordRoles)
		.where(eq(discordRoles.guildId, guildId))

	const existingMap = new Map(existingRoles.map((r) => [r.discordRoleId, r.id]))
	const currentIds = new Set(roles.map((r) => r.id))

	for (const role of roles) {
		if (role.managed) continue

		if (existingMap.has(role.id)) {
			await db
				.update(discordRoles)
				.set({
					name: role.name,
					color: role.colors.primaryColor,
					position: role.position,
					updatedAt: new Date(),
				})
				.where(and(eq(discordRoles.guildId, guildId), eq(discordRoles.discordRoleId, role.id)))
		} else {
			await db.insert(discordRoles).values({
				guildId,
				discordRoleId: role.id,
				name: role.name,
				color: role.colors.primaryColor,
				position: role.position,
			})
		}
	}

	for (const [discordRoleId, dbId] of existingMap) {
		if (!currentIds.has(discordRoleId)) {
			await db.delete(discordRoles).where(eq(discordRoles.id, dbId))
		}
	}
}

export async function syncGuildMembers(
	db: Database,
	guildId: number,
	members: DiscordMember[],
): Promise<void> {
	const discordIds = members.map((m) => m.user.id)
	if (discordIds.length === 0) return

	const knownUsers = await db
		.select({ id: users.id, discordId: users.discordId })
		.from(users)
		.where(inArray(users.discordId, discordIds))

	for (const user of knownUsers) {
		const existing = await db
			.select({ id: guildMembers.id })
			.from(guildMembers)
			.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, user.id)))
			.limit(1)

		if (existing.length === 0) {
			await db.insert(guildMembers).values({ guildId, userId: user.id })
		}
	}
}

export async function upsertGuildMember(
	db: Database,
	guildId: number,
	discordId: string,
): Promise<void> {
	const user = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.discordId, discordId))
		.limit(1)

	const first = user[0]
	if (!first) return

	const existing = await db
		.select({ id: guildMembers.id })
		.from(guildMembers)
		.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, first.id)))
		.limit(1)

	if (existing.length === 0) {
		await db.insert(guildMembers).values({ guildId, userId: first.id })
	}
}

export async function removeGuildMember(
	db: Database,
	guildId: number,
	discordId: string,
): Promise<void> {
	const user = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.discordId, discordId))
		.limit(1)

	const first = user[0]
	if (!first) return

	await db
		.delete(guildMembers)
		.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, first.id)))
}

export async function resolveGuildId(db: Database, discordGuildId: string): Promise<number | null> {
	const result = await db
		.select({ id: guilds.id })
		.from(guilds)
		.where(eq(guilds.discordId, discordGuildId))
		.limit(1)

	return result[0]?.id ?? null
}
