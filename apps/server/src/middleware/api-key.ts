import type { Database } from '@ticketbot/db'
import { apiKeys, guilds } from '@ticketbot/db'
import { PLAN_DEFAULTS } from '@ticketbot/shared'
import type { PlanTier } from '@ticketbot/shared'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { ApiError } from '../lib/api-error.js'
import { checkRateLimit } from '../lib/rate-limiter.js'

function sha256(input: string): string {
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(input)
	return hasher.digest('hex')
}

export function apiKeyPlugin(db: Database) {
	return new Elysia({ name: 'api-key-auth' }).derive(async ({ request, set }) => {
		const header = request.headers.get('authorization')
		if (!header?.startsWith('Bearer tk_')) {
			throw new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid API key')
		}

		const key = header.slice(7)
		const hash = sha256(key)

		const rows = await db
			.select({
				id: apiKeys.id,
				guildId: apiKeys.guildId,
				permissions: apiKeys.permissions,
				rateLimitPerMinute: apiKeys.rateLimitPerMinute,
				expiresAt: apiKeys.expiresAt,
			})
			.from(apiKeys)
			.where(eq(apiKeys.keyHash, hash))
			.limit(1)

		const row = rows[0]
		if (!row) {
			throw new ApiError(401, 'UNAUTHORIZED', 'Invalid API key')
		}

		if (row.expiresAt && row.expiresAt < new Date()) {
			throw new ApiError(401, 'KEY_EXPIRED', 'API key expired')
		}

		// Resolve rate limit
		let rateLimit = row.rateLimitPerMinute
		if (!rateLimit) {
			const guildRows = await db
				.select({ planTier: guilds.planTier })
				.from(guilds)
				.where(eq(guilds.id, row.guildId))
				.limit(1)
			const guildRow = guildRows[0]
			const tier = (guildRow?.planTier ?? 'free') as PlanTier
			rateLimit = PLAN_DEFAULTS[tier].apiRateLimitPerMinute
		}

		// Check rate limit
		const result = checkRateLimit(hash, rateLimit)
		if (!result.allowed) {
			set.headers['x-ratelimit-limit'] = String(rateLimit)
			set.headers['x-ratelimit-remaining'] = '0'
			set.headers['x-ratelimit-reset'] = String(result.resetAt)
			set.headers['retry-after'] = String(result.retryAfter)
			throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded')
		}

		// Set rate limit headers
		set.headers['x-ratelimit-limit'] = String(rateLimit)
		set.headers['x-ratelimit-remaining'] = String(result.remaining)
		set.headers['x-ratelimit-reset'] = String(result.resetAt)

		// Update lastUsedAt (fire-and-forget)
		db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).then()

		return {
			apiKey: {
				id: row.id,
				guildId: row.guildId,
				permissions: row.permissions,
			},
		}
	})
}
