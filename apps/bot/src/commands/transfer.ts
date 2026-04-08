import type { Database } from '@ticketbot/db'
import { type ChatInputCommandInteraction, type GuildMember, MessageFlags } from 'discord.js'
import { writeAuditLog } from '../services/audit.js'
import {
	ensureUser,
	getStaffRoleDiscordIds,
	resolveTicketByChannelId,
	transferTicket,
} from '../services/ticket.js'
import { transferEmbed } from '../utils/embeds.js'

export async function handleTransfer(
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
			content: 'Cannot transfer a closed ticket.',
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

	const targetUser = interaction.options.getUser('user', true)
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
