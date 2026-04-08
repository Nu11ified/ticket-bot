import { REST } from '@discordjs/rest'
import type { Database } from '@ticketbot/db'
import { panelButtons, panels } from '@ticketbot/db'
import { Routes } from 'discord-api-types/v10'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listPanels(db: Database, guildId: number) {
	const rows = await db
		.select()
		.from(panels)
		.where(eq(panels.guildId, guildId))
		.orderBy(panels.createdAt)

	return rows
}

export async function getPanel(db: Database, guildId: number, panelId: number) {
	const rows = await db
		.select()
		.from(panels)
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.limit(1)

	const panel = rows[0]
	if (!panel) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}

	const buttons = await db
		.select()
		.from(panelButtons)
		.where(eq(panelButtons.panelId, panelId))
		.orderBy(panelButtons.position)

	return { ...panel, buttons }
}

export async function createPanel(
	db: Database,
	guildId: number,
	data: {
		name: string
		embedTitle?: string
		embedDescription?: string
		embedColor?: number
		embedThumbnailUrl?: string
		embedFooterText?: string
	},
) {
	const rows = await db
		.insert(panels)
		.values({ guildId, ...data })
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(500, 'INSERT_FAILED', 'Failed to create panel')
	}
	return row
}

export async function updatePanel(
	db: Database,
	guildId: number,
	panelId: number,
	data: {
		name?: string
		embedTitle?: string | null
		embedDescription?: string | null
		embedColor?: number | null
		embedThumbnailUrl?: string | null
		embedFooterText?: string | null
		channelId?: string | null
	},
) {
	const rows = await db
		.update(panels)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}

	return row
}

export async function deletePanel(db: Database, guildId: number, panelId: number) {
	const rows = await db
		.delete(panels)
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.returning({ id: panels.id })

	if (!rows[0]) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}
}

export async function deployPanel(db: Database, guildId: number, panelId: number) {
	const rows = await db
		.select()
		.from(panels)
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.limit(1)

	const panel = rows[0]
	if (!panel) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}

	if (!panel.channelId) {
		throw new ApiError(400, 'NO_CHANNEL', 'Panel has no target channel set')
	}

	const buttons = await db
		.select()
		.from(panelButtons)
		.where(eq(panelButtons.panelId, panelId))
		.orderBy(panelButtons.position)

	if (buttons.length === 0) {
		throw new ApiError(400, 'NO_BUTTONS', 'Panel has no buttons configured')
	}

	const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN ?? '')

	const embed = {
		title: panel.embedTitle ?? panel.name,
		description: panel.embedDescription ?? undefined,
		color: panel.embedColor ?? undefined,
		thumbnail: panel.embedThumbnailUrl ? { url: panel.embedThumbnailUrl } : undefined,
		footer: panel.embedFooterText ? { text: panel.embedFooterText } : undefined,
	}

	const components = [
		{
			type: 1, // ActionRow
			components: buttons.map((btn) => ({
				type: 2, // Button
				style:
					btn.style === 'primary'
						? 1
						: btn.style === 'secondary'
							? 2
							: btn.style === 'success'
								? 3
								: 4,
				label: btn.label,
				emoji: btn.emoji ? { name: btn.emoji } : undefined,
				custom_id: `panel_btn_${btn.categoryId}`,
			})),
		},
	]

	const message = (await rest.post(Routes.channelMessages(panel.channelId), {
		body: { embeds: [embed], components },
	})) as { id: string }

	// Update panel with messageId and mark as published
	await db
		.update(panels)
		.set({ messageId: message.id, isPublished: true, updatedAt: new Date() })
		.where(eq(panels.id, panelId))

	return { messageId: message.id }
}
