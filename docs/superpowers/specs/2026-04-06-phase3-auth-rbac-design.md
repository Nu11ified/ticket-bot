# Phase 3: Auth & RBAC Design

## Overview

Integrate Better Auth with Discord OAuth into the TicketBot platform, wiring it to our existing Drizzle schema via the Drizzle adapter. Build the permission resolution engine, Elysia middleware stack (session, permission guards, super admin), and login-time guild membership sync. This phase builds the auth infrastructure that Phase 4 (bot), Phase 5 (API), and Phase 6 (dashboard) consume.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth ↔ DB integration | Better Auth Drizzle adapter, single users table | One source of truth, no sync between auth and app user tables |
| User ID type | `text` (nanoid) replacing `serial` | Better Auth expects string IDs; changing now is cheap (pre-production) |
| Guild membership sync | Bot events (primary) + login fetch + periodic refresh | Real-time accuracy from bot, login fetch as bootstrap, refresh as fallback |
| Role sync | Bot events (primary) + manual dashboard refresh | Bot owns Discord data; dashboard escape hatch for stale data |
| Session → permissions | Session middleware + declarative permission guard | Session middleware resolves user cheaply; guard loads permissions on-demand per guild |
| Super admin gate | Check `SUPER_ADMIN` env var on every request | Always current, no stale DB flags, env var is sole source of truth |
| Auth tables | Defined in our Drizzle schema | Single migration system, full type safety, visibility into all tables |

## Schema Changes

### Modified: `users` table (`packages/db/src/schema/users.ts`)

| Change | Before | After |
|--------|--------|-------|
| `id` | `serial` (integer, auto-increment) | `text` (nanoid, generated at insert) |
| `emailVerified` | — | `boolean`, default `false`, NOT NULL |
| `username` | mapped as-is | Better Auth maps `name` → `username` |
| `avatarUrl` | mapped as-is | Better Auth maps `image` → `avatarUrl` |

All other columns (`discordId`, `displayName`, `email`, `isSuperAdmin`, timestamps) unchanged.

### New: Auth tables (`packages/db/src/schema/auth.ts`)

#### `sessions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PK | nanoid |
| userId | text | FK→users NOT NULL | |
| token | text | UNIQUE NOT NULL | Session token |
| expiresAt | timestamp(tz) | NOT NULL | |
| ipAddress | text | | Optional |
| userAgent | text | | Optional |
| createdAt | timestamp(tz) | NOT NULL DEFAULT now() | |
| updatedAt | timestamp(tz) | NOT NULL DEFAULT now() | |

#### `accounts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PK | nanoid |
| userId | text | FK→users NOT NULL | |
| accountId | text | NOT NULL | Discord user snowflake |
| providerId | text | NOT NULL | "discord" |
| accessToken | text | | OAuth access token |
| refreshToken | text | | OAuth refresh token |
| accessTokenExpiresAt | timestamp(tz) | | |
| refreshTokenExpiresAt | timestamp(tz) | | |
| scope | text | | OAuth scopes granted |
| idToken | text | | |
| password | text | | Not used for OAuth |
| createdAt | timestamp(tz) | NOT NULL DEFAULT now() | |
| updatedAt | timestamp(tz) | NOT NULL DEFAULT now() | |

#### `verifications`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PK | nanoid |
| identifier | text | NOT NULL | |
| value | text | NOT NULL | |
| expiresAt | timestamp(tz) | NOT NULL | |
| createdAt | timestamp(tz) | DEFAULT now() | |
| updatedAt | timestamp(tz) | DEFAULT now() | |

### FK Type Changes (integer → text)

All foreign keys referencing `users.id` change from `integer` to `text`:

| Table | Column |
|-------|--------|
| `guild_members` | `userId` |
| `tickets` | `creatorId` |
| `tickets` | `assignedToId` |
| `tickets` | `closedById` |
| `ticket_messages` | `userId` |
| `audit_logs` | `actorId` |

No other tables are affected — guild, category, panel, form, and rate-limit PKs remain `serial`.

### Migration

The Phase 2 migration is regenerated from scratch (pre-production, no deployed data). The new migration includes all 22 existing tables + 3 new auth tables = 25 tables total.

## Auth Package (`packages/auth/`)

### `src/server.ts` — Better Auth Configuration

- `drizzleAdapter(db, { provider: 'pg', schema })` with our full Drizzle schema
- `user.modelName: "users"` with field mappings: `name` → `username`, `image` → `avatarUrl`
- `user.additionalFields`: `discordId` (text, `input: false`), `displayName` (text, `input: false`), `isSuperAdmin` (boolean, `input: false`)
- `session.modelName: "sessions"`
- Discord social provider with scopes: `identify email guilds`
- `mapProfileToUser` on Discord provider: extracts `discordId` from profile ID, `displayName` from `global_name`
- `secret` from `BETTER_AUTH_SECRET` env var
- `baseURL` from `BETTER_AUTH_URL` env var

### `src/client.ts` — Browser Auth Client

- `createBrowserAuthClient(baseUrl)` returns Better Auth client configured for Discord sign-in
- Used by the Next.js dashboard

### `src/permissions.ts` — Permission Resolution

**`resolveUserPermissions(db, userId, guildId): Promise<Set<string>>`**

