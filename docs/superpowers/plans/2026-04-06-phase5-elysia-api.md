# Phase 5: Elysia API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Dashboard API (`/api/*`) and Public API (`/v1/*`) on the existing Elysia server, with session auth for the dashboard, guild-scoped API keys for the public surface, cursor pagination, rate limiting, and shared service layer.

**Architecture:** Two API surfaces on one Elysia app. Dashboard routes use the existing Better Auth session macro + permission guards. Public routes use a new API key auth plugin + in-memory rate limiter. Both call shared services backed by `@ticketbot/db`. Route files are modular Elysia instances mounted on the main app.

**Tech Stack:** Elysia 1.3.0, TypeBox (via Elysia's `t`), Drizzle ORM, PostgreSQL, `@discordjs/rest` (panel deploy only), Bun

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `packages/db/src/schema/api-keys.ts` | api_keys table, relations, type exports |
| `packages/db/src/seed.ts` | Permission seed script |
| `apps/server/src/lib/api-error.ts` | ApiError class |
| `apps/server/src/lib/cursor.ts` | Cursor encode/decode/validate + paginated query helper |
| `apps/server/src/lib/rate-limiter.ts` | In-memory sliding window rate limiter |
| `apps/server/src/middleware/api-key.ts` | API key auth derive plugin |
| `apps/server/src/middleware/api-key-guard.ts` | Key permission beforeHandle guard |
| `apps/server/src/services/guild.ts` | Guild list, details, settings update |
| `apps/server/src/services/category.ts` | Category CRUD |
| `apps/server/src/services/panel.ts` | Panel CRUD + deploy to Discord |
| `apps/server/src/services/ticket.ts` | Ticket list, detail, status/priority/assign |
| `apps/server/src/services/transcript.ts` | Transcript list, get, export |
| `apps/server/src/services/audit-log.ts` | Audit log list with filters |
| `apps/server/src/services/role.ts` | Role list, permission update |
| `apps/server/src/services/api-key.ts` | Key create, list, revoke, rotate |
| `apps/server/src/routes/api/guilds.ts` | Dashboard guild + settings routes |
| `apps/server/src/routes/api/categories.ts` | Dashboard category CRUD routes |
| `apps/server/src/routes/api/panels.ts` | Dashboard panel CRUD + deploy routes |
| `apps/server/src/routes/api/tickets.ts` | Dashboard ticket routes |
| `apps/server/src/routes/api/transcripts.ts` | Dashboard transcript routes |
| `apps/server/src/routes/api/roles.ts` | Dashboard role management routes |
| `apps/server/src/routes/api/audit-logs.ts` | Dashboard audit log routes |
| `apps/server/src/routes/api/api-keys.ts` | Dashboard API key management routes |
| `apps/server/src/routes/api/user.ts` | Dashboard user routes |
| `apps/server/src/routes/v1/guild.ts` | Public guild info route |
| `apps/server/src/routes/v1/categories.ts` | Public categories route |
| `apps/server/src/routes/v1/tickets.ts` | Public ticket routes |
| `apps/server/src/routes/v1/transcripts.ts` | Public transcript routes |
| `apps/server/src/routes/v1/audit-logs.ts` | Public audit log routes |

### Modified files

| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Add api-keys export |
| `packages/db/src/client.ts` | Add apiKeysSchema import |
| `packages/shared/src/types/index.ts` | Add ApiKeyPermission type, new AuditAction values |
| `packages/shared/src/constants/plan-defaults.ts` | Add apiRateLimitPerMinute |
| `apps/server/src/index.ts` | Rewrite: mount route groups, global onError, rate limit cleanup |
| `apps/server/package.json` | Add @discordjs/rest dependency |

---

### Task 1: Schema + Config Updates

**Files:**
- Create: `packages/db/src/schema/api-keys.ts`
- Create: `packages/db/src/seed.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/client.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/constants/plan-defaults.ts`
- Regenerate: `packages/db/migrations/`

- [ ] **Step 1: Add `ApiKeyPermission` type and new `AuditAction` values to `packages/shared/src/types/index.ts`**

Add after the existing `RateLimitAction` type:

```typescript
export type ApiKeyPermission =
	| 'guild.read'
	| 'tickets.read'
	| 'tickets.update'
	| 'transcripts.read'
	| 'categories.read'
	| 'audit_logs.read'

export const API_KEY_PERMISSIONS: ApiKeyPermission[] = [
	'guild.read',
	'tickets.read',
	'tickets.update',
	'transcripts.read',
	'categories.read',
	'audit_logs.read',
]
```

Add these new values to the existing `AuditAction` union (after `transcript.exported`):

```typescript
	| 'api_key.created'
	| 'api_key.revoked'
	| 'api_key.rotated'
	| 'category.created'
	| 'category.updated'
	| 'category.deleted'
	| 'panel.deleted'
	| 'panel.deployed'
```

- [ ] **Step 2: Add `apiRateLimitPerMinute` to `packages/shared/src/constants/plan-defaults.ts`**

Replace the entire file:

```typescript
import type { PlanTier } from '../types/index.js'

interface PlanDefaults {
	transcriptRetentionDays: number
	ticketCooldownSeconds: number
	maxOpenTicketsPerUser: number
	apiRateLimitPerMinute: number
}

export const PLAN_DEFAULTS: Record<PlanTier, PlanDefaults> = {
	free: {
		transcriptRetentionDays: 5,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 1,
		apiRateLimitPerMinute: 60,
	},
	premium: {
		transcriptRetentionDays: 180,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 5,
		apiRateLimitPerMinute: 300,
	},
} as const
```

- [ ] **Step 3: Create `packages/db/src/schema/api-keys.ts`**

```typescript
import { relations } from 'drizzle-orm'
import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'
import { users } from './users.js'

export const apiKeys = pgTable(
	'api_keys',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		createdById: text('created_by_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		keyHash: text('key_hash').notNull().unique(),
		keyPrefix: text('key_prefix').notNull(),
		permissions: text('permissions').array().notNull(),
		rateLimitPerMinute: integer('rate_limit_per_minute'),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		guildIdx: index('idx_api_keys_guild').on(t.guildId),
		keyHashIdx: index('idx_api_keys_key_hash').on(t.keyHash),
	}),
)

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	guild: one(guilds, { fields: [apiKeys.guildId], references: [guilds.id] }),
	createdBy: one(users, { fields: [apiKeys.createdById], references: [users.id] }),
}))

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
```

- [ ] **Step 4: Update `packages/db/src/schema/index.ts`**

Add at the end:

```typescript
export * from './api-keys.js'
```

- [ ] **Step 5: Update `packages/db/src/client.ts`**

Add the import after the existing schema imports:

```typescript
import * as apiKeysSchema from './schema/api-keys.js'
```

Add to the schema object:

```typescript
const schema = {
	...guildsSchema,
	...usersSchema,
	...categoriesSchema,
	...panelsSchema,
	...ticketsSchema,
	...auditSchema,
	...rateLimitsSchema,
	...authSchema,
	...apiKeysSchema,
}
```

- [ ] **Step 6: Create permission seed script `packages/db/src/seed.ts`**

```typescript
import { eq } from 'drizzle-orm'
import { createDb } from './client.js'
import { permissions } from './schema/index.js'

const PERMISSION_SEEDS = [
	{ key: 'admin.manage_settings', description: 'Manage guild settings', category: 'admin' },
	{ key: 'admin.manage_categories', description: 'Manage ticket categories', category: 'admin' },
	{ key: 'admin.manage_panels', description: 'Manage ticket panels', category: 'admin' },
	{ key: 'admin.manage_roles', description: 'Manage role permissions', category: 'admin' },
	{ key: 'admin.view_audit_logs', description: 'View audit logs', category: 'admin' },
	{ key: 'admin.manage_api_keys', description: 'Manage API keys', category: 'admin' },
	{ key: 'tickets.view', description: 'View tickets', category: 'tickets' },
	{ key: 'tickets.manage', description: 'Manage ticket status, priority, assignment', category: 'tickets' },
	{ key: 'transcripts.view', description: 'View transcripts', category: 'transcripts' },
	{ key: 'transcripts.export', description: 'Export transcripts', category: 'transcripts' },
]

async function seed() {
	const db = createDb(process.env.DATABASE_URL ?? '')

	for (const perm of PERMISSION_SEEDS) {
		const existing = await db
			.select({ id: permissions.id })
			.from(permissions)
			.where(eq(permissions.key, perm.key))
			.limit(1)

		if (existing.length === 0) {
			await db.insert(permissions).values(perm)
			console.log(`Seeded permission: ${perm.key}`)
		} else {
			console.log(`Permission already exists: ${perm.key}`)
		}
	}

	console.log('Seed complete')
	process.exit(0)
}

seed().catch((err) => {
	console.error('Seed failed:', err)
	process.exit(1)
})
```

- [ ] **Step 7: Regenerate migration**

Run:
```bash
cd /data/github/ticket-bot && bun drizzle-kit generate
```

- [ ] **Step 8: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p packages/db/tsconfig.json && bunx tsc --noEmit -p packages/shared/tsconfig.json
```

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema/api-keys.ts packages/db/src/schema/index.ts packages/db/src/client.ts packages/db/src/seed.ts packages/shared/src/types/index.ts packages/shared/src/constants/plan-defaults.ts packages/db/migrations/
git commit -m "$(cat <<'EOF'
feat(db,shared): add api_keys schema, permission seeds, plan-defaults update

- New api_keys table with guild-scoped keys, permissions array, rate limit override
- Add ApiKeyPermission type and new AuditAction values to shared types
- Add apiRateLimitPerMinute to PLAN_DEFAULTS (free: 60, premium: 300)
- Permission seed script for dashboard RBAC keys
- Regenerate migration
EOF
)"
```

---

### Task 2: Core Lib — ApiError + Cursor Utilities

**Files:**
- Create: `apps/server/src/lib/api-error.ts`
- Create: `apps/server/src/lib/cursor.ts`

- [ ] **Step 1: Create `apps/server/src/lib/api-error.ts`**

```typescript
export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message)
		this.name = 'ApiError'
	}
}
```

- [ ] **Step 2: Create `apps/server/src/lib/cursor.ts`**

```typescript
import { type SQL, and, gt, lt } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { ApiError } from './api-error.js'

interface CursorData {
	id: number
	dir: 'next' | 'prev'
}

export function encodeCursor(id: number, dir: 'next' | 'prev' = 'next'): string {
	return Buffer.from(JSON.stringify({ id, dir })).toString('base64url')
}

export function decodeCursor(raw: string): CursorData {
	try {
		const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString())
		if (
			typeof parsed.id !== 'number' ||
			!Number.isInteger(parsed.id) ||
			parsed.id < 1 ||
			(parsed.dir !== 'next' && parsed.dir !== 'prev')
		) {
			throw new Error()
		}
		return { id: parsed.id, dir: parsed.dir }
	} catch {
		throw new ApiError(400, 'INVALID_CURSOR', 'Invalid cursor')
	}
}

export function cursorCondition(
	idColumn: PgColumn,
	cursor: CursorData | null,
): SQL | undefined {
	if (!cursor) return undefined
	return cursor.dir === 'next' ? gt(idColumn, cursor.id) : lt(idColumn, cursor.id)
}

export function clampLimit(input: number | undefined, defaultLimit = 50, maxLimit = 100): number {
	const limit = input ?? defaultLimit
	return Math.min(Math.max(1, limit), maxLimit)
}

export interface PaginatedResult<T> {
	data: T[]
	pagination: {
		cursor: string | null
		hasMore: boolean
		limit: number
	}
}

export function paginateResults<T extends { id: number }>(
	rows: T[],
	limit: number,
): PaginatedResult<T> {
	const hasMore = rows.length > limit
	const data = hasMore ? rows.slice(0, limit) : rows
	const lastItem = data[data.length - 1]
	return {
		data,
		pagination: {
			cursor: lastItem ? encodeCursor(lastItem.id) : null,
			hasMore,
			limit,
		},
	}
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/api-error.ts apps/server/src/lib/cursor.ts
git commit -m "$(cat <<'EOF'
feat(server): add ApiError class and cursor pagination utilities

- ApiError with status, code, message for consistent error responses
- Cursor encode/decode with strict validation (base64url, positive int, dir)
- cursorCondition helper for Drizzle WHERE clauses
- paginateResults helper for consistent response envelope
EOF
)"
```

---

### Task 3: Rate Limiter + API Key Middleware

**Files:**
- Create: `apps/server/src/lib/rate-limiter.ts`
- Create: `apps/server/src/middleware/api-key.ts`
- Create: `apps/server/src/middleware/api-key-guard.ts`

- [ ] **Step 1: Create `apps/server/src/lib/rate-limiter.ts`**

```typescript
interface RateLimitEntry {
	timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000
const CLEANUP_INTERVAL_MS = 5 * 60_000
const STALE_THRESHOLD_MS = 10 * 60_000

export function checkRateLimit(
	key: string,
	limit: number,
): { allowed: boolean; remaining: number; resetAt: number; retryAfter: number } {
	const now = Date.now()
	const windowStart = now - WINDOW_MS

	let entry = store.get(key)
	if (!entry) {
		entry = { timestamps: [] }
		store.set(key, entry)
	}

	entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

	if (entry.timestamps.length >= limit) {
		const oldestInWindow = entry.timestamps[0] ?? now
		const resetAt = oldestInWindow + WINDOW_MS
		const retryAfter = Math.ceil((resetAt - now) / 1000)
		return {
			allowed: false,
			remaining: 0,
			resetAt: Math.ceil(resetAt / 1000),
			retryAfter,
		}
	}

	entry.timestamps.push(now)
	return {
		allowed: true,
		remaining: limit - entry.timestamps.length,
		resetAt: Math.ceil((now + WINDOW_MS) / 1000),
		retryAfter: 0,
	}
}

export function startRateLimitCleanup(): NodeJS.Timeout {
	return setInterval(() => {
		const now = Date.now()
		for (const [key, entry] of store) {
			const newest = entry.timestamps[entry.timestamps.length - 1] ?? 0
			if (now - newest > STALE_THRESHOLD_MS) {
				store.delete(key)
			}
		}
	}, CLEANUP_INTERVAL_MS)
}
```

- [ ] **Step 2: Create `apps/server/src/middleware/api-key.ts`**

```typescript
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
```

- [ ] **Step 3: Create `apps/server/src/middleware/api-key-guard.ts`**

```typescript
import { ApiError } from '../lib/api-error.js'

export function checkKeyPermission(required: string) {
	// biome-ignore lint/suspicious/noExplicitAny: apiKey is injected by apiKeyPlugin derive
	return ({ apiKey }: any) => {
		if (!apiKey.permissions.includes(required)) {
			throw new ApiError(403, 'FORBIDDEN', `API key lacks required permission: ${required}`)
		}
	}
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/rate-limiter.ts apps/server/src/middleware/api-key.ts apps/server/src/middleware/api-key-guard.ts
git commit -m "$(cat <<'EOF'
feat(server): add rate limiter and API key auth middleware

- In-memory sliding window rate limiter with 5min cleanup interval
- API key auth derive plugin: validates key, checks expiry, enforces rate limit
- API key permission guard: checks key has required permission string
- Rate limit headers on all /v1 responses (X-RateLimit-Limit/Remaining/Reset)
EOF
)"
```

---

### Task 4: Guild Service + Dashboard Routes

**Files:**
- Create: `apps/server/src/services/guild.ts`
- Create: `apps/server/src/routes/api/guilds.ts`
- Create: `apps/server/src/routes/api/user.ts`

- [ ] **Step 1: Create `apps/server/src/services/guild.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { guildMembers, guildSettings, guilds } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listUserGuilds(db: Database, userId: string) {
	const rows = await db
		.select({
			id: guilds.id,
			discordId: guilds.discordId,
			name: guilds.name,
			iconUrl: guilds.iconUrl,
			planTier: guilds.planTier,
		})
		.from(guildMembers)
		.innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
		.where(eq(guildMembers.userId, userId))

	return rows
}

export async function getGuildDetails(db: Database, guildId: number, userId: string) {
	// Verify membership
	const member = await db
		.select({ id: guildMembers.id })
		.from(guildMembers)
		.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
		.limit(1)

	if (!member[0]) {
		throw new ApiError(403, 'NOT_A_MEMBER', 'You are not a member of this guild')
	}

	const guildRows = await db
		.select()
		.from(guilds)
		.where(eq(guilds.id, guildId))
		.limit(1)

	const guild = guildRows[0]
	if (!guild) {
		throw new ApiError(404, 'GUILD_NOT_FOUND', 'Guild not found')
	}

	const settingsRows = await db
		.select()
		.from(guildSettings)
		.where(eq(guildSettings.guildId, guildId))
		.limit(1)

	return { ...guild, settings: settingsRows[0] ?? null }
}

export async function updateGuildSettings(
	db: Database,
	guildId: number,
	updates: {
		logChannelId?: string | null
		transcriptChannelId?: string | null
		locale?: string
		timezone?: string
		autoCloseHours?: number | null
		transcriptRetentionDays?: number
		ticketCooldownSeconds?: number
	},
) {
	const rows = await db
		.update(guildSettings)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(guildSettings.guildId, guildId))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'SETTINGS_NOT_FOUND', 'Guild settings not found')
	}

	return row
}
```

- [ ] **Step 2: Create `apps/server/src/routes/api/guilds.ts`**

```typescript
import { resolveUserPermissions } from '@ticketbot/auth'
import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { getGuildDetails, listUserGuilds, updateGuildSettings } from '../../services/guild.js'

export function guildRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user }: any) => {
				const guilds = await listUserGuilds(db, user.id)
				return { data: guilds }
			},
			{ auth: true },
		)
		.get(
			'/:guildId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, params }: any) => {
				const guildId = Number(params.guildId)
				const guild = await getGuildDetails(db, guildId, user.id)
				return { data: guild }
			},
			{
				auth: true,
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.put(
			'/:guildId/settings',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, params, body }: any) => {
				const guildId = Number(params.guildId)
				const settings = await updateGuildSettings(db, guildId, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'settings.updated',
					metadata: { changes: Object.keys(body) },
				})
				return { data: settings }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_settings']),
				params: t.Object({ guildId: t.Numeric() }),
				body: t.Object({
					logChannelId: t.Optional(t.Union([t.String(), t.Null()])),
					transcriptChannelId: t.Optional(t.Union([t.String(), t.Null()])),
					locale: t.Optional(t.String()),
					timezone: t.Optional(t.String()),
					autoCloseHours: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
					transcriptRetentionDays: t.Optional(t.Integer({ minimum: 1, maximum: 365 })),
					ticketCooldownSeconds: t.Optional(t.Integer({ minimum: 0, maximum: 3600 })),
				}),
			},
		)
}
```

- [ ] **Step 3: Create `apps/server/src/routes/api/user.ts`**

```typescript
import { syncUserGuilds } from '@ticketbot/auth'
import type { Database } from '@ticketbot/db'
import { Elysia } from 'elysia'

export function userRoutes(db: Database) {
	return new Elysia({ prefix: '/user' })
		.get(
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
			{ auth: true },
		)
		.post(
			'/guilds/refresh',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user }: any) => {
				await syncUserGuilds(db, user.id)
				return { success: true }
			},
			{ auth: true },
		)
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/guild.ts apps/server/src/routes/api/guilds.ts apps/server/src/routes/api/user.ts
git commit -m "$(cat <<'EOF'
feat(server): add guild service and dashboard routes for guilds/settings/user

- Guild service: listUserGuilds, getGuildDetails, updateGuildSettings
- Dashboard routes: GET/PUT guilds, guild settings, user/me, guilds/refresh
- Permission guard on settings update (admin.manage_settings)
- Audit log on settings changes
EOF
)"
```

---

### Task 5: Category Service + Dashboard Routes

**Files:**
- Create: `apps/server/src/services/category.ts`
- Create: `apps/server/src/routes/api/categories.ts`

- [ ] **Step 1: Create `apps/server/src/services/category.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { categories, categoryRoleAccess, discordRoles } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listCategories(db: Database, guildId: number) {
	const rows = await db
		.select()
		.from(categories)
		.where(eq(categories.guildId, guildId))
		.orderBy(categories.position)

	return rows
}

export async function getCategory(db: Database, guildId: number, categoryId: number) {
	const rows = await db
		.select()
		.from(categories)
		.where(and(eq(categories.id, categoryId), eq(categories.guildId, guildId)))
		.limit(1)

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found')
	}

	const roleAccess = await db
		.select({
			id: categoryRoleAccess.id,
			discordRoleId: categoryRoleAccess.discordRoleId,
			accessType: categoryRoleAccess.accessType,
			roleName: discordRoles.name,
			roleColor: discordRoles.color,
		})
		.from(categoryRoleAccess)
		.innerJoin(discordRoles, eq(categoryRoleAccess.discordRoleId, discordRoles.id))
		.where(eq(categoryRoleAccess.categoryId, categoryId))

	return { ...row, roleAccess }
}

export async function createCategory(
	db: Database,
	guildId: number,
	data: {
		name: string
		description?: string
		emoji?: string
		maxOpenPerUser?: number
	},
) {
	const rows = await db
		.insert(categories)
		.values({
			guildId,
			name: data.name,
			description: data.description,
			emoji: data.emoji,
			maxOpenPerUser: data.maxOpenPerUser ?? 1,
		})
		.returning()

	return rows[0]!
}

export async function updateCategory(
	db: Database,
	guildId: number,
	categoryId: number,
	data: {
		name?: string
		description?: string | null
		emoji?: string | null
		maxOpenPerUser?: number
		isEnabled?: boolean
		position?: number
		targetChannelId?: string | null
		autoCloseHours?: number | null
	},
) {
	const rows = await db
		.update(categories)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(categories.id, categoryId), eq(categories.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found')
	}

	return row
}

export async function deleteCategory(db: Database, guildId: number, categoryId: number) {
	const rows = await db
		.delete(categories)
		.where(and(eq(categories.id, categoryId), eq(categories.guildId, guildId)))
		.returning({ id: categories.id })

	if (!rows[0]) {
		throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found')
	}
}
```

- [ ] **Step 2: Create `apps/server/src/routes/api/categories.ts`**

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/category.ts apps/server/src/routes/api/categories.ts
git commit -m "$(cat <<'EOF'
feat(server): add category service and dashboard CRUD routes

- Category service: list, get (with role access), create, update, delete
- Dashboard routes with admin.manage_categories permission guard
- Audit logging on create/update/delete
EOF
)"
```

---

### Task 6: Panel Service + Dashboard Routes

**Files:**
- Create: `apps/server/src/services/panel.ts`
- Create: `apps/server/src/routes/api/panels.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Install `@discordjs/rest` and `discord-api-types`**

