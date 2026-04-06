import type { Database } from '@ticketbot/db'
import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { writeAuditLog } from '../services/audit.js'
import { claimTicket, ensureUser, resolveTicketByChannelId } from '../services/ticket.js'
import { claimEmbed } from '../utils/embeds.js'

export async function handleClaim(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({
			content: 'This is not a ticket channel.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({
			content: 'Cannot claim a closed ticket.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const userId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	await claimTicket(db, ticket.ticketId, userId)

	const embed = claimEmbed(interaction.user.toString(), 'claimed')
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.claimed',
	})
}
