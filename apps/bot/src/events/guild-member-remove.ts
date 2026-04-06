import type { Database } from '@ticketbot/db'
import type { GuildMember, PartialGuildMember } from 'discord.js'
import { removeGuildMember, resolveGuildId } from '../services/guild.js'

export async function handleGuildMemberRemove(
	db: Database,
	member: GuildMember | PartialGuildMember,
): Promise<void> {
	const guildId = await resolveGuildId(db, member.guild.id)
	if (!guildId) return

	await removeGuildMember(db, guildId, member.user.id)
}
