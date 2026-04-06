import type { Database } from '@ticketbot/db'
import { categories, guildSettings } from '@ticketbot/db'
import {
	type ChatInputCommandInteraction,
	type GuildMember,
	MessageFlags,
	type TextChannel,
} from 'discord.js'
import { eq } from 'drizzle-orm'
import { writeAuditLog } from '../services/audit.js'
import {
	closeTicket,
	ensureUser,
	getStaffRoleDiscordIds,
	resolveTicketByChannelId,
} from '../services/ticket.js'
import { buildAndStoreTranscript } from '../services/transcript.js'
import { ticketClosedEmbed, transcriptSummaryEmbed } from '../utils/embeds.js'
import { lockTicketChannel } from '../utils/permissions.js'

export async function handleClose(
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
			content: 'This ticket is already closed.',
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

	if (!isStaff && interaction.user.id !== ticket.creatorDiscordId) {
		await interaction.reply({
			content: 'You do not have staff access to this ticket.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	await interaction.deferReply()

	const reason = interaction.options.getString('reason') ?? undefined
	const closerId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	await closeTicket(db, ticket.ticketId, closerId, reason)
	const transcriptResult = await buildAndStoreTranscript(db, ticket.ticketId, ticket.guildId)

	const channel = interaction.channel as TextChannel
	await lockTicketChannel(channel, ticket.creatorDiscordId, staffRoleIds)

	const embed = ticketClosedEmbed({
		ticketNumber: ticket.ticketNumber,
		closerTag: interaction.user.toString(),
		reason,
	})
	await interaction.editReply({ embeds: [embed] })

	const settings = await db
		.select({ transcriptChannelId: guildSettings.transcriptChannelId })
		.from(guildSettings)
		.where(eq(guildSettings.guildId, ticket.guildId))
		.limit(1)

	const transcriptChannelId = settings[0]?.transcriptChannelId
	if (transcriptChannelId) {
		try {
			const transcriptChannel = await interaction.guild?.channels.fetch(transcriptChannelId)
			if (transcriptChannel?.isTextBased()) {
				const category = await db
					.select({ name: categories.name })
					.from(categories)
					.where(eq(categories.id, ticket.categoryId))
					.limit(1)

				const summary = transcriptSummaryEmbed({
					ticketNumber: ticket.ticketNumber,
					messageCount: transcriptResult.messageCount,
					participantCount: transcriptResult.participantCount,
					durationSeconds: transcriptResult.durationSeconds,
					categoryName: category[0]?.name ?? 'Unknown',
				})
				await transcriptChannel.send({ embeds: [summary] })
			}
		} catch {
			// Transcript channel unavailable
		}
	}

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.closed',
		metadata: { reason, closedById: closerId },
	})
}
