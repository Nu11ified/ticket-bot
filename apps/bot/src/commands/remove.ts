import type { Database } from '@ticketbot/db'
import { type ChatInputCommandInteraction, MessageFlags, type TextChannel } from 'discord.js'
import { resolveTicketByChannelId } from '../services/ticket.js'
import { userAddRemoveEmbed } from '../utils/embeds.js'

export async function handleRemove(
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

	const targetUser = interaction.options.getUser('user', true)

	if (targetUser.id === ticket.creatorDiscordId) {
		await interaction.reply({
			content: 'Cannot remove the ticket creator.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const channel = interaction.channel as TextChannel
	await channel.permissionOverwrites.delete(targetUser.id)

	const embed = userAddRemoveEmbed(interaction.user.toString(), targetUser.toString(), 'removed')
	await interaction.reply({ embeds: [embed] })
}
