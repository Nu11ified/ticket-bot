import type { Database } from '@ticketbot/db'
import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { writeAuditLog } from '../services/audit.js'
import { resolveTicketByChannelId, updateTicketStatus } from '../services/ticket.js'
import { statusChangeEmbed } from '../utils/embeds.js'

export async function handleStatus(
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
			content: 'Cannot change status of a closed ticket. Use /reopen first.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const newStatus = interaction.options.getString('status', true)
	const oldStatus = ticket.status

	if (newStatus === oldStatus) {
		await interaction.reply({
			content: `Ticket is already ${newStatus}.`,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	await updateTicketStatus(db, ticket.ticketId, newStatus)

	const embed = statusChangeEmbed({
		field: 'Status',
		oldValue: oldStatus,
		newValue: newStatus,
		changerTag: interaction.user.toString(),
	})
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.status_changed',
		metadata: { field: 'status', old: oldStatus, new: newStatus },
	})
}
