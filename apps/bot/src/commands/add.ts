import { MessageFlags, type ChatInputCommandInteraction, type TextChannel } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { resolveTicketByChannelId } from '../services/ticket.js'
import { userAddRemoveEmbed } from '../utils/embeds.js'

export async function handleAdd(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral })
		return
	}

	const targetUser = interaction.options.getUser('user', true)
	const channel = interaction.channel as TextChannel

	await channel.permissionOverwrites.edit(targetUser.id, {
		ViewChannel: true,
		SendMessages: true,
		ReadMessageHistory: true,
		AttachFiles: true,
	})

	const embed = userAddRemoveEmbed(interaction.user.toString(), targetUser.toString(), 'added')
	await interaction.reply({ embeds: [embed] })
}
