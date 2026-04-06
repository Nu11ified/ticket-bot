import type { Database } from '@ticketbot/db'
import type { Guild as DiscordGuild } from 'discord.js'
import { syncGuildMembers, syncGuildRoles, upsertGuild } from '../services/guild.js'

export async function handleGuildCreate(db: Database, guild: DiscordGuild): Promise<void> {
	console.log(`Joined guild: ${guild.name} (${guild.id})`)

	const { guildId } = await upsertGuild(db, guild)

	const roles = [...guild.roles.cache.values()]
	await syncGuildRoles(db, guildId, roles)

	try {
		const members = await guild.members.fetch()
		await syncGuildMembers(db, guildId, [...members.values()])
	} catch (err) {
		console.error(`Failed to fetch members for guild ${guild.id}:`, err)
	}
}