Run:
```bash
cd /data/github/ticket-bot/apps/server && bun add @discordjs/rest discord-api-types
```

- [ ] **Step 2: Create `apps/server/src/services/panel.ts`**

```typescript
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import type { Database } from '@ticketbot/db'
import { panelButtons, panels } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listPanels(db: Database, guildId: number) {
	const rows = await db
		.select()
		.from(panels)
		.where(eq(panels.guildId, guildId))
		.orderBy(panels.createdAt)

	return rows
}

export async function getPanel(db: Database, guildId: number, panelId: number) {
	const rows = await db
		.select()
		.from(panels)
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.limit(1)

	const panel = rows[0]
	if (!panel) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}

	const buttons = await db
		.select()
		.from(panelButtons)
		.where(eq(panelButtons.panelId, panelId))
		.orderBy(panelButtons.position)

	return { ...panel, buttons }
}

export async function createPanel(
	db: Database,
	guildId: number,
	data: {
		name: string
		embedTitle?: string
		embedDescription?: string
		embedColor?: number
		embedThumbnailUrl?: string
		embedFooterText?: string
	},
) {
	const rows = await db
		.insert(panels)
		.values({ guildId, ...data })
		.returning()

	return rows[0]!
}

export async function updatePanel(
	db: Database,
	guildId: number,
	panelId: number,
	data: {
		name?: string
		embedTitle?: string | null
		embedDescription?: string | null
		embedColor?: number | null
		embedThumbnailUrl?: string | null
		embedFooterText?: string | null
	},
) {
	const rows = await db
		.update(panels)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}

	return row
}

export async function deletePanel(db: Database, guildId: number, panelId: number) {
	const rows = await db
		.delete(panels)
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.returning({ id: panels.id })

	if (!rows[0]) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}
}

export async function deployPanel(db: Database, guildId: number, panelId: number) {
	const rows = await db
		.select()
		.from(panels)
		.where(and(eq(panels.id, panelId), eq(panels.guildId, guildId)))
		.limit(1)

	const panel = rows[0]
	if (!panel) {
		throw new ApiError(404, 'PANEL_NOT_FOUND', 'Panel not found')
	}

	if (!panel.channelId) {
		throw new ApiError(400, 'NO_CHANNEL', 'Panel has no target channel set')
	}

	const buttons = await db
		.select()
		.from(panelButtons)
		.where(eq(panelButtons.panelId, panelId))
		.orderBy(panelButtons.position)

	if (buttons.length === 0) {
		throw new ApiError(400, 'NO_BUTTONS', 'Panel has no buttons configured')
	}

	const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN ?? '')

	const embed = {
		title: panel.embedTitle ?? panel.name,
		description: panel.embedDescription ?? undefined,
		color: panel.embedColor ?? undefined,
		thumbnail: panel.embedThumbnailUrl ? { url: panel.embedThumbnailUrl } : undefined,
		footer: panel.embedFooterText ? { text: panel.embedFooterText } : undefined,
	}

	const components = [
		{
			type: 1, // ActionRow
			components: buttons.map((btn) => ({
				type: 2, // Button
				style: btn.style === 'primary' ? 1 : btn.style === 'secondary' ? 2 : btn.style === 'success' ? 3 : 4,
				label: btn.label,
				emoji: btn.emoji ? { name: btn.emoji } : undefined,
				custom_id: `panel_btn_${btn.categoryId}`,
			})),
		},
	]

	const message = (await rest.post(Routes.channelMessages(panel.channelId), {
		body: { embeds: [embed], components },
	})) as { id: string }

	// Update panel with messageId and mark as published
	await db
		.update(panels)
		.set({ messageId: message.id, isPublished: true, updatedAt: new Date() })
		.where(eq(panels.id, panelId))

	return { messageId: message.id }
}
```

