import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import {
	createCategory,
	deleteCategory,
	getCategory,
	listCategories,
	updateCategory,
} from '../../services/category.js'

export function categoryRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/categories' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const cats = await listCategories(db, guildId)
				return { data: cats }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.view']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.get(
			'/:categoryId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const categoryId = Number(params.categoryId)
				const cat = await getCategory(db, guildId, categoryId)
				return { data: cat }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.view']),
				params: t.Object({ guildId: t.Numeric(), categoryId: t.Numeric() }),
			},
		)
		.post(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const cat = await createCategory(db, guildId, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'category.created',
					metadata: { categoryId: cat.id, name: cat.name },
				})
				return { data: cat }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_categories']),
				params: t.Object({ guildId: t.Numeric() }),
				body: t.Object({
					name: t.String({ minLength: 1, maxLength: 100 }),
					description: t.Optional(t.String({ maxLength: 500 })),
					emoji: t.Optional(t.String({ maxLength: 10 })),
					maxOpenPerUser: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
				}),
			},
		)
		.put(
			'/:categoryId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const categoryId = Number(params.categoryId)
				const cat = await updateCategory(db, guildId, categoryId, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'category.updated',
					metadata: { categoryId, changes: Object.keys(body) },
				})
				return { data: cat }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_categories']),
				params: t.Object({ guildId: t.Numeric(), categoryId: t.Numeric() }),
				body: t.Object({
					name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
					description: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
					emoji: t.Optional(t.Union([t.String({ maxLength: 10 }), t.Null()])),
					maxOpenPerUser: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
					isEnabled: t.Optional(t.Boolean()),
					position: t.Optional(t.Integer({ minimum: 0 })),
					targetChannelId: t.Optional(t.Union([t.String(), t.Null()])),
					autoCloseHours: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
				}),
			},
		)
		.delete(
			'/:categoryId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const categoryId = Number(params.categoryId)
				await deleteCategory(db, guildId, categoryId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'category.deleted',
					metadata: { categoryId },
				})
				return { success: true }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_categories']),
				params: t.Object({ guildId: t.Numeric(), categoryId: t.Numeric() }),
			},
		)
}
