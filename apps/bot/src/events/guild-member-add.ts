import type { GuildMember } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { resolveGuildId, upsertGuildMember } from '../services/guild.js'

export async function handleGuildMemberAdd(db: Database, member: GuildMember): Promise<void> {
	const guildId = await resolveGuildId(db, member.guild.id)
	if (!guildId) return

	await upsertGuildMember(db, guildId, member.user.id)
}