- [ ] **Step 3: Create `apps/server/src/routes/api/panels.ts`**

```typescript
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
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/panel.ts apps/server/src/routes/api/panels.ts apps/server/package.json
git commit -m "$(cat <<'EOF'
feat(server): add panel service with Discord deploy and dashboard routes

- Panel service: list, get (with buttons), create, update, delete, deploy
- Deploy sends embed + buttons to Discord via @discordjs/rest
- Dashboard routes with admin.manage_panels permission guard
- Audit logging on all mutations including deploy
EOF
)"
```

---

### Task 7: Ticket Service + Dashboard Routes

**Files:**
- Create: `apps/server/src/services/ticket.ts`
- Create: `apps/server/src/routes/api/tickets.ts`

- [ ] **Step 1: Create `apps/server/src/services/ticket.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import {
	categories,
	ticketMessages,
	tickets,
	users,
} from '@ticketbot/db'
import { type SQL, and, desc, eq, inArray, sql } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'
import {
	type PaginatedResult,
	clampLimit,
	cursorCondition,
	decodeCursor,
	paginateResults,
} from '../lib/cursor.js'

interface TicketFilters {
	status?: string
	priority?: string
	categoryId?: number
	assignedToId?: string
	cursor?: string
	limit?: number
}

export async function listTickets(
	db: Database,
	guildId: number,
	filters: TicketFilters,
): Promise<PaginatedResult<Record<string, unknown>>> {
	const limit = clampLimit(filters.limit)
	const conditions: SQL[] = [eq(tickets.guildId, guildId)]

	if (filters.status) conditions.push(eq(tickets.status, filters.status))
	if (filters.priority) conditions.push(eq(tickets.priority, filters.priority))
	if (filters.categoryId) conditions.push(eq(tickets.categoryId, filters.categoryId))
	if (filters.assignedToId) conditions.push(eq(tickets.assignedToId, filters.assignedToId))

	if (filters.cursor) {
		const cursor = decodeCursor(filters.cursor)
		const cond = cursorCondition(tickets.id, cursor)
		if (cond) conditions.push(cond)
	}

	const rows = await db
		.select({
			id: tickets.id,
			ticketNumber: tickets.ticketNumber,
			subject: tickets.subject,
			status: tickets.status,
			priority: tickets.priority,
			channelId: tickets.channelId,
			creatorId: tickets.creatorId,
			assignedToId: tickets.assignedToId,
			categoryId: tickets.categoryId,
			categoryName: categories.name,
			createdAt: tickets.createdAt,
			updatedAt: tickets.updatedAt,
			closedAt: tickets.closedAt,
		})
		.from(tickets)
		.leftJoin(categories, eq(tickets.categoryId, categories.id))
		.where(and(...conditions))
		.orderBy(tickets.id)
		.limit(limit + 1)

	return paginateResults(rows, limit)
}

export async function getTicketDetail(db: Database, guildId: number, ticketId: number) {
	const rows = await db
		.select({
			id: tickets.id,
			ticketNumber: tickets.ticketNumber,
			subject: tickets.subject,
			status: tickets.status,
			priority: tickets.priority,
			channelId: tickets.channelId,
			creatorId: tickets.creatorId,
			assignedToId: tickets.assignedToId,
			closedById: tickets.closedById,
			closeReason: tickets.closeReason,
			categoryId: tickets.categoryId,
			categoryName: categories.name,
			reopenedCount: tickets.reopenedCount,
			firstResponseAt: tickets.firstResponseAt,
			closedAt: tickets.closedAt,
			createdAt: tickets.createdAt,
			updatedAt: tickets.updatedAt,
		})
		.from(tickets)
		.leftJoin(categories, eq(tickets.categoryId, categories.id))
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.limit(1)

	const ticket = rows[0]
	if (!ticket) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	// Fetch messages with user info
	const messages = await db
		.select({
			id: ticketMessages.id,
			content: ticketMessages.content,
			isStaff: ticketMessages.isStaff,
			isInternalNote: ticketMessages.isInternalNote,
			attachments: ticketMessages.attachments,
			createdAt: ticketMessages.createdAt,
			userId: ticketMessages.userId,
			username: users.username,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl,
		})
		.from(ticketMessages)
		.innerJoin(users, eq(ticketMessages.userId, users.id))
		.where(eq(ticketMessages.ticketId, ticketId))
		.orderBy(ticketMessages.createdAt)

	return { ...ticket, messages }
}

export async function updateTicketStatus(
	db: Database,
	guildId: number,
	ticketId: number,
	status: string,
) {
	const rows = await db
		.update(tickets)
		.set({ status, updatedAt: new Date() })
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	return row
}

export async function updateTicketPriority(
	db: Database,
	guildId: number,
	ticketId: number,
	priority: string,
) {
	const rows = await db
		.update(tickets)
		.set({ priority, updatedAt: new Date() })
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	return row
}

export async function assignTicket(
	db: Database,
	guildId: number,
	ticketId: number,
	assignedToId: string | null,
) {
	const rows = await db
		.update(tickets)
		.set({ assignedToId, updatedAt: new Date() })
		.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
	}

	return row
}
```

