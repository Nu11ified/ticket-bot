import type { Database } from '@ticketbot/db'
import {
	categories,
	categoryRoleAccess,
	discordRoles,
	guildSettings,
	guilds,
	rateLimits,
	ticketFormResponses,
	ticketMessages,
	tickets,
	users,
} from '@ticketbot/db'
import { and, count, eq, notInArray, sql } from 'drizzle-orm'

export interface TicketContext {
	ticketId: number
	guildId: number
	ticketNumber: string
	categoryId: number
	channelId: string
	creatorId: string
	creatorDiscordId: string
	assignedToId: string | null
	status: string
	priority: string
}

export async function resolveTicketByChannelId(
	db: Database,
	channelId: string,
): Promise<TicketContext | null> {
	const result = await db
		.select({
			ticketId: tickets.id,
			guildId: tickets.guildId,
			ticketNumber: tickets.ticketNumber,
			categoryId: tickets.categoryId,
			channelId: tickets.channelId,
			creatorId: tickets.creatorId,
			assignedToId: tickets.assignedToId,
			status: tickets.status,
			priority: tickets.priority,
		})
		.from(tickets)
		.where(eq(tickets.channelId, channelId))
		.limit(1)

	const ticket = result[0]
	if (!ticket || !ticket.channelId) return null

	const creator = await db
		.select({ discordId: users.discordId })
		.from(users)
		.where(eq(users.id, ticket.creatorId))
		.limit(1)

	return {
		...ticket,
		channelId: ticket.channelId,
		creatorDiscordId: creator[0]?.discordId ?? '',
	}
}

export async function getStaffRoleDiscordIds(db: Database, categoryId: number): Promise<string[]> {
	const access = await db
		.select({ discordRoleId: discordRoles.discordRoleId })
		.from(categoryRoleAccess)
		.innerJoin(discordRoles, eq(categoryRoleAccess.discordRoleId, discordRoles.id))
		.where(
			and(
				eq(categoryRoleAccess.categoryId, categoryId),
				eq(categoryRoleAccess.accessType, 'staff'),
			),
		)

	return access.map((r) => r.discordRoleId)
}

export async function checkRateLimit(
	db: Database,
	guildId: number,
	userDiscordId: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
	const settings = await db
		.select({ ticketCooldownSeconds: guildSettings.ticketCooldownSeconds })
		.from(guildSettings)
		.where(eq(guildSettings.guildId, guildId))
		.limit(1)

	const cooldown = settings[0]?.ticketCooldownSeconds ?? 60

	const rateLimit = await db
		.select({ lastActionAt: rateLimits.lastActionAt })
		.from(rateLimits)
		.where(
			and(
				eq(rateLimits.guildId, guildId),
				eq(rateLimits.userDiscordId, userDiscordId),
				eq(rateLimits.action, 'ticket.create'),
			),
		)
		.limit(1)

	const last = rateLimit[0]
	if (!last) return { allowed: true }

	const elapsed = (Date.now() - last.lastActionAt.getTime()) / 1000
	if (elapsed < cooldown) {
		return { allowed: false, retryAfterSeconds: Math.ceil(cooldown - elapsed) }
	}

	return { allowed: true }
}

export async function checkMaxOpen(
	db: Database,
	creatorId: string,
	categoryId: number,
): Promise<{ allowed: boolean; current: number; max: number }> {
	const category = await db
		.select({ maxOpenPerUser: categories.maxOpenPerUser })
		.from(categories)
		.where(eq(categories.id, categoryId))
		.limit(1)

	const max = category[0]?.maxOpenPerUser ?? 1

	const openCount = await db
		.select({ count: count() })
		.from(tickets)
		.where(
			and(
				eq(tickets.creatorId, creatorId),
				eq(tickets.categoryId, categoryId),
				notInArray(tickets.status, ['closed', 'archived']),
			),
		)

	const current = openCount[0]?.count ?? 0

	return { allowed: current < max, current, max }
}

