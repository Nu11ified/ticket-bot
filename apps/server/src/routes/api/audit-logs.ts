import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { listAuditLogs } from '../../services/audit-log.js'

export function auditLogRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/audit-logs' }).get(
		'/',
		// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
		async ({ params, query }: any) => {
			const guildId = Number(params.guildId)
			return listAuditLogs(db, guildId, {
				action: query.action,
				actorId: query.actorId,
				cursor: query.cursor,
				limit: query.limit ? Number(query.limit) : undefined,
			})
		},
		{
			auth: true,
			beforeHandle: checkPermissions(db, ['admin.view_audit_logs']),
			params: t.Object({ guildId: t.Numeric() }),
			query: t.Object({
				cursor: t.Optional(t.String()),
				limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				action: t.Optional(t.String()),
				actorId: t.Optional(t.String()),
			}),
		},
	)
}
