import type { Database } from '@ticketbot/db'
import { Elysia } from 'elysia'

export function userRoutes(_db: Database) {
	return new Elysia({ prefix: '/user' }).get(
		'/me',
		// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
		({ user }: any) => {
			return {
				data: {
					id: user.id,
					username: user.username,
					displayName: user.displayName,
					avatarUrl: user.avatarUrl ?? user.avatar_url,
					email: user.email,
				},
			}
		},
		// @ts-expect-error auth macro injected by parent plugin
		{ auth: true },
	)
}
