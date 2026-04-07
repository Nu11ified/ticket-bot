import type { Database } from '@ticketbot/db'
import { guildMembers, guildSettings, guilds } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listUserGuilds(db: Database, userId: string) {
	const rows = await db
		.select({
			id: guilds.id,
			discordId: guilds.discordId,
			name: guilds.name,
			iconUrl: guilds.iconUrl,
			planTier: guilds.planTier,
		})
		.from(guildMembers)
		.innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
		.where(eq(guildMembers.userId, userId))

	return rows
}

export async function getGuildDetails(db: Database, guildId: number, userId: string) {
	const member = await db
		.select({ id: guildMembers.id })
		.from(guildMembers)
		.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
		.limit(1)

	if (!member[0]) {
		throw new ApiError(403, 'NOT_A_MEMBER', 'You are not a member of this guild')
	}

	const guildRows = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1)

	const guild = guildRows[0]
	if (!guild) {
		throw new ApiError(404, 'GUILD_NOT_FOUND', 'Guild not found')
	}

	const settingsRows = await db
		.select()
		.from(guildSettings)
		.where(eq(guildSettings.guildId, guildId))
		.limit(1)

	return { ...guild, settings: settingsRows[0] ?? null }
}

export async function updateGuildSettings(
	db: Database,
	guildId: number,
	updates: {
		logChannelId?: string | null
		transcriptChannelId?: string | null
		locale?: string
		timezone?: string
		autoCloseHours?: number | null
		transcriptRetentionDays?: number
		ticketCooldownSeconds?: number
	},
) {
	const rows = await db
		.update(guildSettings)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(guildSettings.guildId, guildId))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'SETTINGS_NOT_FOUND', 'Guild settings not found')
	}

	return row
}
