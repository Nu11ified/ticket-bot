import type { Database } from '@ticketbot/db'
import { auditLogs, tickets } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { ApiError } from '../../lib/api-error.js'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import {
	assignTicket,
	getTicketDetail,
	listTickets,
	updateTicketPriority,
	updateTicketStatus,
} from '../../services/ticket.js'

export function publicTicketRoutes(db: Database) {
	return new Elysia({ prefix: '/tickets' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, query }: any) => {
				return listTickets(db, apiKey.guildId, {
					status: query.status,
					priority: query.priority,
					categoryId: query.categoryId ? Number(query.categoryId) : undefined,
					assignedToId: query.assignedToId,
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				beforeHandle: checkKeyPermission('tickets.read'),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
					status: t.Optional(t.String()),
					priority: t.Optional(t.String()),
					categoryId: t.Optional(t.Numeric()),
					assignedToId: t.Optional(t.String()),
				}),
			},
		)
		.get(
			'/:ticketId',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await getTicketDetail(db, apiKey.guildId, ticketId)
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.read'),
				params: t.Object({ ticketId: t.Numeric() }),
			},
		)
		.put(
			'/:ticketId/status',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketStatus(db, apiKey.guildId, ticketId, body.status)
				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.status_changed',
					metadata: { field: 'status', new: body.status, via: 'api_key' },
				})
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Object({
					status: t.Union([
						t.Literal('open'),
						t.Literal('pending'),
						t.Literal('waiting_user'),
						t.Literal('waiting_staff'),
						t.Literal('escalated'),
						t.Literal('resolved'),
					]),
				}),
			},
		)
		.put(
			'/:ticketId/priority',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketPriority(db, apiKey.guildId, ticketId, body.priority)
				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.status_changed',
					metadata: { field: 'priority', new: body.priority, via: 'api_key' },
				})
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Object({
					priority: t.Union([
						t.Literal('low'),
						t.Literal('normal'),
						t.Literal('high'),
						t.Literal('urgent'),
					]),
				}),
			},
		)
		.put(
			'/:ticketId/assign',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await assignTicket(db, apiKey.guildId, ticketId, body.assignedToId)
				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.reassigned',
					metadata: { assignedToId: body.assignedToId, via: 'api_key' },
				})
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Object({
					assignedToId: t.Union([t.String(), t.Null()]),
				}),
			},
		)
		.post(
			'/:ticketId/close',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)

				const existing = await db
					.select({ id: tickets.id, status: tickets.status })
					.from(tickets)
					.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, apiKey.guildId)))
					.limit(1)

				const ticket = existing[0]
				if (!ticket) {
					throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
				}
				if (ticket.status === 'closed') {
					throw new ApiError(409, 'TICKET_ALREADY_CLOSED', 'Ticket is already closed')
				}

				const reason = body?.reason ?? null

				const updated = await db
					.update(tickets)
					.set({
						status: 'closed',
						closedAt: new Date(),
						closeReason: reason,
						updatedAt: new Date(),
					})
					.where(eq(tickets.id, ticketId))
					.returning()

				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.closed',
					metadata: { reason, via: 'api_key' },
				})

				return { data: updated[0] }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Optional(
					t.Object({
						reason: t.Optional(t.String()),
					}),
				),
			},
		)
}
