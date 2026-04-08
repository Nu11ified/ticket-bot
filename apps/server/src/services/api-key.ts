import type { Database } from '@ticketbot/db'
import { apiKeys } from '@ticketbot/db'
import { API_KEY_PERMISSIONS } from '@ticketbot/shared'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

function sha256(input: string): string {
	return new Bun.CryptoHasher('sha256').update(input).digest('hex')
}

function generateKey(): string {
	const bytes = new Uint8Array(32)
	crypto.getRandomValues(bytes)
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
	return `tk_${hex}`
}

export async function listApiKeys(db: Database, guildId: number) {
	const rows = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			permissions: apiKeys.permissions,
			rateLimitPerMinute: apiKeys.rateLimitPerMinute,
			lastUsedAt: apiKeys.lastUsedAt,
			expiresAt: apiKeys.expiresAt,
			createdAt: apiKeys.createdAt,
		})
		.from(apiKeys)
		.where(eq(apiKeys.guildId, guildId))
		.orderBy(apiKeys.createdAt)

	return rows
}

export async function createApiKey(
	db: Database,
	guildId: number,
	createdById: string,
	opts: {
		name: string
		permissions: string[]
		rateLimitPerMinute?: number
		expiresInDays?: number
	},
) {
	// Validate permissions
	const permSet = new Set<string>(API_KEY_PERMISSIONS)
	for (const perm of opts.permissions) {
		if (!permSet.has(perm)) {
			throw new ApiError(400, 'INVALID_PERMISSION', `Unknown permission: ${perm}`)
		}
	}

	const key = generateKey()
	const keyHash = sha256(key)
	const keyPrefix = key.slice(0, 11)

	let expiresAt: Date | undefined
	if (opts.expiresInDays) {
		expiresAt = new Date()
		expiresAt.setDate(expiresAt.getDate() + opts.expiresInDays)
	}

	const rows = await db
		.insert(apiKeys)
		.values({
			guildId,
			createdById,
			name: opts.name,
			keyHash,
			keyPrefix,
			permissions: opts.permissions,
			rateLimitPerMinute: opts.rateLimitPerMinute,
			expiresAt,
		})
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(500, 'CREATE_FAILED', 'Failed to create API key')
	}

	return { ...row, key }
}

export async function revokeApiKey(db: Database, guildId: number, keyId: number) {
	const rows = await db
		.delete(apiKeys)
		.where(and(eq(apiKeys.id, keyId), eq(apiKeys.guildId, guildId)))
		.returning({ id: apiKeys.id })

	if (!rows[0]) {
		throw new ApiError(404, 'API_KEY_NOT_FOUND', 'API key not found')
	}
}

export async function rotateApiKey(db: Database, guildId: number, keyId: number) {
	// Verify key exists
	const existing = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(eq(apiKeys.id, keyId), eq(apiKeys.guildId, guildId)))
		.limit(1)

	if (!existing[0]) {
		throw new ApiError(404, 'API_KEY_NOT_FOUND', 'API key not found')
	}

	const key = generateKey()
	const keyHash = sha256(key)
	const keyPrefix = key.slice(0, 11)

	await db.update(apiKeys).set({ keyHash, keyPrefix }).where(eq(apiKeys.id, keyId))

	return { key, keyPrefix }
}
