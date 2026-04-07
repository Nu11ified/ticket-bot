import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import {
	assignTicket,
	getTicketDetail,
	listTickets,
	updateTicketPriority,
	updateTicketStatus,
} from '../../services/ticket.js'

export function ticketRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/tickets' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, query }: any) => {
				const guildId = Number(params.guildId)
				return listTickets(db, guildId, {
					status: query.status,
					priority: query.priority,
					categoryId: query.categoryId ? Number(query.categoryId) : undefined,
					assignedToId: query.assignedToId,
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.view']),
				params: t.Object({ guildId: t.Numeric() }),
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
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await getTicketDetail(db, guildId, ticketId)
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.view']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
			},
		)
		.put(
			'/:ticketId/status',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketStatus(db, guildId, ticketId, body.status)
				await db.insert(auditLogs).values({
					guildId,
					ticketId,
					actorId: user.id,
					actorType: 'user',
					action: 'ticket.status_changed',
					metadata: { field: 'status', new: body.status },
				})
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.manage']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
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
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketPriority(db, guildId, ticketId, body.priority)
				await db.insert(auditLogs).values({
					guildId,
					ticketId,
					actorId: user.id,
					actorType: 'user',
					action: 'ticket.status_changed',
					metadata: { field: 'priority', new: body.priority },
				})
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.manage']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
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
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await assignTicket(db, guildId, ticketId, body.assignedToId)
				await db.insert(auditLogs).values({
					guildId,
					ticketId,
					actorId: user.id,
					actorType: 'user',
					action: 'ticket.reassigned',
					metadata: { assignedToId: body.assignedToId },
				})
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.manage']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
				body: t.Object({
					assignedToId: t.Union([t.String(), t.Null()]),
				}),
			},
		)
}
