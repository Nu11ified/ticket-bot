# Phase 3: Auth & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Better Auth with Discord OAuth, build RBAC permission resolution, Elysia middleware stack, and guild sync — so the dashboard can authenticate users and enforce granular permissions.

**Architecture:** Better Auth's Drizzle adapter maps to our existing `users` table (with `id` changed from `serial` to `text`). Auth tables (sessions, accounts, verifications) live in our Drizzle schema. Elysia uses Better Auth's official macro pattern for session resolution, with permission checking via `beforeHandle` hooks. Guild membership syncs on login via Discord API.

**Tech Stack:** Better Auth (Drizzle adapter, Discord OAuth), Drizzle ORM, Elysia (macros, plugins), PostgreSQL 16, Bun

---

## File Map

### Modified files
- `packages/auth/package.json` — move @ticketbot/db to deps, add drizzle-orm
- `packages/db/src/schema/users.ts` — users.id → text, add emailVerified, guild_members.userId → text
- `packages/db/src/schema/tickets.ts` — creatorId/assignedToId/closedById → text
- `packages/db/src/schema/audit.ts` — actorId → text
- `packages/db/src/schema/index.ts` — add auth.ts export
- `packages/db/src/client.ts` — add auth schema import
- `packages/auth/src/server.ts` — rewrite with Drizzle adapter + Discord OAuth
- `packages/auth/src/client.ts` — no functional change
- `packages/auth/src/index.ts` — add re-exports for permissions and guild-sync
- `apps/server/src/index.ts` — mount auth handler + middleware + endpoints

### New files
- `packages/db/src/schema/auth.ts` — sessions, accounts, verifications tables
- `packages/auth/src/permissions.ts` — resolveUserPermissions, hasPermission
- `packages/auth/src/guild-sync.ts` — syncUserGuilds
- `apps/server/src/middleware/auth.ts` — Elysia Better Auth plugin with session macro
- `apps/server/src/middleware/guard.ts` — permission check beforeHandle factory
- `apps/server/src/middleware/super-admin.ts` — super admin check plugin

### Regenerated
- `packages/db/migrations/` — fresh migration for all 25 tables

---

### Task 1: Install Dependencies

**Files:**
- Modify: `packages/auth/package.json`

- [ ] **Step 1: Update `packages/auth/package.json`**

Move `@ticketbot/db` from `devDependencies` to `dependencies` and add `drizzle-orm`:

```json
{
	"name": "@ticketbot/auth",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"main": "./src/index.ts",
	"types": "./src/index.ts",
	"exports": {
		".": "./src/index.ts",
		"./server": "./src/server.ts",
		"./client": "./src/client.ts"
	},
	"dependencies": {
		"@ticketbot/db": "workspace:*",
		"better-auth": "^1.2.0",
		"drizzle-orm": "^0.39.0"
	}
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd /data/github/ticket-bot && pnpm install`

- [ ] **Step 3: Commit**

```bash
git add packages/auth/package.json pnpm-lock.yaml
git commit -m "chore: move @ticketbot/db to auth deps, add drizzle-orm"
```

---

### Task 2: Schema — Change users.id to Text and Update All FKs

**Files:**
- Modify: `packages/db/src/schema/users.ts`
- Modify: `packages/db/src/schema/tickets.ts`
- Modify: `packages/db/src/schema/audit.ts`

- [ ] **Step 1: Replace `packages/db/src/schema/users.ts`**

