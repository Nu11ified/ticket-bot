import type { Database } from '@ticketbot/db'
import { discordRoles } from '@ticketbot/db'
import type { Role } from 'discord.js'
import { resolveGuildId } from '../services/guild.js'

export async function handleRoleCreate(db: Database, role: Role): Promise<void> {
	if (role.managed) return

	const guildId = await resolveGuildId(db, role.guild.id)
	if (!guildId) return

	await db.insert(discordRoles).values({
		guildId,
		discordRoleId: role.id,
		name: role.name,
		color: role.colors.primaryColor,
		position: role.position,
	})
}
