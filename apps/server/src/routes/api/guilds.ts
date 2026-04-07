import { resolveUserPermissions, syncUserGuilds } from '@ticketbot/auth'
import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { getGuildDetails, listUserGuilds, updateGuildSettings } from '../../services/guild.js'

export function guildRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user }: any) => {
				const guilds = await listUserGuilds(db, user.id)
				return { data: guilds }
			},
			// @ts-expect-error auth macro injected by parent plugin
			{ auth: true },
		)
		.get(
			'/:guildId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, params }: any) => {
				const guildId = Number(params.guildId)
				const guild = await getGuildDetails(db, guildId, user.id)
				return { data: guild }
			},
			{
				auth: true,
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.get(
			'/:guildId/permissions',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, params }: any) => {
				const guildId = Number(params.guildId)
				const perms = await resolveUserPermissions(db, user.id, guildId)
				return { data: { permissions: Array.from(perms) } }
			},
			{
				auth: true,
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.post(
			'/refresh',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user }: any) => {
				await syncUserGuilds(db, user.id)
				return { success: true }
			},
			// @ts-expect-error auth macro injected by parent plugin
			{ auth: true },
		)
		.put(
			'/:guildId/settings',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, params, body }: any) => {
				const guildId = Number(params.guildId)
				const settings = await updateGuildSettings(db, guildId, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'settings.updated',
					metadata: { changes: Object.keys(body) },
				})
				return { data: settings }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_settings']),
				params: t.Object({ guildId: t.Numeric() }),
				body: t.Object({
					logChannelId: t.Optional(t.Union([t.String(), t.Null()])),
					transcriptChannelId: t.Optional(t.Union([t.String(), t.Null()])),
					locale: t.Optional(t.String()),
					timezone: t.Optional(t.String()),
					autoCloseHours: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
					transcriptRetentionDays: t.Optional(t.Integer({ minimum: 1, maximum: 365 })),
					ticketCooldownSeconds: t.Optional(t.Integer({ minimum: 0, maximum: 3600 })),
				}),
			},
		)
}
