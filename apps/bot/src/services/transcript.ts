import type { Database } from '@ticketbot/db'
import {
	categories,
	guildSettings,
	ticketMessages,
	tickets,
	transcripts,
	users,
} from '@ticketbot/db'
import type { Client } from 'discord.js'
import { eq, lt } from 'drizzle-orm'

interface TranscriptMessage {
	userId: string
	discordId: string
	username: string
	content: string
	timestamp: string
	isStaff: boolean
	attachments: unknown[]
}

interface TranscriptParticipant {
	userId: string
	discordId: string
	username: string
	messageCount: number
	isStaff: boolean
}

export async function buildAndStoreTranscript(
	db: Database,
	ticketId: number,
	guildId: number,
): Promise<number> {
	const messages = await db
		.select({
			userId: ticketMessages.userId,
			content: ticketMessages.content,
			isStaff: ticketMessages.isStaff,
			attachments: ticketMessages.attachments,
			createdAt: ticketMessages.createdAt,
		})
		.from(ticketMessages)
		.where(eq(ticketMessages.ticketId, ticketId))
		.orderBy(ticketMessages.createdAt)

	const userRows = await db
		.select({ id: users.id, discordId: users.discordId, username: users.username })
		.from(users)

	const userMap = new Map(userRows.map((u) => [u.id, u]))

	const transcriptMessages: TranscriptMessage[] = messages.map((m) => {
		const user = userMap.get(m.userId)
		return {
			userId: m.userId,
			discordId: user?.discordId ?? '',
			username: user?.username ?? 'Unknown',
			content: m.content,
			timestamp: m.createdAt.toISOString(),
			isStaff: m.isStaff,
			attachments: m.attachments as unknown[],
		}
	})

	const participantMap = new Map<string, { count: number; isStaff: boolean }>()
	for (const msg of messages) {
		const existing = participantMap.get(msg.userId)
		if (existing) {
			existing.count++
		} else {
			participantMap.set(msg.userId, { count: 1, isStaff: msg.isStaff })
		}
	}

	const participants: TranscriptParticipant[] = [...participantMap.entries()].map(
		([userId, data]) => {
			const user = userMap.get(userId)
			return {
				userId,
				discordId: user?.discordId ?? '',
				username: user?.username ?? 'Unknown',
				messageCount: data.count,
				isStaff: data.isStaff,
			}
		},
	)

	const ticket = await db
		.select({
			createdAt: tickets.createdAt,
			priority: tickets.priority,
			categoryId: tickets.categoryId,
		})
		.from(tickets)
		.where(eq(tickets.id, ticketId))
		.limit(1)

	const ticketRow = ticket[0]
	const durationSeconds = ticketRow
		? Math.floor((Date.now() - ticketRow.createdAt.getTime()) / 1000)
		: 0

	const category = ticketRow
		? await db
				.select({ name: categories.name })
				.from(categories)
				.where(eq(categories.id, ticketRow.categoryId))
				.limit(1)
		: []

	const settings = await db
		.select({ transcriptRetentionDays: guildSettings.transcriptRetentionDays })
		.from(guildSettings)
		.where(eq(guildSettings.guildId, guildId))
		.limit(1)

	const retentionDays = settings[0]?.transcriptRetentionDays ?? 5
	const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)

	const metadata = {
		duration: durationSeconds,
		messageCount: messages.length,
		category: category[0]?.name ?? 'Unknown',
		priority: ticketRow?.priority ?? 'normal',
	}

	const inserted = await db
		.insert(transcripts)
		.values({
			ticketId,
			guildId,
			messages: transcriptMessages,
			messageCount: messages.length,
			participants,
			metadata,
			expiresAt,
		})
		.returning({ id: transcripts.id })

	const transcript = inserted[0]
	if (!transcript) throw new Error('Failed to insert transcript')
	return transcript.id
}

export async function runCleanupJob(
	db: Database,
	client: Client,
): Promise<{ purged: number; channelsDeleted: number }> {
	const expired = await db
		.select({
			id: transcripts.id,
			ticketId: transcripts.ticketId,
		})
		.from(transcripts)
		.where(lt(transcripts.expiresAt, new Date()))

	let purged = 0
	let channelsDeleted = 0

	for (const transcript of expired) {
		const ticket = await db
			.select({ channelId: tickets.channelId, guildId: tickets.guildId })
			.from(tickets)
			.where(eq(tickets.id, transcript.ticketId))
			.limit(1)

		const ticketRow = ticket[0]
		if (ticketRow?.channelId) {
			try {
				const channel = await client.channels.fetch(ticketRow.channelId)
				if (channel) {
					await channel.delete()
					channelsDeleted++
				}
			} catch {
				// Channel already deleted or bot lacks permissions
			}
		}

		await db.delete(ticketMessages).where(eq(ticketMessages.ticketId, transcript.ticketId))
		await db.delete(transcripts).where(eq(transcripts.id, transcript.id))
		purged++
	}

	return { purged, channelsDeleted }
}
