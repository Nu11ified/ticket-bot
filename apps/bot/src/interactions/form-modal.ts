import { MessageFlags, type ModalSubmitInteraction, type TextChannel } from 'discord.js'
import { eq } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { categories, formFields, forms } from '@ticketbot/db'
import {
	createTicket,
	ensureUser,
	getStaffRoleDiscordIds,
} from '../services/ticket.js'
import { resolveGuildId } from '../services/guild.js'
import { writeAuditLog } from '../services/audit.js'
import { ticketWelcomeEmbed } from '../utils/embeds.js'
import { buildTicketChannelOptions } from '../utils/permissions.js'

export async function handleFormModal(
	db: Database,
	interaction: ModalSubmitInteraction,
): Promise<void> {
	const categoryId = Number(interaction.customId.replace('ticket_form_', ''))
	if (Number.isNaN(categoryId)) return

	if (!interaction.guild) return

	await interaction.deferReply({ flags: MessageFlags.Ephemeral })

	const guildId = await resolveGuildId(db, interaction.guild.id)
	if (!guildId) return

	const category = await db
		.select({ id: categories.id, name: categories.name })
		.from(categories)
		.where(eq(categories.id, categoryId))
		.limit(1)

	const cat = category[0]
	if (!cat) return

	const userId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	const form = await db
		.select({ id: forms.id })
		.from(forms)
		.where(eq(forms.categoryId, cat.id))
		.limit(1)

	const formResponses: Array<{ fieldId: number; value: string; label: string }> = []

	if (form[0]) {
		const fields = await db
			.select({ id: formFields.id, label: formFields.label })
			.from(formFields)
			.where(eq(formFields.formId, form[0].id))
			.orderBy(formFields.position)

		for (const field of fields) {
			const value = interaction.components.getTextInputValue(`field_${field.id}`)
			formResponses.push({ fieldId: field.id, value, label: field.label })
		}
	}

	const staffRoleIds = await getStaffRoleDiscordIds(db, cat.id)
	const channelResult = buildTicketChannelOptions({
		guild: interaction.guild,
		channelName: `ticket-${interaction.user.username}`,
		creatorId: interaction.user.id,
		staffRoleIds,
	})

	let channel: TextChannel
	if (channelResult.mode === 'category') {
		channel = await channelResult.category.children.create(channelResult.options) as TextChannel
	} else {
		channel = await interaction.guild.channels.create(channelResult.options) as TextChannel
	}

	const { ticketId, ticketNumber } = await createTicket(db, {
		guildId,
		categoryId: cat.id,
		channelId: channel.id,
		creatorId: userId,
		creatorDiscordId: interaction.user.id,
		formResponses: formResponses.map((r) => ({ fieldId: r.fieldId, value: r.value })),
	})

	const embed = ticketWelcomeEmbed({
		ticketNumber,
		categoryName: cat.name,
		creatorTag: interaction.user.toString(),
		formResponses: formResponses.map((r) => ({ label: r.label, value: r.value })),
	})
	await channel.send({ embeds: [embed] })

	await interaction.editReply({ content: `Ticket created: ${channel.toString()}` })

	await writeAuditLog(db, {
		guildId,
		ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.created',
		metadata: { categoryId: cat.id, ticketNumber },
	})
}
