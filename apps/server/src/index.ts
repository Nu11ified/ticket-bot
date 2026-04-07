import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { createAuth } from '@ticketbot/auth'
import { createDb } from '@ticketbot/db'
import { Elysia } from 'elysia'
import { ApiError } from './lib/api-error.js'
import { startRateLimitCleanup } from './lib/rate-limiter.js'
import { apiKeyPlugin } from './middleware/api-key.js'
import { authPlugin } from './middleware/auth.js'
import { superAdminGuard } from './middleware/super-admin.js'
import { apiKeyRoutes } from './routes/api/api-keys.js'
import { auditLogRoutes } from './routes/api/audit-logs.js'
import { billingRoutes } from './routes/api/billing.js'
import { categoryRoutes } from './routes/api/categories.js'
import { guildRoutes } from './routes/api/guilds.js'
import { panelRoutes } from './routes/api/panels.js'
import { roleRoutes } from './routes/api/roles.js'
import { ticketRoutes } from './routes/api/tickets.js'
import { transcriptRoutes } from './routes/api/transcripts.js'
import { userRoutes } from './routes/api/user.js'
import { publicAuditLogRoutes } from './routes/v1/audit-logs.js'
import { publicCategoryRoutes } from './routes/v1/categories.js'
import { publicGuildRoutes } from './routes/v1/guild.js'
import { publicTicketRoutes } from './routes/v1/tickets.js'
import { publicTranscriptRoutes } from './routes/v1/transcripts.js'

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
	.onError(({ error, code, set }) => {
		if (error instanceof ApiError) {
			set.status = error.status
			return { error: error.code, message: error.message, ...error.data }
		}
		if (code === 'VALIDATION') {
			set.status = 400
			return { error: 'VALIDATION_ERROR', message: error.message }
		}
		if (code === 'NOT_FOUND') {
			set.status = 404
			return { error: 'NOT_FOUND', message: 'Route not found' }
		}
		console.error(error)
		set.status = 500
		return { error: 'INTERNAL_ERROR', message: 'Something went wrong' }
	})
	.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
	// Dashboard API — session authenticated
	.use(authPlugin(auth))
	.group('/api', (app) =>
		app
			.use(guildRoutes(db))
			.use(userRoutes(db))
			.use(categoryRoutes(db))
			.use(panelRoutes(db))
			.use(ticketRoutes(db))
			.use(transcriptRoutes(db))
			.use(roleRoutes(db))
			.use(auditLogRoutes(db))
			.use(apiKeyRoutes(db))
			.use(billingRoutes(db)),
	)
	// Internal routes — super admin only
	.group('/internal', (app) =>
		app
			.use(superAdminGuard)
			// biome-ignore lint/suspicious/noExplicitAny: user is injected by auth macro at runtime
			.get('/health', ({ user }: any) => ({
				status: 'ok',
				admin: user.email,
			})),
	)
	// Public API — API key authenticated
	.group('/v1', (app) =>
		app
			.use(apiKeyPlugin(db))
			.use(publicGuildRoutes(db))
			.use(publicCategoryRoutes(db))
			.use(publicTicketRoutes(db))
			.use(publicTranscriptRoutes(db))
			.use(publicAuditLogRoutes(db)),
	)
	.listen(3001)

// Start rate limit cleanup interval
const cleanupInterval = startRateLimitCleanup()

console.log(`Server running at http://localhost:${app.server?.port}`)

// Graceful shutdown
process.on('SIGINT', () => {
	clearInterval(cleanupInterval)
	process.exit(0)
})

export type App = typeof app
