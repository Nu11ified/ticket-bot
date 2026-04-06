import type { Database } from '@ticketbot/db'
import { type ChatInputCommandInteraction, type GuildMember, MessageFlags } from 'discord.js'
import { writeAuditLog } from '../services/audit.js'
import {
	getStaffRoleDiscordIds,
	resolveTicketByChannelId,
	updateTicketStatus,
} from '../services/ticket.js'
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

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const member = interaction.member
	const isStaff =
		member && 'roles' in member
			? staffRoleIds.some((roleId) => (member as GuildMember).roles.cache.has(roleId))
			: false

	if (!isStaff) {
		await interaction.reply({
			content: 'You do not have staff access to this ticket.',
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
