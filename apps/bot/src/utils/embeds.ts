import type { APIEmbed, APIEmbedField } from 'discord.js'
import type { TicketPriority } from '@ticketbot/shared'

const STATUS_COLORS: Record<string, number> = {
	open: 0x22c55e,
	pending: 0xf59e0b,
	waiting_user: 0x3b82f6,
	waiting_staff: 0x8b5cf6,
	escalated: 0xef4444,
	resolved: 0x06b6d4,
	closed: 0x6b7280,
	archived: 0x374151,
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
	low: 'Low',
	normal: 'Normal',
	high: 'High',
	urgent: 'Urgent',
}

export { PRIORITY_LABELS }

export function ticketWelcomeEmbed(opts: {
	ticketNumber: string
	categoryName: string
	creatorTag: string
	formResponses?: Array<{ label: string; value: string }>
}): APIEmbed {
	const fields: APIEmbedField[] = []

	if (opts.formResponses && opts.formResponses.length > 0) {
		for (const response of opts.formResponses) {
			fields.push({ name: response.label, value: response.value || 'N/A' })
		}
	}

	return {
		title: `Ticket ${opts.ticketNumber}`,
		description: `Category: **${opts.categoryName}**\nCreated by: ${opts.creatorTag}`,
		color: STATUS_COLORS.open,
		timestamp: new Date().toISOString(),
		...(fields.length > 0 ? { fields } : {}),
	}
}

export function ticketClosedEmbed(opts: {
	ticketNumber: string
	closerTag: string
	reason?: string
}): APIEmbed {
	return {
		title: `Ticket ${opts.ticketNumber} — Closed`,
		description: `Closed by: ${opts.closerTag}${opts.reason ? `\nReason: ${opts.reason}` : ''}`,
		color: STATUS_COLORS.closed,
		timestamp: new Date().toISOString(),
	}
}

export function ticketReopenedEmbed(opts: {
	ticketNumber: string
	reopenerTag: string
}): APIEmbed {
	return {
		title: `Ticket ${opts.ticketNumber} — Reopened`,
		description: `Reopened by: ${opts.reopenerTag}`,
		color: STATUS_COLORS.open,
		timestamp: new Date().toISOString(),
	}
}

export function statusChangeEmbed(opts: {
	field: string
	oldValue: string
	newValue: string
	changerTag: string
}): APIEmbed {
	const color = STATUS_COLORS[opts.newValue] ?? 0x6b7280
	return {
		description: `**${opts.field}** changed: ${opts.oldValue} → **${opts.newValue}** by ${opts.changerTag}`,
		color,
		timestamp: new Date().toISOString(),
	}
}

export function claimEmbed(userTag: string, action: 'claimed' | 'unclaimed'): APIEmbed {
	return {
		description: `${userTag} ${action} this ticket`,
		color: action === 'claimed' ? 0x22c55e : 0xf59e0b,
		timestamp: new Date().toISOString(),
	}
}

export function transferEmbed(fromTag: string, toTag: string): APIEmbed {
	return {
		description: `${fromTag} transferred this ticket to ${toTag}`,
		color: 0x3b82f6,
		timestamp: new Date().toISOString(),
	}
}

export function userAddRemoveEmbed(
	actorTag: string,
	targetTag: string,
	action: 'added' | 'removed',
): APIEmbed {
	return {
		description: `${actorTag} ${action} ${targetTag} ${action === 'added' ? 'to' : 'from'} the ticket`,
		color: action === 'added' ? 0x22c55e : 0xef4444,
		timestamp: new Date().toISOString(),
	}
}

export function transcriptSummaryEmbed(opts: {
	ticketNumber: string
	messageCount: number
	participantCount: number
	durationSeconds: number
	categoryName: string
}): APIEmbed {
	const hours = Math.floor(opts.durationSeconds / 3600)
	const minutes = Math.floor((opts.durationSeconds % 3600) / 60)
	const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

	return {
		title: `Transcript — ${opts.ticketNumber}`,
		fields: [
			{ name: 'Category', value: opts.categoryName, inline: true },
			{ name: 'Messages', value: String(opts.messageCount), inline: true },
			{ name: 'Participants', value: String(opts.participantCount), inline: true },
			{ name: 'Duration', value: duration, inline: true },
		],
		color: 0x6b7280,
		timestamp: new Date().toISOString(),
	}
}
