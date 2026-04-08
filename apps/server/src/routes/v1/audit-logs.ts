import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import { listAuditLogs } from '../../services/audit-log.js'

export function publicAuditLogRoutes(db: Database) {
	return new Elysia({ prefix: '/audit-logs' }).get(
		'/',
		// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
		async ({ apiKey, query }: any) => {
			return listAuditLogs(db, apiKey.guildId, {
				action: query.action,
				actorId: query.actorId,
				cursor: query.cursor,
				limit: query.limit ? Number(query.limit) : undefined,
			})
		},
		{
			beforeHandle: checkKeyPermission('audit_logs.read'),
			query: t.Object({
				cursor: t.Optional(t.String()),
				limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				action: t.Optional(t.String()),
				actorId: t.Optional(t.String()),
			}),
		},
	)
}