- [ ] **Step 2: Create `apps/server/src/routes/api/tickets.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import {
	assignTicket,
	getTicketDetail,
	listTickets,
	updateTicketPriority,
	updateTicketStatus,
} from '../../services/ticket.js'

export function ticketRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/tickets' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, query }: any) => {
				const guildId = Number(params.guildId)
				return listTickets(db, guildId, {
					status: query.status,
					priority: query.priority,
					categoryId: query.categoryId ? Number(query.categoryId) : undefined,
					assignedToId: query.assignedToId,
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.view']),
				params: t.Object({ guildId: t.Numeric() }),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
					status: t.Optional(t.String()),
					priority: t.Optional(t.String()),
					categoryId: t.Optional(t.Numeric()),
					assignedToId: t.Optional(t.String()),
				}),
			},
		)
		.get(
			'/:ticketId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await getTicketDetail(db, guildId, ticketId)
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.view']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
			},
		)
		.put(
			'/:ticketId/status',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketStatus(db, guildId, ticketId, body.status)
				await db.insert(auditLogs).values({
					guildId,
					ticketId,
					actorId: user.id,
					actorType: 'user',
					action: 'ticket.status_changed',
					metadata: { field: 'status', new: body.status },
				})
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.manage']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
				body: t.Object({
					status: t.Union([
						t.Literal('open'),
						t.Literal('pending'),
						t.Literal('waiting_user'),
						t.Literal('waiting_staff'),
						t.Literal('escalated'),
						t.Literal('resolved'),
					]),
				}),
			},
		)
		.put(
			'/:ticketId/priority',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketPriority(db, guildId, ticketId, body.priority)
				await db.insert(auditLogs).values({
					guildId,
					ticketId,
					actorId: user.id,
					actorType: 'user',
					action: 'ticket.status_changed',
					metadata: { field: 'priority', new: body.priority },
				})
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.manage']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
				body: t.Object({
					priority: t.Union([
						t.Literal('low'),
						t.Literal('normal'),
						t.Literal('high'),
						t.Literal('urgent'),
					]),
				}),
			},
		)
		.put(
			'/:ticketId/assign',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const ticketId = Number(params.ticketId)
				const ticket = await assignTicket(db, guildId, ticketId, body.assignedToId)
				await db.insert(auditLogs).values({
					guildId,
					ticketId,
					actorId: user.id,
					actorType: 'user',
					action: 'ticket.reassigned',
					metadata: { assignedToId: body.assignedToId },
				})
				return { data: ticket }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['tickets.manage']),
				params: t.Object({ guildId: t.Numeric(), ticketId: t.Numeric() }),
				body: t.Object({
					assignedToId: t.Union([t.String(), t.Null()]),
				}),
			},
		)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/ticket.ts apps/server/src/routes/api/tickets.ts
git commit -m "$(cat <<'EOF'
feat(server): add ticket service with cursor pagination and dashboard routes

- Ticket service: list (cursor + filters), get detail (with messages), status/priority/assign
- Cursor pagination with encode/decode/validate pipeline
- Dashboard routes with tickets.view and tickets.manage permission guards
- Audit logging on status changes, priority changes, and reassignment
EOF
)"
```

