import { MessageFlags, type ChatInputCommandInteraction, type TextChannel } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { closeTicket, ensureUser, getStaffRoleDiscordIds, resolveTicketByChannelId } from '../services/ticket.js'
import { buildAndStoreTranscript } from '../services/transcript.js'
import { writeAuditLog } from '../services/audit.js'
import { ticketClosedEmbed, transcriptSummaryEmbed } from '../utils/embeds.js'
import { lockTicketChannel } from '../utils/permissions.js'
import { eq } from 'drizzle-orm'
import { categories, guildSettings } from '@ticketbot/db'

export async function handleClose(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral })
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
	await buildAndStoreTranscript(db, ticket.ticketId, ticket.guildId)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
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
					messageCount: 0,
					participantCount: 0,
					durationSeconds: 0,
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
