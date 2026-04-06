import { MessageFlags, type ChatInputCommandInteraction, type TextChannel } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { reopenTicket, getStaffRoleDiscordIds, resolveTicketByChannelId } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { ticketReopenedEmbed } from '../utils/embeds.js'
import { unlockTicketChannel } from '../utils/permissions.js'

export async function handleReopen(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral })
		return
	}

	if (ticket.status !== 'closed') {
		await interaction.reply({ content: 'This ticket is not closed.', flags: MessageFlags.Ephemeral })
		return
	}

	await interaction.deferReply()

	await reopenTicket(db, ticket.ticketId)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const channel = interaction.channel as TextChannel
	await unlockTicketChannel(channel, ticket.creatorDiscordId, staffRoleIds)

	const embed = ticketReopenedEmbed({
		ticketNumber: ticket.ticketNumber,
		reopenerTag: interaction.user.toString(),
	})
	await interaction.editReply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.reopened',
	})
}
