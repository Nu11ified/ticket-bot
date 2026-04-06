import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { accounts, discordRoles, guildMembers, guilds } from '@ticketbot/db'

interface DiscordPartialGuild {
	id: string
	name: string
	icon: string | null
	owner: boolean
	permissions: string
}

export async function syncUserGuilds(db: Database, userId: string): Promise<void> {
	const account = await db
		.select({ accessToken: accounts.accessToken })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'discord')))
		.limit(1)

	const firstAccount = account[0]
	if (!firstAccount?.accessToken) return

	const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
		headers: { Authorization: `Bearer ${firstAccount.accessToken}` },
	})

	if (!response.ok) return

	const discordGuilds: DiscordPartialGuild[] = await response.json()
	const discordGuildIds = discordGuilds.map((g) => g.id)

	if (discordGuildIds.length === 0) return

	const botGuilds = await db
		.select({ id: guilds.id, discordId: guilds.discordId })
		.from(guilds)
		.where(inArray(guilds.discordId, discordGuildIds))

	if (botGuilds.length === 0) return

	const botGuildIds = botGuilds.map((g) => g.id)

	for (const guild of botGuilds) {
		const existing = await db
			.select({ id: guildMembers.id })
			.from(guildMembers)
			.where(and(eq(guildMembers.guildId, guild.id), eq(guildMembers.userId, userId)))
			.limit(1)

		if (existing.length === 0) {
			await db.insert(guildMembers).values({ guildId: guild.id, userId })
		}
	}

	const currentMemberships = await db
		.select({ id: guildMembers.id, guildId: guildMembers.guildId })
		.from(guildMembers)
		.where(eq(guildMembers.userId, userId))

	for (const membership of currentMemberships) {
		if (!botGuildIds.includes(membership.guildId)) {
			await db.delete(guildMembers).where(eq(guildMembers.id, membership.id))
		}
	}
}

export async function syncGuildRoles(
	db: Database,
	guildId: number,
	discordGuildId: string,
): Promise<void> {
	const botToken = process.env.DISCORD_TOKEN
	if (!botToken) return

	const response = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/roles`, {
		headers: { Authorization: `Bot ${botToken}` },
	})

	if (!response.ok) return

	const discordRolesData: Array<{
		id: string
		name: string
		color: number
		position: number
	}> = await response.json()

	const existingRoles = await db
		.select({ id: discordRoles.id, discordRoleId: discordRoles.discordRoleId })
		.from(discordRoles)
		.where(eq(discordRoles.guildId, guildId))

	const existingRoleDiscordIds = new Set(existingRoles.map((r) => r.discordRoleId))
	const currentDiscordRoleIds = new Set(discordRolesData.map((r) => r.id))

	for (const role of discordRolesData) {
		if (existingRoleDiscordIds.has(role.id)) {
			await db
				.update(discordRoles)
				.set({
					name: role.name,
					color: role.color,
					position: role.position,
					updatedAt: new Date(),
				})
				.where(and(eq(discordRoles.guildId, guildId), eq(discordRoles.discordRoleId, role.id)))
		} else {
			await db.insert(discordRoles).values({
				guildId,
				discordRoleId: role.id,
				name: role.name,
				color: role.color,
				position: role.position,
			})
		}
	}

	for (const existing of existingRoles) {
		if (!currentDiscordRoleIds.has(existing.discordRoleId)) {
			await db.delete(discordRoles).where(eq(discordRoles.id, existing.id))
		}
	}
}