```typescript
import { relations } from 'drizzle-orm'
import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'

export const users = pgTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	discordId: text('discord_id').notNull().unique(),
	username: text('username').notNull(),
	displayName: text('display_name'),
	avatarUrl: text('avatar_url'),
	email: text('email'),
	emailVerified: boolean('email_verified').default(false).notNull(),
	isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const guildMembers = pgTable(
	'guild_members',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueGuildUser: unique('uq_guild_members_guild_user').on(t.guildId, t.userId),
	}),
)

export const permissions = pgTable('permissions', {
	id: serial('id').primaryKey(),
	key: text('key').notNull().unique(),
	description: text('description'),
	category: text('category').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const discordRoles = pgTable(
	'discord_roles',
	{
		id: serial('id').primaryKey(),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		discordRoleId: text('discord_role_id').notNull(),
		name: text('name').notNull(),
		color: integer('color'),
		position: integer('position'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueGuildRole: unique('uq_discord_roles_guild_role').on(t.guildId, t.discordRoleId),
	}),
)

export const rolePermissions = pgTable(
	'role_permissions',
	{
		id: serial('id').primaryKey(),
		discordRoleId: integer('discord_role_id')
			.notNull()
			.references(() => discordRoles.id, { onDelete: 'cascade' }),
		permissionId: integer('permission_id')
			.notNull()
			.references(() => permissions.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueRolePermission: unique('uq_role_permissions_role_perm').on(
			t.discordRoleId,
			t.permissionId,
		),
	}),
)

export const guildMemberRoles = pgTable(
	'guild_member_roles',
	{
		id: serial('id').primaryKey(),
		guildMemberId: integer('guild_member_id')
			.notNull()
			.references(() => guildMembers.id, { onDelete: 'cascade' }),
		discordRoleId: integer('discord_role_id')
			.notNull()
			.references(() => discordRoles.id, { onDelete: 'cascade' }),
		syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
	},
	(t) => ({
		uniqueMemberRole: unique('uq_guild_member_roles_member_role').on(
			t.guildMemberId,
			t.discordRoleId,
		),
	}),
)

export const usersRelations = relations(users, ({ many }) => ({
	guildMembers: many(guildMembers),
}))

export const guildMembersRelations = relations(guildMembers, ({ one, many }) => ({
	guild: one(guilds, { fields: [guildMembers.guildId], references: [guilds.id] }),
	user: one(users, { fields: [guildMembers.userId], references: [users.id] }),
	roles: many(guildMemberRoles),
}))

export const discordRolesRelations = relations(discordRoles, ({ one, many }) => ({
	guild: one(guilds, { fields: [discordRoles.guildId], references: [guilds.id] }),
	permissions: many(rolePermissions),
	memberRoles: many(guildMemberRoles),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
	discordRole: one(discordRoles, {
		fields: [rolePermissions.discordRoleId],
		references: [discordRoles.id],
	}),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id],
	}),
}))

export const guildMemberRolesRelations = relations(guildMemberRoles, ({ one }) => ({
	guildMember: one(guildMembers, {
		fields: [guildMemberRoles.guildMemberId],
		references: [guildMembers.id],
	}),
	discordRole: one(discordRoles, {
		fields: [guildMemberRoles.discordRoleId],
		references: [discordRoles.id],
	}),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type GuildMember = typeof guildMembers.$inferSelect
export type NewGuildMember = typeof guildMembers.$inferInsert
export type Permission = typeof permissions.$inferSelect
export type DiscordRole = typeof discordRoles.$inferSelect
export type NewDiscordRole = typeof discordRoles.$inferInsert
```

Changes from current: `users.id` is now `text` with `$defaultFn(() => crypto.randomUUID())` instead of `serial`. Added `emailVerified` boolean column. `guildMembers.userId` changed from `integer` to `text`.

- [ ] **Step 2: Update `packages/db/src/schema/tickets.ts` — change user FK types**

Replace these three column definitions in the `tickets` table (lines 33-37):

Change `creatorId` from:
```typescript
		creatorId: integer('creator_id')
			.notNull()
			.references(() => users.id),
```
to:
```typescript
		creatorId: text('creator_id')
			.notNull()
			.references(() => users.id),
```

Change `assignedToId` from:
```typescript
		assignedToId: integer('assigned_to_id').references(() => users.id),
```
to:
```typescript
		assignedToId: text('assigned_to_id').references(() => users.id),
```

Change `closedById` from:
```typescript
		closedById: integer('closed_by_id').references(() => users.id),
```
to:
```typescript
		closedById: text('closed_by_id').references(() => users.id),
```

Also in `ticketMessages` table, change `userId` from:
```typescript
		userId: integer('user_id')
			.notNull()
			.references(() => users.id),
```
to:
```typescript
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
```

- [ ] **Step 3: Update `packages/db/src/schema/audit.ts` — change actorId FK type**

