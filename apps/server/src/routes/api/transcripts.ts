import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { exportTranscript, getTranscript, listTranscripts } from '../../services/transcript.js'

export function transcriptRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/transcripts' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, query }: any) => {
				const guildId = Number(params.guildId)
				return listTranscripts(db, guildId, {
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['transcripts.view']),
				params: t.Object({ guildId: t.Numeric() }),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				}),
			},
		)
		.get(
			'/:transcriptId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const transcriptId = Number(params.transcriptId)
				const transcript = await getTranscript(db, guildId, transcriptId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'transcript.viewed',
					metadata: { transcriptId },
				})
				return { data: transcript }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['transcripts.view']),
				params: t.Object({ guildId: t.Numeric(), transcriptId: t.Numeric() }),
			},
		)
		.get(
			'/:transcriptId/export',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, query, user, set }: any) => {
				const guildId = Number(params.guildId)
				const transcriptId = Number(params.transcriptId)
				const format = query.format === 'html' ? 'html' : 'json'
				const result = await exportTranscript(db, guildId, transcriptId, format)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'transcript.exported',
					metadata: { transcriptId, format },
				})
				set.headers['content-type'] = result.contentType
				return result.data
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['transcripts.export']),
				params: t.Object({ guildId: t.Numeric(), transcriptId: t.Numeric() }),
				query: t.Object({
					format: t.Optional(t.Union([t.Literal('json'), t.Literal('html')])),
				}),
			},
		)
}
