import type { GuildMember, PartialGuildMember } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { resolveGuildId, removeGuildMember } from '../services/guild.js'

export async function handleGuildMemberRemove(
	db: Database,
	member: GuildMember | PartialGuildMember,
): Promise<void> {
	const guildId = await resolveGuildId(db, member.guild.id)
	if (!guildId) return

	await removeGuildMember(db, guildId, member.user.id)
}
