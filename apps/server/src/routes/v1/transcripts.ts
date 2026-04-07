import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import { getTranscript, listTranscripts } from '../../services/transcript.js'

export function publicTranscriptRoutes(db: Database) {
	return new Elysia({ prefix: '/transcripts' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, query }: any) => {
				return listTranscripts(db, apiKey.guildId, {
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				beforeHandle: checkKeyPermission('transcripts.read'),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				}),
			},
		)
		.get(
			'/:transcriptId',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params }: any) => {
				const transcriptId = Number(params.transcriptId)
				const transcript = await getTranscript(db, apiKey.guildId, transcriptId)
				return { data: transcript }
			},
			{
				beforeHandle: checkKeyPermission('transcripts.read'),
				params: t.Object({ transcriptId: t.Numeric() }),
			},
		)
}