---

### Task 8: Transcript Service + Dashboard Routes

**Files:**
- Create: `apps/server/src/services/transcript.ts`
- Create: `apps/server/src/routes/api/transcripts.ts`

- [ ] **Step 1: Create `apps/server/src/services/transcript.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { tickets, transcripts } from '@ticketbot/db'
import { type SQL, and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'
import {
	type PaginatedResult,
	clampLimit,
	cursorCondition,
	decodeCursor,
	paginateResults,
} from '../lib/cursor.js'

interface TranscriptFilters {
	cursor?: string
	limit?: number
}

export async function listTranscripts(
	db: Database,
	guildId: number,
	filters: TranscriptFilters,
): Promise<PaginatedResult<Record<string, unknown>>> {
	const limit = clampLimit(filters.limit)
	const conditions: SQL[] = [eq(transcripts.guildId, guildId)]

	if (filters.cursor) {
		const cursor = decodeCursor(filters.cursor)
		const cond = cursorCondition(transcripts.id, cursor)
		if (cond) conditions.push(cond)
	}

	const rows = await db
		.select({
			id: transcripts.id,
			ticketId: transcripts.ticketId,
			ticketNumber: tickets.ticketNumber,
			messageCount: transcripts.messageCount,
			participants: transcripts.participants,
			metadata: transcripts.metadata,
			expiresAt: transcripts.expiresAt,
			createdAt: transcripts.createdAt,
		})
		.from(transcripts)
		.innerJoin(tickets, eq(transcripts.ticketId, tickets.id))
		.where(and(...conditions))
		.orderBy(transcripts.id)
		.limit(limit + 1)

	return paginateResults(rows, limit)
}

export async function getTranscript(db: Database, guildId: number, transcriptId: number) {
	const rows = await db
		.select()
		.from(transcripts)
		.where(and(eq(transcripts.id, transcriptId), eq(transcripts.guildId, guildId)))
		.limit(1)

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'TRANSCRIPT_NOT_FOUND', 'Transcript not found')
	}

	return row
}

export async function exportTranscript(
	db: Database,
	guildId: number,
	transcriptId: number,
	format: 'json' | 'html',
) {
	const transcript = await getTranscript(db, guildId, transcriptId)

	if (format === 'json') {
		return {
			contentType: 'application/json',
			data: JSON.stringify({
				ticketId: transcript.ticketId,
				messages: transcript.messages,
				participants: transcript.participants,
				metadata: transcript.metadata,
				createdAt: transcript.createdAt,
			}),
		}
	}

	// HTML format — simple readable transcript
	const messages = transcript.messages as Array<{
		username: string
		content: string
		timestamp: string
		isStaff: boolean
	}>

	const meta = transcript.metadata as Record<string, unknown>
	const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Transcript</title>
<style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px}
.msg{margin:10px 0;padding:10px;border-radius:4px;background:#f5f5f5}
.staff{background:#e8f0fe}.meta{color:#666;font-size:12px}
.header{border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:20px}</style></head>
<body><div class="header"><h1>Transcript</h1>
<p>Category: ${meta.category ?? 'Unknown'} | Messages: ${transcript.messageCount} | Created: ${transcript.createdAt?.toISOString()}</p></div>
${messages.map((m) => `<div class="msg${m.isStaff ? ' staff' : ''}"><div class="meta">${m.username} — ${m.timestamp}</div><p>${m.content}</p></div>`).join('\n')}
</body></html>`

	return { contentType: 'text/html', data: html }
}
```

- [ ] **Step 2: Create `apps/server/src/routes/api/transcripts.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { exportTranscript, getTranscript, listTranscripts } from '../../services/transcript.js'

