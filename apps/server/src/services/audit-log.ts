import type { Database } from '@ticketbot/db'
import { auditLogs, users } from '@ticketbot/db'
import { type SQL, and, eq } from 'drizzle-orm'
import {
	type PaginatedResult,
	clampLimit,
	cursorCondition,
	decodeCursor,
	paginateResults,
} from '../lib/cursor.js'

interface AuditLogFilters {
	action?: string
	actorId?: string
	cursor?: string
	limit?: number
}

export async function listAuditLogs(
	db: Database,
	guildId: number,
	filters: AuditLogFilters,
): Promise<PaginatedResult<Record<string, unknown>>> {
	const limit = clampLimit(filters.limit)
	const conditions: SQL[] = [eq(auditLogs.guildId, guildId)]

	if (filters.action) conditions.push(eq(auditLogs.action, filters.action))
	if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId))

	if (filters.cursor) {
		const cursor = decodeCursor(filters.cursor)
		const cond = cursorCondition(auditLogs.id, cursor)
		if (cond) conditions.push(cond)
	}

	const rows = await db
		.select({
			id: auditLogs.id,
			guildId: auditLogs.guildId,
			ticketId: auditLogs.ticketId,
			actorId: auditLogs.actorId,
			actorDiscordId: auditLogs.actorDiscordId,
			actorType: auditLogs.actorType,
			action: auditLogs.action,
			metadata: auditLogs.metadata,
			createdAt: auditLogs.createdAt,
			actorUsername: users.username,
			actorDisplayName: users.displayName,
		})
		.from(auditLogs)
		.leftJoin(users, eq(auditLogs.actorId, users.id))
		.where(and(...conditions))
		.orderBy(auditLogs.id)
		.limit(limit + 1)

	return paginateResults(rows, limit)
}
