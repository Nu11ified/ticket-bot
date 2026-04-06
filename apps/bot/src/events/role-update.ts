import { and, eq } from 'drizzle-orm'
import type { Role } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { discordRoles } from '@ticketbot/db'
import { resolveGuildId } from '../services/guild.js'

export async function handleRoleUpdate(db: Database, _oldRole: Role, newRole: Role): Promise<void> {
	if (newRole.managed) return

	const guildId = await resolveGuildId(db, newRole.guild.id)
	if (!guildId) return

	await db
		.update(discordRoles)
		.set({
			name: newRole.name,
			color: newRole.colors.primaryColor,
			position: newRole.position,
			updatedAt: new Date(),
		})
		.where(and(eq(discordRoles.guildId, guildId), eq(discordRoles.discordRoleId, newRole.id)))
}
