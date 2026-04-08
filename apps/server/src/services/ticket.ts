import type { Database } from '@ticketbot/db'
import { categories, ticketMessages, tickets, users } from '@ticketbot/db'
import { type SQL, and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'
import {
	type PaginatedResult,
	clampLimit,
	cursorCondition,
	decodeCursor,
	paginateResults,
} from '../lib/cursor.js'

interface TicketFilters {
	status?: string
	priority?: string
	categoryId?: number
	assignedToId?: string
	cursor?: string
	limit?: number
}

export async function listTickets(
	db: Database,
	guildId: number,
	filters: TicketFilters,
): Promise<PaginatedResult<Record<string, unknown>>> {
	const limit = clampLimit(filters.limit)
	const conditions: SQL[] = [eq(tickets.guildId, guildId)]

	if (filters.status) conditions.push(eq(tickets.status, filters.status))
	if (filters.priority) conditions.push(eq(tickets.priority, filters.priority))
	if (filters.categoryId) conditions.push(eq(tickets.categoryId, filters.categoryId))
	if (filters.assignedToId) conditions.push(eq(tickets.assignedToId, filters.assignedToId))

	if (filters.cursor) {
		const cursor = decodeCursor(filters.cursor)
		const cond = cursorCondition(tickets.id, cursor)
		if (cond) conditions.push(cond)
	}

	const rows = await db
		.select({
			id: tickets.id,
			ticketNumber: tickets.ticketNumber,
			subject: tickets.subject,
			status: tickets.status,
			priority: tickets.priority,
			channelId: tickets.channelId,
			creatorId: tickets.creatorId,
			assignedToId: tickets.assignedToId,
			categoryId: tickets.categoryId,
			categoryName: categories.name,
			createdAt: tickets.createdAt,
			updatedAt: tickets.updatedAt,
			closedAt: tickets.closedAt,
		})
		.from(tickets)
		.leftJoin(categories, eq(tickets.categoryId, categories.id))
		.where(and(...conditions))
		.orderBy(tickets.id)
		.limit(limit + 1)

	return paginateResults(rows, limit)
}

export async function getTicketDetail(db: Database, guildId: number, ticketId: number) {
	const rows = await db
		.select({
			id: tickets.id,
			ticketNumber: tickets.ticketNumber,
			subject: tickets.subject,
			status: tickets.status,
			priority: tickets.priority,
			channelId: tickets.channelId,
			creatorId: tickets.creatorId,
			assignedToId: tickets.assignedToId,
			closedById: tickets.closedById,
			closeReason: tickets.closeReason,
			categoryId: tickets.categoryId,
			categoryName: categories.name,
			reopenedCount: tickets.reopenedCount,
			firstResponseAt: tickets.firstResponseAt,
			closedAt: tickets.closedAt,
			createdAt: tickets.createdAt,
			updatedAt: tickets.updatedAt,
		})
		.from(tickets)
		.leftJoin(categories, eq(tickets.categoryId, categories.id))
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.limit(1)

	const ticket = rows[0]
	if (!ticket) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	const messages = await db
		.select({
			id: ticketMessages.id,
			content: ticketMessages.content,
			isStaff: ticketMessages.isStaff,
			isInternalNote: ticketMessages.isInternalNote,
			attachments: ticketMessages.attachments,
			createdAt: ticketMessages.createdAt,
			userId: ticketMessages.userId,
			username: users.username,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl,
		})
		.from(ticketMessages)
		.innerJoin(users, eq(ticketMessages.userId, users.id))
		.where(eq(ticketMessages.ticketId, ticketId))
		.orderBy(ticketMessages.createdAt)

	return { ...ticket, messages }
}

export async function updateTicketStatus(
	db: Database,
	guildId: number,
	ticketId: number,
	status: string,
) {
	const rows = await db
		.update(tickets)
		.set({ status, updatedAt: new Date() })
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	return row
}

export async function updateTicketPriority(
	db: Database,
	guildId: number,
	ticketId: number,
	priority: string,
) {
	const rows = await db
		.update(tickets)
		.set({ priority, updatedAt: new Date() })
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	return row
}

export async function assignTicket(
	db: Database,
	guildId: number,
	ticketId: number,
	assignedToId: string | null,
) {
	const rows = await db
		.update(tickets)
		.set({ assignedToId, updatedAt: new Date() })
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	return row
}