export function transcriptRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/transcripts' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, query }: any) => {
				const guildId = Number(params.guildId)
				return listTranscripts(db, guildId, {
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['transcripts.view']),
				params: t.Object({ guildId: t.Numeric() }),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				}),
			},
		)
		.get(
			'/:transcriptId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const transcriptId = Number(params.transcriptId)
				const transcript = await getTranscript(db, guildId, transcriptId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'transcript.viewed',
					metadata: { transcriptId },
				})
				return { data: transcript }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['transcripts.view']),
				params: t.Object({ guildId: t.Numeric(), transcriptId: t.Numeric() }),
			},
		)
		.get(
			'/:transcriptId/export',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, query, user, set }: any) => {
				const guildId = Number(params.guildId)
				const transcriptId = Number(params.transcriptId)
				const format = (query.format ?? 'json') as 'json' | 'html'
				const result = await exportTranscript(db, guildId, transcriptId, format)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'transcript.exported',
					metadata: { transcriptId, format },
				})
				set.headers['content-type'] = result.contentType
				return result.data
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['transcripts.export']),
				params: t.Object({ guildId: t.Numeric(), transcriptId: t.Numeric() }),
				query: t.Object({
					format: t.Optional(t.Union([t.Literal('json'), t.Literal('html')])),
				}),
			},
		)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/transcript.ts apps/server/src/routes/api/transcripts.ts
git commit -m "$(cat <<'EOF'
feat(server): add transcript service with export and dashboard routes

- Transcript service: list (cursor), get, export (JSON/HTML)
- HTML export with styled readable format
- Dashboard routes with transcripts.view and transcripts.export guards
- Audit logging on view and export
EOF
)"
```

---

### Task 9: Role + Audit Log Services + Dashboard Routes

**Files:**
- Create: `apps/server/src/services/role.ts`
- Create: `apps/server/src/services/audit-log.ts`
- Create: `apps/server/src/routes/api/roles.ts`
- Create: `apps/server/src/routes/api/audit-logs.ts`

- [ ] **Step 1: Create `apps/server/src/services/role.ts`**

```typescript
import { syncGuildRoles } from '@ticketbot/auth'
import type { Database } from '@ticketbot/db'
import { discordRoles, guilds, permissions, rolePermissions } from '@ticketbot/db'
import { and, eq, inArray } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listRolesWithPermissions(db: Database, guildId: number) {
	const roles = await db
		.select()
		.from(discordRoles)
		.where(eq(discordRoles.guildId, guildId))
		.orderBy(discordRoles.position)

	const roleIds = roles.map((r) => r.id)
	if (roleIds.length === 0) return []

	const rolePerms = await db
		.select({
			discordRoleId: rolePermissions.discordRoleId,
			permissionId: rolePermissions.permissionId,
			permissionKey: permissions.key,
			permissionDescription: permissions.description,
			permissionCategory: permissions.category,
		})
		.from(rolePermissions)
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(inArray(rolePermissions.discordRoleId, roleIds))

	const permsByRole = new Map<number, typeof rolePerms>()
	for (const rp of rolePerms) {
		const existing = permsByRole.get(rp.discordRoleId) ?? []
		existing.push(rp)
		permsByRole.set(rp.discordRoleId, existing)
	}

	return roles.map((role) => ({
		...role,
		permissions: (permsByRole.get(role.id) ?? []).map((p) => ({
			id: p.permissionId,
			key: p.permissionKey,
			description: p.permissionDescription,
			category: p.permissionCategory,
		})),
	}))
}

export async function updateRolePermissions(
	db: Database,
	guildId: number,
	roleId: number,
	permissionKeys: string[],
) {
	// Verify role belongs to guild
	const roleRows = await db
		.select({ id: discordRoles.id })
		.from(discordRoles)
		.where(and(eq(discordRoles.id, roleId), eq(discordRoles.guildId, guildId)))
		.limit(1)

	if (!roleRows[0]) {
		throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found')
	}

	// Resolve permission IDs
	const permRows = await db
		.select({ id: permissions.id, key: permissions.key })
		.from(permissions)
		.where(inArray(permissions.key, permissionKeys))

	const foundKeys = new Set(permRows.map((p) => p.key))
	const missing = permissionKeys.filter((k) => !foundKeys.has(k))
	if (missing.length > 0) {
		throw new ApiError(400, 'INVALID_PERMISSIONS', `Unknown permission keys: ${missing.join(', ')}`)
	}

	// Delete existing and insert new
	await db.delete(rolePermissions).where(eq(rolePermissions.discordRoleId, roleId))

	if (permRows.length > 0) {
		await db.insert(rolePermissions).values(
			permRows.map((p) => ({
				discordRoleId: roleId,
				permissionId: p.id,
			})),
		)
	}

	return { roleId, permissions: permissionKeys }
}

export async function refreshGuildRoles(db: Database, guildId: number) {
	const guildRows = await db
		.select({ discordId: guilds.discordId })
		.from(guilds)
		.where(eq(guilds.id, guildId))
		.limit(1)

	const guild = guildRows[0]
	if (!guild) {
		throw new ApiError(404, 'GUILD_NOT_FOUND', 'Guild not found')
	}

	await syncGuildRoles(db, guildId, guild.discordId)
}
```

- [ ] **Step 2: Create `apps/server/src/services/audit-log.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { auditLogs, users } from '@ticketbot/db'
import { type SQL, and, eq } from 'drizzle-orm'
import {
	type PaginatedResult,
	clampLimit,
	cursorCondition,
	decodeCursor,
	paginateResults,
} from '../lib/cursor.js'

interface AuditLogFilters {
	action?: string
	actorId?: string
	cursor?: string
	limit?: number
}

export async function listAuditLogs(
	db: Database,
	guildId: number,
	filters: AuditLogFilters,
): Promise<PaginatedResult<Record<string, unknown>>> {
	const limit = clampLimit(filters.limit)
	const conditions: SQL[] = [eq(auditLogs.guildId, guildId)]

	if (filters.action) conditions.push(eq(auditLogs.action, filters.action))
	if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId))

	if (filters.cursor) {
		const cursor = decodeCursor(filters.cursor)
		const cond = cursorCondition(auditLogs.id, cursor)
		if (cond) conditions.push(cond)
	}

	const rows = await db
		.select({
			id: auditLogs.id,
			ticketId: auditLogs.ticketId,
			actorId: auditLogs.actorId,
			actorDiscordId: auditLogs.actorDiscordId,
			actorType: auditLogs.actorType,
			action: auditLogs.action,
			metadata: auditLogs.metadata,
			createdAt: auditLogs.createdAt,
			actorUsername: users.username,
			actorDisplayName: users.displayName,
		})
		.from(auditLogs)
		.leftJoin(users, eq(auditLogs.actorId, users.id))
		.where(and(...conditions))
		.orderBy(auditLogs.id)
		.limit(limit + 1)

	return paginateResults(rows, limit)
}
```

- [ ] **Step 3: Create `apps/server/src/routes/api/roles.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { listRolesWithPermissions, refreshGuildRoles, updateRolePermissions } from '../../services/role.js'

