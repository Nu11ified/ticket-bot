import type { Database } from '@ticketbot/db'
import { categories, formFields, forms, panelButtons } from '@ticketbot/db'
import {
	type APIActionRowComponent,
	type APIModalInteractionResponseCallbackData,
	type APITextInputComponent,
	type ButtonInteraction,
	ComponentType,
	MessageFlags,
	type TextChannel,
	TextInputStyle,
} from 'discord.js'
import { eq } from 'drizzle-orm'
import { writeAuditLog } from '../services/audit.js'
import { resolveGuildId } from '../services/guild.js'
import {
	checkMaxOpen,
	checkRateLimit,
	createTicket,
	ensureUser,
	getStaffRoleDiscordIds,
} from '../services/ticket.js'
import { ticketWelcomeEmbed } from '../utils/embeds.js'
import { buildTicketChannelOptions } from '../utils/permissions.js'

export async function handlePanelButton(
	db: Database,
	interaction: ButtonInteraction,
): Promise<void> {
	const buttonId = Number(interaction.customId.replace('panel_button_', ''))
	if (Number.isNaN(buttonId)) return

	const button = await db
		.select({ categoryId: panelButtons.categoryId })
		.from(panelButtons)
		.where(eq(panelButtons.id, buttonId))
		.limit(1)

	const btn = button[0]
	if (!btn) {
		await interaction.reply({
			content: 'This button is no longer active.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const category = await db
		.select({
			id: categories.id,
			name: categories.name,
			isEnabled: categories.isEnabled,
			maxOpenPerUser: categories.maxOpenPerUser,
		})
		.from(categories)
		.where(eq(categories.id, btn.categoryId))
		.limit(1)

	const cat = category[0]
	if (!cat || !cat.isEnabled) {
		await interaction.reply({
			content: 'This category is currently disabled.',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (!interaction.guild) return

	const guildId = await resolveGuildId(db, interaction.guild.id)
	if (!guildId) return

	const rateCheck = await checkRateLimit(db, guildId, interaction.user.id)
	if (!rateCheck.allowed) {
		await interaction.reply({
			content: `Please wait ${rateCheck.retryAfterSeconds} seconds before creating another ticket.`,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const userId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	const maxCheck = await checkMaxOpen(db, userId, cat.id)
	if (!maxCheck.allowed) {
		await interaction.reply({
			content: `You already have ${maxCheck.current}/${maxCheck.max} open tickets in this category.`,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const form = await db
		.select({ id: forms.id })
		.from(forms)
		.where(eq(forms.categoryId, cat.id))
		.limit(1)

	if (form[0]) {
		const fields = await db
			.select({
				id: formFields.id,
				label: formFields.label,
				fieldType: formFields.fieldType,
				placeholder: formFields.placeholder,
				isRequired: formFields.isRequired,
				minLength: formFields.minLength,
				maxLength: formFields.maxLength,
			})
			.from(formFields)
			.where(eq(formFields.formId, form[0].id))
			.orderBy(formFields.position)

		const components: APIActionRowComponent<APITextInputComponent>[] = fields
			.slice(0, 5)
			.map((field) => {
				const style =
					field.fieldType === 'textarea' ? TextInputStyle.Paragraph : TextInputStyle.Short
				const textInput: APITextInputComponent = {
					type: ComponentType.TextInput,
					custom_id: `field_${field.id}`,
					label: field.label,
					style,
					required: field.isRequired,
					...(field.placeholder ? { placeholder: field.placeholder } : {}),
					...(field.minLength ? { min_length: field.minLength } : {}),
					...(field.maxLength ? { max_length: field.maxLength } : {}),
				}
				return {
					type: ComponentType.ActionRow as const,
					components: [textInput],
				}
			})

		const modal: APIModalInteractionResponseCallbackData = {
			custom_id: `ticket_form_${cat.id}`,
			title: `New Ticket — ${cat.name}`.slice(0, 45),
			components,
		}

		await interaction.showModal(modal)
		return
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral })

	const staffRoleIds = await getStaffRoleDiscordIds(db, cat.id)
	const channelResult = buildTicketChannelOptions({
		guild: interaction.guild,
		channelName: `ticket-${interaction.user.username}`,
		creatorId: interaction.user.id,
		staffRoleIds,
	})

	let channel: TextChannel
	if (channelResult.mode === 'category') {
		channel = (await channelResult.category.children.create(channelResult.options)) as TextChannel
	} else {
		channel = (await interaction.guild.channels.create(channelResult.options)) as TextChannel
	}

	const { ticketId, ticketNumber } = await createTicket(db, {
		guildId,
		categoryId: cat.id,
		channelId: channel.id,
		creatorId: userId,
		creatorDiscordId: interaction.user.id,
	})

	const embed = ticketWelcomeEmbed({
		ticketNumber,
		categoryName: cat.name,
		creatorTag: interaction.user.toString(),
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