Change `actorId` from:
```typescript
		actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
```
to:
```typescript
		actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /data/github/ticket-bot/packages/db && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/users.ts packages/db/src/schema/tickets.ts packages/db/src/schema/audit.ts
git commit -m "feat: change users.id to text, add emailVerified, update all user FKs"
```

---

### Task 3: Schema — Create Auth Tables

**Files:**
- Create: `packages/db/src/schema/auth.ts`

- [ ] **Step 1: Create `packages/db/src/schema/auth.ts`**

```typescript
import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const accounts = pgTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const verifications = pgTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export type Session = typeof sessions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Verification = typeof verifications.$inferSelect
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/schema/auth.ts
git commit -m "feat: add sessions, accounts, verifications auth tables"
```

---

### Task 4: Schema — Update Barrel Export and Client

**Files:**
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/client.ts`

- [ ] **Step 1: Update `packages/db/src/schema/index.ts`**

Add the auth export. Replace entire file:

```typescript
export * from './guilds.js'
export * from './users.js'
export * from './categories.js'
export * from './panels.js'
export * from './tickets.js'
export * from './audit.js'
export * from './rate-limits.js'
export * from './auth.js'
```

- [ ] **Step 2: Update `packages/db/src/client.ts`**

Add auth schema import. Replace entire file:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as auditSchema from './schema/audit.js'
import * as authSchema from './schema/auth.js'
import * as categoriesSchema from './schema/categories.js'
import * as guildsSchema from './schema/guilds.js'
import * as panelsSchema from './schema/panels.js'
import * as rateLimitsSchema from './schema/rate-limits.js'
import * as ticketsSchema from './schema/tickets.js'
import * as usersSchema from './schema/users.js'

const schema = {
	...guildsSchema,
	...usersSchema,
	...categoriesSchema,
	...panelsSchema,
	...ticketsSchema,
	...auditSchema,
	...rateLimitsSchema,
	...authSchema,
}

export function createDb(connectionString: string) {
	const client = postgres(connectionString)
	return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDb>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /data/github/ticket-bot/packages/db && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/src/client.ts
git commit -m "feat: add auth schema to barrel export and client"
```

---

### Task 5: Regenerate Migration and Verify

**Files:**
- Regenerated: `packages/db/migrations/`

- [ ] **Step 1: Delete old migration**

Run: `rm -rf /data/github/ticket-bot/packages/db/migrations`

- [ ] **Step 2: Start test Postgres**

```bash
docker run -d --name ticketbot-pg-test -p 5435:5432 -e POSTGRES_DB=ticketbot -e POSTGRES_USER=ticketbot -e POSTGRES_PASSWORD=ticketbot postgres:16-alpine
sleep 3
```

- [ ] **Step 3: Generate new migration**

Run: `cd /data/github/ticket-bot && DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5435/ticketbot pnpm --filter @ticketbot/db generate`

Expected: Migration file generated with 25 tables (22 existing + 3 auth tables).

- [ ] **Step 4: Apply migration**

Run: `cd /data/github/ticket-bot && DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5435/ticketbot pnpm --filter @ticketbot/db migrate`

- [ ] **Step 5: Run seed**

Run: `cd /data/github/ticket-bot && DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5435/ticketbot pnpm --filter @ticketbot/db seed`

Expected: All 26 permissions seeded.

- [ ] **Step 6: Verify table count**

Run: `docker exec ticketbot-pg-test psql -U ticketbot -d ticketbot -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"`

Expected: 25 tables (22 from Phase 2 + sessions, accounts, verifications).

- [ ] **Step 7: Verify users.id is text**

Run: `docker exec ticketbot-pg-test psql -U ticketbot -d ticketbot -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id';"`

Expected: `id | text`

- [ ] **Step 8: Clean up**

Run: `docker stop ticketbot-pg-test && docker rm ticketbot-pg-test`

- [ ] **Step 9: Commit**

```bash
cd /data/github/ticket-bot && git add packages/db/migrations/
git commit -m "chore: regenerate migration for Phase 3 auth schema (25 tables)"
```

---

### Task 6: Auth — Rewrite server.ts

**Files:**
- Modify: `packages/auth/src/server.ts`

