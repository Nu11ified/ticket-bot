import type { Auth } from '@ticketbot/auth'
import { type Context, Elysia } from 'elysia'

export function authPlugin(auth: Auth) {
	const betterAuthView = (context: Context) => {
		const BETTER_AUTH_ACCEPT_METHODS = ['POST', 'GET']
		if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
			return auth.handler(context.request)
		}
		context.set.status = 405
		return { error: 'Method not allowed' }
	}

	return new Elysia({ name: 'auth' }).all('/api/auth/*', betterAuthView).macro({
		auth: {
			async resolve({ status, request: { headers } }) {
				const session = await auth.api.getSession({ headers })
				if (!session) return status(401)
				return {
					user: session.user,
					session: session.session,
				}
			},
		},
	})
}
