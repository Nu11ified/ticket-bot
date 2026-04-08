import type { Database } from '@ticketbot/db'
import { guildSettings, guilds } from '@ticketbot/db'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { ApiError } from '../../lib/api-error.js'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'

export function publicGuildRoutes(db: Database) {
	return new Elysia({ prefix: '/guild' }).get(
		'/',
		// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
		async ({ apiKey }: any) => {
			const guildRows = await db
				.select({
					id: guilds.id,
					discordId: guilds.discordId,
					name: guilds.name,
					iconUrl: guilds.iconUrl,
					planTier: guilds.planTier,
				})
				.from(guilds)
				.where(eq(guilds.id, apiKey.guildId))
				.limit(1)

			const guild = guildRows[0]
			if (!guild) throw new ApiError(404, 'GUILD_NOT_FOUND', 'Guild not found')

			const settingsRows = await db
				.select({
					locale: guildSettings.locale,
					timezone: guildSettings.timezone,
					autoCloseHours: guildSettings.autoCloseHours,
				})
				.from(guildSettings)
				.where(eq(guildSettings.guildId, apiKey.guildId))
				.limit(1)

			return { data: { ...guild, settings: settingsRows[0] ?? null } }
		},
		{ beforeHandle: checkKeyPermission('guild.read') },
	)
}