- [ ] **Step 1: Replace `packages/auth/src/server.ts`**

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Database } from '@ticketbot/db'
import { accounts, sessions, users, verifications } from '@ticketbot/db'

export function createAuth(db: Database) {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: {
				user: users,
				session: sessions,
				account: accounts,
				verification: verifications,
			},
		}),
		secret: process.env.BETTER_AUTH_SECRET,
		baseURL: process.env.BETTER_AUTH_URL,
		user: {
			modelName: 'users',
			fields: {
				name: 'username',
				image: 'avatar_url',
			},
			additionalFields: {
				discordId: {
					type: 'string',
					required: false,
					input: false,
				},
				displayName: {
					type: 'string',
					required: false,
					input: false,
				},
				isSuperAdmin: {
					type: 'boolean',
					required: false,
					defaultValue: false,
					input: false,
				},
			},
		},
		socialProviders: {
			discord: {
				clientId: process.env.DISCORD_CLIENT_ID ?? '',
				clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
				scope: ['identify', 'email', 'guilds'],
				mapProfileToUser: (profile) => ({
					discordId: profile.id,
					displayName: profile.global_name ?? profile.username,
				}),
			},
		},
	})
}

export type Auth = ReturnType<typeof createAuth>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /data/github/ticket-bot/packages/auth && npx tsc --noEmit`

Note: If there are type errors related to Better Auth's `mapProfileToUser` profile shape, adjust the profile field access. Discord profile fields are: `id`, `username`, `global_name`, `avatar`, `email`.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/server.ts
git commit -m "feat: rewrite auth with Better Auth Drizzle adapter + Discord OAuth"
```

---

### Task 7: Auth — Create permissions.ts

**Files:**
- Create: `packages/auth/src/permissions.ts`

- [ ] **Step 1: Create `packages/auth/src/permissions.ts`**

```typescript
import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import {
	guildMemberRoles,
	guildMembers,
	permissions,
	rolePermissions,
} from '@ticketbot/db'

export async function resolveUserPermissions(
	db: Database,
	userId: string,
	guildId: number,
): Promise<Set<string>> {
	const member = await db
		.select({ id: guildMembers.id })
		.from(guildMembers)
		.where(and(eq(guildMembers.userId, userId), eq(guildMembers.guildId, guildId)))
		.limit(1)

	if (member.length === 0) return new Set()

	const memberRoles = await db
		.select({ discordRoleId: guildMemberRoles.discordRoleId })
		.from(guildMemberRoles)
		.where(eq(guildMemberRoles.guildMemberId, member[0].id))

	if (memberRoles.length === 0) return new Set()

	const roleIds = memberRoles.map((r) => r.discordRoleId)

	const perms = await db
		.select({ key: permissions.key })
		.from(rolePermissions)
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(inArray(rolePermissions.discordRoleId, roleIds))

	return new Set(perms.map((p) => p.key))
}

export async function hasPermission(
	db: Database,
	userId: string,
	guildId: number,
	permissionKey: string,
): Promise<boolean> {
	const perms = await resolveUserPermissions(db, userId, guildId)
	return perms.has(permissionKey)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/auth/src/permissions.ts
git commit -m "feat: add RBAC permission resolution engine"
```

---

### Task 8: Auth — Create guild-sync.ts

**Files:**
- Create: `packages/auth/src/guild-sync.ts`

- [ ] **Step 1: Create `packages/auth/src/guild-sync.ts`**

