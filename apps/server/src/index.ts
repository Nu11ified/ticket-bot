import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { createAuth, syncGuildRoles, syncUserGuilds } from '@ticketbot/auth'
import { createDb } from '@ticketbot/db'
import { guilds } from '@ticketbot/db'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { authPlugin } from './middleware/auth.js'
import { checkPermissions } from './middleware/guard.js'
import { superAdminGuard } from './middleware/super-admin.js'

const db = createDb(process.env.DATABASE_URL ?? '')
const auth = createAuth(db)

const app = new Elysia()
	.use(
		swagger({
			documentation: {
				info: {
					title: 'TicketBot API',
					version: '0.0.1',
					description: 'API for the TicketBot Discord ticket management platform',
				},
			},
		}),
	)
	.use(
		cors({
			origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			credentials: true,
			allowedHeaders: ['Content-Type', 'Authorization'],
		}),
	)
	.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
	.use(authPlugin(auth))
	.post(
		'/api/guilds/refresh',
		async ({ user }) => {
			await syncUserGuilds(db, user.id)
			return { success: true }
		},
		{ auth: true },
	)
	.post(
		'/api/guilds/:guildId/roles/refresh',
		async ({ params }) => {
			const guildId = Number(params.guildId)
			const guild = await db
				.select({ discordId: guilds.discordId })
				.from(guilds)
				.where(eq(guilds.id, guildId))
				.limit(1)
			const firstGuild = guild[0]
			if (!firstGuild) return { error: 'Guild not found' }
			await syncGuildRoles(db, guildId, firstGuild.discordId)
			return { success: true }
		},
		{
			auth: true,
			beforeHandle: checkPermissions(db, ['admin.manage_roles']),
		},
	)
	.group('/internal', (app) =>
		app
			.use(superAdminGuard)
			// biome-ignore lint/suspicious/noExplicitAny: user is injected by auth macro at runtime
			.get('/health', ({ user }: any) => ({
				status: 'ok',
				admin: user.email,
			})),
	)
	.listen(3001)

console.log(`Server running at http://localhost:${app.server?.port}`)

export type App = typeof app
