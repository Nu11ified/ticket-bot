import type { Database } from '@ticketbot/db'
import { discordRoles } from '@ticketbot/db'
import type { Role } from 'discord.js'
import { and, eq } from 'drizzle-orm'
import { resolveGuildId } from '../services/guild.js'

export async function handleRoleDelete(db: Database, role: Role): Promise<void> {
	const guildId = await resolveGuildId(db, role.guild.id)
	if (!guildId) return

	await db
		.delete(discordRoles)
		.where(and(eq(discordRoles.guildId, guildId), eq(discordRoles.discordRoleId, role.id)))
}