Queries the RBAC chain:
1. Find the `guild_member` row for (userId, guildId)
2. Get all `guild_member_roles` for that member
3. Get all `role_permissions` for those Discord roles
4. Return the set of `permissions.key` strings

Returns an empty set if the user is not a member of the guild.

**`hasPermission(db, userId, guildId, permissionKey): Promise<boolean>`**

Calls `resolveUserPermissions()` and checks if the key is in the set.

### `src/guild-sync.ts` — Login-Time Guild Fetch

**`syncUserGuilds(db, userId): Promise<void>`**

1. Read the user's Discord `accessToken` from the `accounts` table
2. Call Discord REST API: `GET /users/@me/guilds` with Bearer token
3. Cross-reference returned guild IDs with `guilds` table (only guilds where bot is installed)
4. Upsert `guild_members` rows for matching guilds
5. Remove `guild_members` rows for guilds the user is no longer in

Called on login (via Better Auth `afterLogin` hook or explicit call after OAuth) and on dashboard refresh.

## Elysia Server Integration (`apps/server/`)

### Auth Route Handler

Better Auth's HTTP handler mounted at `/api/auth/*`. Handles:
- `GET /api/auth/sign-in/discord` — initiates Discord OAuth flow
- `GET /api/auth/callback/discord` — OAuth callback
- `GET /api/auth/get-session` — validate session
- `POST /api/auth/sign-out` — invalidate session

### `src/middleware/auth.ts` — Session Middleware

Applied to all routes except `/health` and `/api/auth/*`.

1. Extract session token from request (cookie or Authorization header)
2. Call Better Auth's session validation
3. Fetch full user row from `users` table
4. Attach `ctx.user` to Elysia derive context
5. Return 401 if no valid session

### `src/middleware/guard.ts` — Permission Guard

Declarative guard for Elysia routes:

```typescript
app.guard({ permissions: ['tickets.close'], guildParam: 'guildId' }, (app) =>
  app.post('/tickets/:ticketId/close', handler)
)
```

Under the hood:
1. Read `guildId` from the route params (specified by `guildParam`)
2. Call `resolveUserPermissions(db, ctx.user.id, guildId)`
3. Check all required permission keys are in the resolved set
4. Return 403 with `{ error: 'Insufficient permissions' }` if any are missing

### `src/middleware/super-admin.ts` — Super Admin Guard

Applied to all `/internal/*` routes.

1. Read `SUPER_ADMIN` env var, split by comma, trim whitespace
2. Check if `ctx.user.email` is in the list
3. Return 403 if not

### Guild Refresh Endpoint

`POST /api/guilds/refresh` — authenticated, no special permissions.

Calls `syncUserGuilds()` to re-fetch the user's Discord guilds and update membership. Dashboard calls this on session start as the "periodic refresh" fallback.

### Role Refresh Endpoint

`POST /api/guilds/:guildId/roles/refresh` — requires `admin.manage_roles` permission.

1. Read `DISCORD_TOKEN` from env var (the bot token)
2. Fetch guild roles from Discord REST API: `GET /guilds/:guildId/roles` using the bot token
3. Upsert `discord_roles` table rows
4. Delete roles that no longer exist on Discord

Note: This uses the bot token (not user token) since the bot has guild-level permissions. The server reads `DISCORD_TOKEN` from env, same value the bot uses.

## Scope Boundaries

### In Phase 3

- Schema changes: users.id → text, auth tables, FK updates, migration regeneration
- Better Auth config with Drizzle adapter + Discord OAuth
- Permission resolution (`resolveUserPermissions`, `hasPermission`)
- Elysia middleware (session, permission guard, super admin)
- Login-time guild membership sync
- Guild refresh + role refresh API endpoints
- Auth client for dashboard

### Deferred

| Feature | Phase |
|---------|-------|
| Bot `guildMemberAdd`/`Remove` event handlers | Phase 4 |
| Bot `roleCreate`/`Update`/`Delete` event handlers | Phase 4 |
| API routes that use permission guards | Phase 5 |
| Dashboard login UI, guild picker, role management | Phase 6 |

## File Map

### Modified files

- `packages/db/src/schema/users.ts` — users.id → text, add emailVerified
- `packages/db/src/schema/tickets.ts` — FK types integer → text for user refs
- `packages/db/src/schema/audit.ts` — actorId FK integer → text
- `packages/db/src/schema/index.ts` — add auth.ts export
- `packages/db/src/client.ts` — add auth schema import
- `packages/db/src/seed.ts` — no change (permissions table unaffected)
- `packages/auth/src/server.ts` — rewrite with Drizzle adapter
- `packages/auth/src/client.ts` — minor update
- `packages/auth/src/index.ts` — update re-exports
- `packages/auth/package.json` — add dependencies (drizzle-orm, postgres)
- `apps/server/src/index.ts` — mount auth handler + middleware
- `apps/server/package.json` — add @ticketbot/auth dependency

### New files

- `packages/db/src/schema/auth.ts` — sessions, accounts, verifications tables + relations
- `packages/auth/src/permissions.ts` — permission resolution logic
- `packages/auth/src/guild-sync.ts` — login-time guild fetch
- `apps/server/src/middleware/auth.ts` — session middleware
- `apps/server/src/middleware/guard.ts` — permission guard
- `apps/server/src/middleware/super-admin.ts` — super admin check

### Regenerated

- `packages/db/migrations/` — fresh migration for all 25 tables
