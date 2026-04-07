import type { Database } from '@ticketbot/db'
import { Elysia } from 'elysia'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import { listCategories } from '../../services/category.js'

export function publicCategoryRoutes(db: Database) {
	return new Elysia({ prefix: '/categories' }).get(
		'/',
		// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
		async ({ apiKey }: any) => {
			const cats = await listCategories(db, apiKey.guildId)
			return { data: cats }
		},
		{ beforeHandle: checkKeyPermission('categories.read') },
	)
}