```typescript
import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { accounts, discordRoles, guildMembers, guilds } from '@ticketbot/db'

interface DiscordPartialGuild {
	id: string
	name: string
	icon: string | null
	owner: boolean
	permissions: string
}

export async function syncUserGuilds(db: Database, userId: string): Promise<void> {
	const account = await db
		.select({ accessToken: accounts.accessToken })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'discord')))
		.limit(1)

	if (account.length === 0 || !account[0].accessToken) return

	const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
		headers: { Authorization: `Bearer ${account[0].accessToken}` },
	})

	if (!response.ok) return

	const discordGuilds: DiscordPartialGuild[] = await response.json()
	const discordGuildIds = discordGuilds.map((g) => g.id)

	if (discordGuildIds.length === 0) return

	const botGuilds = await db
		.select({ id: guilds.id, discordId: guilds.discordId })
		.from(guilds)
		.where(inArray(guilds.discordId, discordGuildIds))

	if (botGuilds.length === 0) return

	const botGuildIds = botGuilds.map((g) => g.id)

	for (const guild of botGuilds) {
		const existing = await db
			.select({ id: guildMembers.id })
			.from(guildMembers)
			.where(and(eq(guildMembers.guildId, guild.id), eq(guildMembers.userId, userId)))
			.limit(1)

		if (existing.length === 0) {
			await db.insert(guildMembers).values({ guildId: guild.id, userId })
		}
	}

	const currentMemberships = await db
		.select({ id: guildMembers.id, guildId: guildMembers.guildId })
		.from(guildMembers)
		.where(eq(guildMembers.userId, userId))

	for (const membership of currentMemberships) {
		if (!botGuildIds.includes(membership.guildId)) {
			await db.delete(guildMembers).where(eq(guildMembers.id, membership.id))
		}
	}
}

export async function syncGuildRoles(
	db: Database,
	guildId: number,
	discordGuildId: string,
): Promise<void> {
	const botToken = process.env.DISCORD_TOKEN
	if (!botToken) return

	const response = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/roles`, {
		headers: { Authorization: `Bot ${botToken}` },
	})

	if (!response.ok) return

	const discordRolesData: Array<{
		id: string
		name: string
		color: number
		position: number
	}> = await response.json()

	const existingRoles = await db
		.select({ id: discordRoles.id, discordRoleId: discordRoles.discordRoleId })
		.from(discordRoles)
		.where(eq(discordRoles.guildId, guildId))

	const existingRoleDiscordIds = new Set(existingRoles.map((r) => r.discordRoleId))
	const currentDiscordRoleIds = new Set(discordRolesData.map((r) => r.id))

	for (const role of discordRolesData) {
		if (existingRoleDiscordIds.has(role.id)) {
			await db
				.update(discordRoles)
				.set({
					name: role.name,
					color: role.color,
					position: role.position,
					updatedAt: new Date(),
				})
				.where(and(eq(discordRoles.guildId, guildId), eq(discordRoles.discordRoleId, role.id)))
		} else {
			await db.insert(discordRoles).values({
				guildId,
				discordRoleId: role.id,
				name: role.name,
				color: role.color,
				position: role.position,
			})
		}
	}

	for (const existing of existingRoles) {
		if (!currentDiscordRoleIds.has(existing.discordRoleId)) {
			await db.delete(discordRoles).where(eq(discordRoles.id, existing.id))
		}
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/auth/src/guild-sync.ts
git commit -m "feat: add guild membership sync and role sync"
```

---

### Task 9: Auth — Update index.ts Re-exports

**Files:**
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Replace `packages/auth/src/index.ts`**

```typescript
export { createAuth, type Auth } from './server.js'
export { createBrowserAuthClient, type AuthClient } from './client.js'
export { resolveUserPermissions, hasPermission } from './permissions.js'
export { syncUserGuilds, syncGuildRoles } from './guild-sync.js'
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /data/github/ticket-bot/packages/auth && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "feat: export permissions and guild-sync from auth package"
```

---

### Task 10: Server — Create Auth Middleware Plugin

**Files:**
- Create: `apps/server/src/middleware/auth.ts`

- [ ] **Step 1: Create the middleware directory and file**

Run: `mkdir -p /data/github/ticket-bot/apps/server/src/middleware`

- [ ] **Step 2: Create `apps/server/src/middleware/auth.ts`**

This follows Better Auth's official Elysia macro pattern:

```typescript
import { type Context, Elysia } from 'elysia'
import type { Auth } from '@ticketbot/auth'

export function authPlugin(auth: Auth) {
	const betterAuthView = (context: Context) => {
		const BETTER_AUTH_ACCEPT_METHODS = ['POST', 'GET']
		if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
			return auth.handler(context.request)
		}
		context.set.status = 405
		return { error: 'Method not allowed' }
	}

	return new Elysia({ name: 'auth' })
		.all('/api/auth/*', betterAuthView)
		.macro({
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/middleware/auth.ts
git commit -m "feat: add Elysia auth plugin with Better Auth session macro"
```

---

### Task 11: Server — Create Permission Guard

**Files:**
- Create: `apps/server/src/middleware/guard.ts`

- [ ] **Step 1: Create `apps/server/src/middleware/guard.ts`**

```typescript
import type { Database } from '@ticketbot/db'
import { resolveUserPermissions } from '@ticketbot/auth'

export function checkPermissions(
	db: Database,
	requiredPermissions: string[],
	guildIdParam = 'guildId',
) {
	return async ({ user, params, set }: { user: { id: string }; params: Record<string, string>; set: { status: number } }) => {
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/middleware/guard.ts
git commit -m "feat: add permission check guard for Elysia routes"
```

---

### Task 12: Server — Create Super Admin Guard

**Files:**
- Create: `apps/server/src/middleware/super-admin.ts`

- [ ] **Step 1: Create `apps/server/src/middleware/super-admin.ts`**

```typescript
import { Elysia } from 'elysia'

export const superAdminGuard = new Elysia({ name: 'super-admin' }).onBeforeHandle(
	({ user, set }) => {
		const superAdminEmails = (process.env.SUPER_ADMIN ?? '')
			.split(',')
			.map((e) => e.trim())
			.filter(Boolean)

		if (!user?.email || !superAdminEmails.includes(user.email)) {
			set.status = 403
			return { error: 'Super admin access required' }
		}
	},
)
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/middleware/super-admin.ts
git commit -m "feat: add super admin guard for /internal routes"
```

---

### Task 13: Server — Update index.ts with Auth + Endpoints

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Replace `apps/server/src/index.ts`**

```typescript
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { createDb } from '@ticketbot/db'
import { guilds } from '@ticketbot/db'
import { createAuth, syncUserGuilds, syncGuildRoles } from '@ticketbot/auth'
import { eq } from 'drizzle-orm'
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
		async ({ user, params }) => {
			const guildId = Number(params.guildId)
			const guild = await db
				.select({ discordId: guilds.discordId })
				.from(guilds)
				.where(eq(guilds.id, guildId))
				.limit(1)
			if (guild.length === 0) return { error: 'Guild not found' }
			await syncGuildRoles(db, guildId, guild[0].discordId)
			return { success: true }
		},
		{
			auth: true,
			beforeHandle: checkPermissions(db, ['admin.manage_roles']),
		},
	)
	.group('/internal', (app) =>
		app.use(superAdminGuard).get('/health', ({ user }) => ({
			status: 'ok',
			admin: user.email,
		})),
	)
	.listen(3001)

console.log(`Server running at http://localhost:${app.server?.port}`)

export type App = typeof app
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /data/github/ticket-bot/apps/server && npx tsc --noEmit`

Note: There may be type errors if the Elysia macro types don't perfectly infer `user` on the context. If so, the macro type definition in `middleware/auth.ts` may need type annotations. The implementer should fix any type issues.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat: mount auth handler, middleware, guild/role refresh endpoints"
```

---

### Task 14: Type-Check, Lint, and Final Verification

- [ ] **Step 1: Type-check all packages**

Run: `cd /data/github/ticket-bot/packages/shared && npx tsc --noEmit && cd ../db && npx tsc --noEmit && cd ../auth && npx tsc --noEmit`

Expected: No errors in any package.

- [ ] **Step 2: Type-check all apps**

Run: `cd /data/github/ticket-bot/apps/bot && npx tsc --noEmit && cd ../server && npx tsc --noEmit && cd ../dashboard && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Lint**

Run: `cd /data/github/ticket-bot && bunx biome check .`

Expected: No errors. Fix any lint/format issues.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type-check and lint issues for Phase 3 auth"
```

Only commit if there were actual fixes. Skip if clean.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 3 Auth & RBAC complete

- Better Auth with Drizzle adapter and Discord OAuth
- users.id changed from serial to text (nanoid)
- Auth tables: sessions, accounts, verifications
- RBAC permission resolution engine
- Guild membership sync on login via Discord API
- Guild role sync via Discord bot token
- Elysia session macro with Better Auth integration
- Permission guard for route-level authorization
- Super admin guard for /internal routes
- Guild refresh and role refresh API endpoints"
```
