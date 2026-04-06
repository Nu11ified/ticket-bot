import type { Database } from '@ticketbot/db'
import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { writeAuditLog } from '../services/audit.js'
import { resolveTicketByChannelId, updateTicketPriority } from '../services/ticket.js'
import { statusChangeEmbed } from '../utils/embeds.js'

export async function handlePriority(
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
			content: 'Cannot change priority of a closed ticket.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const newPriority = interaction.options.getString('level', true)
	const oldPriority = ticket.priority

	await updateTicketPriority(db, ticket.ticketId, newPriority)

	const embed = statusChangeEmbed({
		field: 'Priority',
		oldValue: oldPriority,
		newValue: newPriority,
		changerTag: interaction.user.toString(),
	})
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.status_changed',
		metadata: { field: 'priority', old: oldPriority, new: newPriority },
	})
}
