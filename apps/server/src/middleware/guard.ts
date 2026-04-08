import { resolveUserPermissions } from '@ticketbot/auth'
import type { Database } from '@ticketbot/db'

export function checkPermissions(
	db: Database,
	requiredPermissions: string[],
	guildIdParam = 'guildId',
) {
	// biome-ignore lint/suspicious/noExplicitAny: Elysia context types are complex; user is injected by the auth macro
	return async ({ user, params, set }: any) => {
		const guildId = Number(params[guildIdParam])
		if (!guildId || Number.isNaN(guildId)) {
			set.status = 400
			return { error: 'Valid guild ID required' }
		}

		const perms = await resolveUserPermissions(db, user.id, guildId)

		for (const required of requiredPermissions) {
			if (!perms.has(required)) {
				set.status = 403
				return { error: 'Insufficient permissions' }
			}
		}
	}
}