export async function createTicket(
	db: Database,
	opts: {
		guildId: number
		categoryId: number
		channelId: string
		creatorId: string
		creatorDiscordId: string
		subject?: string
		formResponses?: Array<{ fieldId: number; value: string }>
	},
): Promise<{ ticketId: number; ticketNumber: string }> {
	const guild = await db
		.select({ ticketPrefix: guilds.ticketPrefix, ticketCounter: guilds.ticketCounter })
		.from(guilds)
		.where(eq(guilds.id, opts.guildId))
		.limit(1)

	const guildRow = guild[0]
	if (!guildRow) throw new Error('Guild not found')

	const newCounter = guildRow.ticketCounter + 1
	const ticketNumber = `${guildRow.ticketPrefix}-${String(newCounter).padStart(4, '0')}`

	await db
		.update(guilds)
		.set({ ticketCounter: newCounter, updatedAt: new Date() })
		.where(eq(guilds.id, opts.guildId))

	const inserted = await db
		.insert(tickets)
		.values({
			guildId: opts.guildId,
			categoryId: opts.categoryId,
			ticketNumber,
			channelId: opts.channelId,
			creatorId: opts.creatorId,
			subject: opts.subject ?? null,
			status: 'open',
			priority: 'normal',
		})
		.returning({ id: tickets.id })

	const ticket = inserted[0]
	if (!ticket) throw new Error('Failed to insert ticket')

	if (opts.formResponses && opts.formResponses.length > 0) {
		await db.insert(ticketFormResponses).values(
			opts.formResponses.map((r) => ({
				ticketId: ticket.id,
				fieldId: r.fieldId,
				value: r.value,
			})),
		)
	}

	await db
		.insert(rateLimits)
		.values({
			guildId: opts.guildId,
			userDiscordId: opts.creatorDiscordId,
			action: 'ticket.create',
			lastActionAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [rateLimits.guildId, rateLimits.userDiscordId, rateLimits.action],
			set: { lastActionAt: new Date() },
		})

	return { ticketId: ticket.id, ticketNumber }
}

export async function updateTicketStatus(
	db: Database,
	ticketId: number,
	status: string,
): Promise<void> {
	await db.update(tickets).set({ status, updatedAt: new Date() }).where(eq(tickets.id, ticketId))
}

export async function closeTicket(
	db: Database,
	ticketId: number,
	closedById: string,
	reason?: string,
): Promise<void> {
	await db
		.update(tickets)
		.set({
			status: 'closed',
			closedById,
			closedAt: new Date(),
			closeReason: reason ?? null,
			updatedAt: new Date(),
		})
		.where(eq(tickets.id, ticketId))
}

export async function reopenTicket(db: Database, ticketId: number): Promise<void> {
	await db
		.update(tickets)
		.set({
			status: 'open',
			closedById: null,
			closedAt: null,
			closeReason: null,
			reopenedCount: sql`${tickets.reopenedCount} + 1`,
			updatedAt: new Date(),
		})
		.where(eq(tickets.id, ticketId))
}

export async function claimTicket(db: Database, ticketId: number, userId: string): Promise<void> {
	await db
		.update(tickets)
		.set({ assignedToId: userId, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function unclaimTicket(db: Database, ticketId: number): Promise<void> {
	await db
		.update(tickets)
		.set({ assignedToId: null, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function transferTicket(
	db: Database,
	ticketId: number,
	newAssigneeId: string,
): Promise<void> {
	await db
		.update(tickets)
		.set({ assignedToId: newAssigneeId, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function updateTicketPriority(
	db: Database,
	ticketId: number,
	priority: string,
): Promise<void> {
	await db.update(tickets).set({ priority, updatedAt: new Date() }).where(eq(tickets.id, ticketId))
}

export async function ensureUser(
	db: Database,
	discordId: string,
	username: string,
	displayName?: string,
	avatarUrl?: string,
): Promise<string> {
	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.discordId, discordId))
		.limit(1)

	const first = existing[0]
	if (first) {
		await db
			.update(users)
			.set({
				username,
				displayName: displayName ?? null,
				avatarUrl: avatarUrl ?? null,
				updatedAt: new Date(),
			})
			.where(eq(users.id, first.id))
		return first.id
	}

	const inserted = await db
		.insert(users)
		.values({ discordId, username, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null })
		.returning({ id: users.id })

	const newUser = inserted[0]
	if (!newUser) throw new Error('Failed to insert user')
	return newUser.id
}

export async function logMessage(
	db: Database,
	opts: {
		ticketId: number
		userId: string
		discordMessageId: string
		content: string
		isStaff: boolean
		attachments: unknown[]
	},
): Promise<void> {
	await db.insert(ticketMessages).values({
		ticketId: opts.ticketId,
		userId: opts.userId,
		discordMessageId: opts.discordMessageId,
		content: opts.content,
		isStaff: opts.isStaff,
		attachments: opts.attachments,
	})
}

export async function setFirstResponseAt(db: Database, ticketId: number): Promise<void> {
	await db
		.update(tickets)
		.set({ firstResponseAt: new Date() })
		.where(and(eq(tickets.id, ticketId), sql`${tickets.firstResponseAt} IS NULL`))
}
