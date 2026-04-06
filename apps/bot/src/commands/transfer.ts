import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { transferTicket, ensureUser, resolveTicketByChannelId, getStaffRoleDiscordIds } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { transferEmbed } from '../utils/embeds.js'

export async function handleTransfer(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'Cannot transfer a closed ticket.', flags: MessageFlags.Ephemeral })
		return
	}

	const targetUser = interaction.options.getUser('user', true)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const targetMember = await interaction.guild?.members.fetch(targetUser.id)
	const isTargetStaff = targetMember
		? staffRoleIds.some((roleId) => targetMember.roles.cache.has(roleId))
		: false

	if (!isTargetStaff) {
		await interaction.reply({
			content: 'Target user does not have staff access to this category.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const newAssigneeId = await ensureUser(
		db,
		targetUser.id,
		targetUser.username,
		targetUser.displayName,
		targetUser.avatarURL() ?? undefined,
	)

	const oldAssigneeId = ticket.assignedToId
	await transferTicket(db, ticket.ticketId, newAssigneeId)

	const embed = transferEmbed(interaction.user.toString(), targetUser.toString())
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.reassigned',
		metadata: { fromId: oldAssigneeId, toId: newAssigneeId },
	})
}
