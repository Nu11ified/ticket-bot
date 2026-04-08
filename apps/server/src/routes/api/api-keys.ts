import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from '../../services/api-key.js'

export function apiKeyRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/api-keys' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const keys = await listApiKeys(db, guildId)
				return { data: keys }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.post(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const result = await createApiKey(db, guildId, user.id, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'api_key.created',
					metadata: { apiKeyId: result.id, name: result.name },
				})
				return { data: result }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric() }),
				body: t.Object({
					name: t.String({ minLength: 1, maxLength: 100 }),
					permissions: t.Array(t.String(), { minItems: 1 }),
					rateLimitPerMinute: t.Optional(t.Integer({ minimum: 1, maximum: 1000 })),
					expiresInDays: t.Optional(t.Union([t.Literal(30), t.Literal(90), t.Literal(365)])),
				}),
			},
		)
		.post(
			'/:keyId/rotate',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const keyId = Number(params.keyId)
				const result = await rotateApiKey(db, guildId, keyId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'api_key.rotated',
					metadata: { apiKeyId: keyId },
				})
				return { data: result }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric(), keyId: t.Numeric() }),
			},
		)
		.delete(
			'/:keyId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const keyId = Number(params.keyId)
				await revokeApiKey(db, guildId, keyId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'api_key.revoked',
					metadata: { apiKeyId: keyId },
				})
				return { success: true }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric(), keyId: t.Numeric() }),
			},
		)
}