export function roleRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/roles' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const roles = await listRolesWithPermissions(db, guildId)
				return { data: roles }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_roles']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.put(
			'/:roleId/permissions',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const roleId = Number(params.roleId)
				const result = await updateRolePermissions(db, guildId, roleId, body.permissions)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'role.permissions_updated',
					metadata: { roleId, permissions: body.permissions },
				})
				return { data: result }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_roles']),
				params: t.Object({ guildId: t.Numeric(), roleId: t.Numeric() }),
				body: t.Object({
					permissions: t.Array(t.String()),
				}),
			},
		)
		.post(
			'/refresh',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				await refreshGuildRoles(db, guildId)
				return { success: true }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_roles']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
}
```

- [ ] **Step 4: Create `apps/server/src/routes/api/audit-logs.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { listAuditLogs } from '../../services/audit-log.js'

export function auditLogRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/audit-logs' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, query }: any) => {
				const guildId = Number(params.guildId)
				return listAuditLogs(db, guildId, {
					action: query.action,
					actorId: query.actorId,
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.view_audit_logs']),
				params: t.Object({ guildId: t.Numeric() }),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
					action: t.Optional(t.String()),
					actorId: t.Optional(t.String()),
				}),
			},
		)
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/role.ts apps/server/src/services/audit-log.ts apps/server/src/routes/api/roles.ts apps/server/src/routes/api/audit-logs.ts
git commit -m "$(cat <<'EOF'
feat(server): add role and audit log services with dashboard routes

- Role service: list with permissions, update role permissions, refresh from Discord
- Audit log service: list with cursor pagination and action/actor filters
- Dashboard routes with admin.manage_roles and admin.view_audit_logs guards
- Audit logging on role permission changes
EOF
)"
```

---

### Task 10: API Key Service + Dashboard Routes

**Files:**
- Create: `apps/server/src/services/api-key.ts`
- Create: `apps/server/src/routes/api/api-keys.ts`

- [ ] **Step 1: Create `apps/server/src/services/api-key.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { apiKeys } from '@ticketbot/db'
import { API_KEY_PERMISSIONS } from '@ticketbot/shared'
import type { ApiKeyPermission } from '@ticketbot/shared'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

function sha256(input: string): string {
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(input)
	return hasher.digest('hex')
}

function generateKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32))
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
	data: {
		name: string
		permissions: string[]
		rateLimitPerMinute?: number
		expiresInDays?: number
	},
) {
	// Validate permissions
	for (const perm of data.permissions) {
		if (!API_KEY_PERMISSIONS.includes(perm as ApiKeyPermission)) {
			throw new ApiError(400, 'INVALID_PERMISSION', `Unknown API key permission: ${perm}`)
		}
	}

	const key = generateKey()
	const hash = sha256(key)
	const prefix = key.slice(0, 11) // "tk_" + first 8 hex chars

	const expiresAt = data.expiresInDays
		? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
		: null

	const rows = await db
		.insert(apiKeys)
		.values({
			guildId,
			createdById,
			name: data.name,
			keyHash: hash,
			keyPrefix: prefix,
			permissions: data.permissions,
			rateLimitPerMinute: data.rateLimitPerMinute ?? null,
			expiresAt,
		})
		.returning()

	return {
		...rows[0]!,
		key, // Only returned once
	}
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

	const newKey = generateKey()
	const newHash = sha256(newKey)
	const newPrefix = newKey.slice(0, 11)

	await db
		.update(apiKeys)
		.set({ keyHash: newHash, keyPrefix: newPrefix })
		.where(eq(apiKeys.id, keyId))

	return { key: newKey, keyPrefix: newPrefix }
}
```

- [ ] **Step 2: Create `apps/server/src/routes/api/api-keys.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from '../../services/api-key.js'

export function apiKeyRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/api-keys' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const keys = await listApiKeys(db, guildId)
				return { data: keys }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.post(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const result = await createApiKey(db, guildId, user.id, body)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'api_key.created',
					metadata: { keyId: result.id, name: result.name, permissions: result.permissions },
				})
				return { data: result }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric() }),
				body: t.Object({
					name: t.String({ minLength: 1, maxLength: 100 }),
					permissions: t.Array(t.String(), { minItems: 1 }),
					rateLimitPerMinute: t.Optional(t.Integer({ minimum: 1, maximum: 1000 })),
					expiresInDays: t.Optional(t.Union([
						t.Literal(30),
						t.Literal(90),
						t.Literal(365),
					])),
				}),
			},
		)
		.post(
			'/:keyId/rotate',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const keyId = Number(params.keyId)
				const result = await rotateApiKey(db, guildId, keyId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'api_key.rotated',
					metadata: { keyId },
				})
				return { data: result }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric(), keyId: t.Numeric() }),
			},
		)
		.delete(
			'/:keyId',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, user }: any) => {
				const guildId = Number(params.guildId)
				const keyId = Number(params.keyId)
				await revokeApiKey(db, guildId, keyId)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'api_key.revoked',
					metadata: { keyId },
				})
				return { success: true }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_api_keys']),
				params: t.Object({ guildId: t.Numeric(), keyId: t.Numeric() }),
			},
		)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/api-key.ts apps/server/src/routes/api/api-keys.ts
git commit -m "$(cat <<'EOF'
feat(server): add API key service with create/list/revoke/rotate and dashboard routes

- API key service: generate tk_ keys, SHA-256 hash storage, permission validation
- Create returns key once, list returns masked (prefix only)
- Rotate replaces hash in-place keeping key ID stable
- Revoke is hard delete
- Dashboard routes with admin.manage_api_keys permission guard
- Audit logging on create/rotate/revoke
EOF
)"
```

---

### Task 11: Public API Routes

**Files:**
- Create: `apps/server/src/routes/v1/guild.ts`
- Create: `apps/server/src/routes/v1/categories.ts`
- Create: `apps/server/src/routes/v1/tickets.ts`
- Create: `apps/server/src/routes/v1/transcripts.ts`
- Create: `apps/server/src/routes/v1/audit-logs.ts`

- [ ] **Step 1: Create `apps/server/src/routes/v1/guild.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { guildSettings, guilds } from '@ticketbot/db'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { ApiError } from '../../lib/api-error.js'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'

export function publicGuildRoutes(db: Database) {
	return new Elysia({ prefix: '/guild' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey }: any) => {
				const guildRows = await db
					.select({
						id: guilds.id,
						discordId: guilds.discordId,
						name: guilds.name,
						iconUrl: guilds.iconUrl,
						planTier: guilds.planTier,
					})
					.from(guilds)
					.where(eq(guilds.id, apiKey.guildId))
					.limit(1)

				const guild = guildRows[0]
				if (!guild) {
					throw new ApiError(404, 'GUILD_NOT_FOUND', 'Guild not found')
				}

				const settingsRows = await db
					.select({
						locale: guildSettings.locale,
						timezone: guildSettings.timezone,
						autoCloseHours: guildSettings.autoCloseHours,
					})
					.from(guildSettings)
					.where(eq(guildSettings.guildId, apiKey.guildId))
					.limit(1)

				return { data: { ...guild, settings: settingsRows[0] ?? null } }
			},
			{ beforeHandle: checkKeyPermission('guild.read') },
		)
}
```

- [ ] **Step 2: Create `apps/server/src/routes/v1/categories.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { Elysia } from 'elysia'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import { listCategories } from '../../services/category.js'

export function publicCategoryRoutes(db: Database) {
	return new Elysia({ prefix: '/categories' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey }: any) => {
				const cats = await listCategories(db, apiKey.guildId)
				return { data: cats }
			},
			{ beforeHandle: checkKeyPermission('categories.read') },
		)
}
```

- [ ] **Step 3: Create `apps/server/src/routes/v1/tickets.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { auditLogs, tickets } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { ApiError } from '../../lib/api-error.js'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import {
	assignTicket,
	getTicketDetail,
	listTickets,
	updateTicketPriority,
	updateTicketStatus,
} from '../../services/ticket.js'

