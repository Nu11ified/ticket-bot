import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import {
	createPanel,
	deletePanel,
	deployPanel,
	getPanel,
	listPanels,
	updatePanel,
} from '../../services/panel.js'

export function panelRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/panels' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const pnls = await listPanels(db, guildId)
				return { data: pnls }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_panels']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.get(
			'/:panelId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const panelId = Number(params.panelId)
				const panel = await getPanel(db, guildId, panelId)
				return { data: panel }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_panels']),
				params: t.Object({ guildId: t.Numeric(), panelId: t.Numeric() }),
			},
		)
		.post(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const panel = await createPanel(db, guildId, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'panel.created',
					metadata: { panelId: panel.id, name: panel.name },
				})
				return { data: panel }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_panels']),
				params: t.Object({ guildId: t.Numeric() }),
				body: t.Object({
					name: t.String({ minLength: 1, maxLength: 100 }),
					embedTitle: t.Optional(t.String({ maxLength: 256 })),
					embedDescription: t.Optional(t.String({ maxLength: 4096 })),
					embedColor: t.Optional(t.Integer({ minimum: 0, maximum: 16777215 })),
					embedThumbnailUrl: t.Optional(t.String()),
					embedFooterText: t.Optional(t.String({ maxLength: 2048 })),
				}),
			},
		)
		.put(
			'/:panelId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const panelId = Number(params.panelId)
				const panel = await updatePanel(db, guildId, panelId, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'panel.updated',
					metadata: { panelId, changes: Object.keys(body) },
				})
				return { data: panel }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_panels']),
				params: t.Object({ guildId: t.Numeric(), panelId: t.Numeric() }),
				body: t.Object({
					name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
					embedTitle: t.Optional(t.Union([t.String({ maxLength: 256 }), t.Null()])),
					embedDescription: t.Optional(t.Union([t.String({ maxLength: 4096 }), t.Null()])),
					embedColor: t.Optional(t.Union([t.Integer({ minimum: 0, maximum: 16777215 }), t.Null()])),
					embedThumbnailUrl: t.Optional(t.Union([t.String(), t.Null()])),
					embedFooterText: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
					channelId: t.Optional(t.Union([t.String(), t.Null()])),
				}),
			},
		)
		.delete(
			'/:panelId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const panelId = Number(params.panelId)
				await deletePanel(db, guildId, panelId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'panel.deleted',
					metadata: { panelId },
				})
				return { success: true }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_panels']),
				params: t.Object({ guildId: t.Numeric(), panelId: t.Numeric() }),
			},
		)
		.post(
			'/:panelId/deploy',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const panelId = Number(params.panelId)
				const result = await deployPanel(db, guildId, panelId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'panel.deployed',
					metadata: { panelId, messageId: result.messageId },
				})
				return { data: result }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_panels']),
				params: t.Object({ guildId: t.Numeric(), panelId: t.Numeric() }),
			},
		)
}