export function publicTicketRoutes(db: Database) {
	return new Elysia({ prefix: '/tickets' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, query }: any) => {
				return listTickets(db, apiKey.guildId, {
					status: query.status,
					priority: query.priority,
					categoryId: query.categoryId ? Number(query.categoryId) : undefined,
					assignedToId: query.assignedToId,
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				beforeHandle: checkKeyPermission('tickets.read'),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
					status: t.Optional(t.String()),
					priority: t.Optional(t.String()),
					categoryId: t.Optional(t.Numeric()),
					assignedToId: t.Optional(t.String()),
				}),
			},
		)
		.get(
			'/:ticketId',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await getTicketDetail(db, apiKey.guildId, ticketId)
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.read'),
				params: t.Object({ ticketId: t.Numeric() }),
			},
		)
		.put(
			'/:ticketId/status',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketStatus(db, apiKey.guildId, ticketId, body.status)
				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.status_changed',
					metadata: { field: 'status', new: body.status, via: 'api_key' },
				})
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Object({
					status: t.Union([
						t.Literal('open'),
						t.Literal('pending'),
						t.Literal('waiting_user'),
						t.Literal('waiting_staff'),
						t.Literal('escalated'),
						t.Literal('resolved'),
					]),
				}),
			},
		)
		.put(
			'/:ticketId/priority',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await updateTicketPriority(db, apiKey.guildId, ticketId, body.priority)
				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.status_changed',
					metadata: { field: 'priority', new: body.priority, via: 'api_key' },
				})
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Object({
					priority: t.Union([
						t.Literal('low'),
						t.Literal('normal'),
						t.Literal('high'),
						t.Literal('urgent'),
					]),
				}),
			},
		)
		.put(
			'/:ticketId/assign',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)
				const ticket = await assignTicket(db, apiKey.guildId, ticketId, body.assignedToId)
				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.reassigned',
					metadata: { assignedToId: body.assignedToId, via: 'api_key' },
				})
				return { data: ticket }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Object({
					assignedToId: t.Union([t.String(), t.Null()]),
				}),
			},
		)
		.post(
			'/:ticketId/close',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params, body }: any) => {
				const ticketId = Number(params.ticketId)

				// Verify ticket belongs to guild
				const ticketRows = await db
					.select({ id: tickets.id, status: tickets.status })
					.from(tickets)
					.where(and(eq(tickets.id, ticketId), eq(tickets.guildId, apiKey.guildId)))
					.limit(1)

				const ticket = ticketRows[0]
				if (!ticket) {
					throw new ApiError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
				}

				if (ticket.status === 'closed') {
					throw new ApiError(409, 'TICKET_ALREADY_CLOSED', 'Ticket is already closed')
				}

				await db
					.update(tickets)
					.set({
						status: 'closed',
						closedAt: new Date(),
						closeReason: body?.reason ?? null,
						updatedAt: new Date(),
					})
					.where(eq(tickets.id, ticketId))

				await db.insert(auditLogs).values({
					guildId: apiKey.guildId,
					ticketId,
					actorType: 'system',
					action: 'ticket.closed',
					metadata: { reason: body?.reason, via: 'api_key' },
				})

				return { success: true }
			},
			{
				beforeHandle: checkKeyPermission('tickets.update'),
				params: t.Object({ ticketId: t.Numeric() }),
				body: t.Optional(
					t.Object({
						reason: t.Optional(t.String({ maxLength: 1000 })),
					}),
				),
			},
		)
}
```

- [ ] **Step 4: Create `apps/server/src/routes/v1/transcripts.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import { getTranscript, listTranscripts } from '../../services/transcript.js'

export function publicTranscriptRoutes(db: Database) {
	return new Elysia({ prefix: '/transcripts' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, query }: any) => {
				return listTranscripts(db, apiKey.guildId, {
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				beforeHandle: checkKeyPermission('transcripts.read'),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				}),
			},
		)
		.get(
			'/:transcriptId',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, params }: any) => {
				const transcriptId = Number(params.transcriptId)
				const transcript = await getTranscript(db, apiKey.guildId, transcriptId)
				return { data: transcript }
			},
			{
				beforeHandle: checkKeyPermission('transcripts.read'),
				params: t.Object({ transcriptId: t.Numeric() }),
			},
		)
}
```

- [ ] **Step 5: Create `apps/server/src/routes/v1/audit-logs.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkKeyPermission } from '../../middleware/api-key-guard.js'
import { listAuditLogs } from '../../services/audit-log.js'

export function publicAuditLogRoutes(db: Database) {
	return new Elysia({ prefix: '/audit-logs' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: apiKey injected by apiKeyPlugin derive
			async ({ apiKey, query }: any) => {
				return listAuditLogs(db, apiKey.guildId, {
					action: query.action,
					actorId: query.actorId,
					cursor: query.cursor,
					limit: query.limit ? Number(query.limit) : undefined,
				})
			},
			{
				beforeHandle: checkKeyPermission('audit_logs.read'),
				query: t.Object({
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
					action: t.Optional(t.String()),
					actorId: t.Optional(t.String()),
				}),
			},
		)
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routes/v1/
git commit -m "$(cat <<'EOF'
feat(server): add all public API v1 routes

- /v1/guild — guild info (read-only)
- /v1/categories — list categories (read-only)
- /v1/tickets — list, detail, status, priority, assign, close
- /v1/transcripts — list, detail
- /v1/audit-logs — list with filters
- All routes use API key permission guards
- Audit logging on mutations with via: 'api_key' metadata
EOF
)"
```

---

### Task 12: Server Entrypoint Rewrite

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Rewrite `apps/server/src/index.ts`**

Replace the entire file:

```typescript
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
	.onError(({ error, set }) => {
		if (error instanceof ApiError) {
			set.status = error.status
			return { error: error.code, message: error.message }
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
			.use(apiKeyRoutes(db)),
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 3: Run biome check and fix**

Run:
```bash
cd /data/github/ticket-bot && bunx biome check --write apps/server/src/
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "$(cat <<'EOF'
feat(server): rewrite entrypoint to mount all dashboard and public API routes

- Mount 9 dashboard route groups under /api with session auth
- Mount 5 public route groups under /v1 with API key auth
- Global onError handler normalizes ApiError and unexpected errors
- Rate limit cleanup interval with graceful shutdown
- Preserves /health, /internal, and Swagger/CORS config
EOF
)"
```

---

### Task 13: Integration Verification + Final Biome Check

**Files:**
- All files from previous tasks

- [ ] **Step 1: Run full TypeScript check across all packages**

Run:
```bash
cd /data/github/ticket-bot && bunx tsc --noEmit -p apps/server/tsconfig.json && bunx tsc --noEmit -p packages/db/tsconfig.json && bunx tsc --noEmit -p packages/shared/tsconfig.json
```

- [ ] **Step 2: Run biome check across all modified packages**

Run:
```bash
cd /data/github/ticket-bot && bunx biome check --write apps/server/src/ packages/db/src/ packages/shared/src/
```

- [ ] **Step 3: Fix any biome issues and commit**

If biome made changes:

```bash
git add -A
git commit -m "$(cat <<'EOF'
style: fix biome formatting across Phase 5 files
EOF
)"
```

- [ ] **Step 4: Verify server starts**

Run:
```bash
cd /data/github/ticket-bot && timeout 5 bun run --cwd apps/server dev || true
```

Expected: Server starts and logs `Server running at http://localhost:3001` (will exit after 5s timeout). If it fails to start, investigate and fix the error.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(server): resolve startup issues from integration verification
EOF
)"
```
