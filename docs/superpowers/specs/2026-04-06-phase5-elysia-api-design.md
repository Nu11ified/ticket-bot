# Phase 5: Elysia API Design

## Overview

Build the full API layer for the ticket bot platform, served from the existing Elysia app (`apps/server`). Two surfaces: a session-authenticated Dashboard API (`/api/*`) powering the Next.js dashboard via TanStack Query, and a public API (`/v1/*`) with guild-scoped API keys for third-party integrations. Both share a service layer backed by `@ticketbot/db`. No API intermediary for the bot — the bot continues talking directly to the DB.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API surfaces | Dashboard `/api` + Public `/v1` | Dashboard needs full CRUD; third parties need read + ticket ops |
| Dashboard auth | Session via Better Auth cookies | Already implemented in Phase 3 |
| Public auth | Guild-scoped API keys with permission subsets | Least-privilege for integrations, admin controls what each key can do |
| Rate limiting | In-memory sliding window per API key | Simple, no Redis dependency, sufficient for single-process Elysia |
| Pagination | Cursor-based (all list endpoints) | No OFFSET drift, efficient seek queries, works with TanStack Virtual infinite scroll |
| Error handling | Global `onError` + `ApiError` class | Consistent error shape, no leaked internals |
| Validation | Elysia TypeBox schemas | Declarative, automatic, consistent error format |
| Panel deploy | `@discordjs/rest` (REST only, no gateway) | Server doesn't need bot gateway to send embeds |
| Real-time | Polling via TanStack Query `refetchInterval` | Simple, no SSE/WS infrastructure needed for Phase 5 |
| Service layer | Shared between `/api` and `/v1` | No business logic duplication |

## Schema Changes

### New: `api_keys` table (`packages/db/src/schema/api-keys.ts`)

| Column | Type | Default | Constraints | Notes |
|--------|------|---------|-------------|-------|
| `id` | serial | — | PK | |
| `guildId` | integer | — | FK → guilds, NOT NULL | Key is guild-scoped |
| `createdById` | integer | — | FK → users, NOT NULL | Who created the key |
| `name` | varchar(100) | — | NOT NULL | Human label ("My Bot", "Analytics") |
| `keyHash` | varchar(255) | — | UNIQUE, NOT NULL | SHA-256 hash of the key |
| `keyPrefix` | varchar(10) | — | NOT NULL | First 8 chars for display (`tk_abc1...`) |
| `permissions` | text[] | — | NOT NULL | Subset of permission strings |
| `rateLimitPerMinute` | integer | NULL | — | Per-key override, null = use tier default |
| `lastUsedAt` | timestamp | NULL | — | Updated on use |
| `expiresAt` | timestamp | NULL | — | Optional expiry |
| `createdAt` | timestamp | now() | NOT NULL | |

### Modified: `packages/shared/src/constants/plan-defaults.ts`

Add `apiRateLimitPerMinute` to tier defaults:

```typescript
export const PLAN_DEFAULTS = {
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

No other schema changes. Migration regenerated from scratch (pre-production).

## Architecture

```
┌─────────────────────────────────────────┐
│              Elysia Server              │
├───────────────┬─────────────────────────┤
│  /api/* (dashboard)  │  /v1/* (public)  │
│  session auth        │  API key auth    │
│  permission guard    │  key permission  │
│                      │  rate limiter    │
├───────────────┴─────────────────────────┤
│           Global onError Handler        │
├─────────────────────────────────────────┤
│           Shared Service Layer          │
├─────────────────────────────────────────┤
│           @ticketbot/db                 │
└─────────────────────────────────────────┘
```

Both API surfaces share the same service layer. Route handlers are thin — extract params, call service, return response. All business logic lives in services. Services throw `ApiError` for business rule violations. The global `onError` handler normalizes all errors into a consistent response shape.

## Error Handling

### ApiError Class

```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
```

### Global Error Handler

```typescript
app.onError(({ error, set }) => {
  if (error instanceof ApiError) {
    set.status = error.status
    return { error: error.code, message: error.message }
  }
  console.error(error)
  set.status = 500
  return { error: 'INTERNAL_ERROR', message: 'Something went wrong' }
})
```

### Error Response Contract

All errors follow:
```json
{ "error": "TICKET_NOT_FOUND", "message": "Ticket not found" }
```

Machine-readable `error` code for client logic, human-readable `message` for display. No stack traces leak. Elysia validation errors normalized to `{ error: "VALIDATION_ERROR", message: "..." }` with 400 status.

### Error Boundary Rules

- Services throw `ApiError` for business failures
- Services never catch-and-swallow
- Route handlers don't need try-catch
- Global handler catches everything
- Unexpected errors logged server-side with full context

## Cursor Pagination

### Cursor Format

Base64url-encoded JSON: `{ id: number, dir: "next" | "prev" }`. Opaque to client.

### Cursor Validation

Strict parse on decode. `id` must be positive integer, `dir` must be exactly `"next"` or `"prev"`, no extra fields. Failures reject with `400 Invalid cursor`. Cursor values are always parameterized bind values — never interpolated into SQL.

```typescript
function decodeCursor(raw: string): { id: number; dir: 'next' | 'prev' } {
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
```

### Query Pattern

```sql
WHERE guild_id = $1 AND id > $cursor_id
ORDER BY id ASC
LIMIT $limit + 1
```

Fetch `limit + 1` rows. If extra row exists, `hasMore = true`, pop it before returning.

### Response Envelope

All list endpoints (both `/api` and `/v1`):

```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6NDIsImRpciI6Im5leHQifQ==",
    "hasMore": true,
    "limit": 50
  }
}
```

### Defaults and Limits

- Default limit: 50
- Max limit: 100
- Client passes `?limit=25`

### Sort Keys

Default sort: `id` (creation order). Tickets also support `?sort=createdAt` and `?sort=updatedAt` — cursor encodes the sort column value + id as tiebreaker.

### Filtering

Query params like `?status=open&categoryId=3&assignedToId=7` applied as WHERE clauses before the cursor condition. Filters and cursor compose cleanly.

## API Key Model

### Key Format

`tk_{32 random bytes as hex}` — 68 chars total. Only shown once at creation. Stored as SHA-256 hash.

### Key Permissions

| Permission | Grants |
|-----------|--------|
| `guild.read` | GET guild info |
| `tickets.read` | GET tickets |
| `tickets.update` | PUT status/priority/assign, POST close |
| `transcripts.read` | GET transcripts |
| `categories.read` | GET categories |
| `audit_logs.read` | GET audit logs |

Admin selects which to grant at key creation.

### Auth Flow

1. Extract key from `Authorization: Bearer tk_...`
2. SHA-256 hash the key
3. Lookup by `keyHash`
4. Check not expired
5. Check permission for this route
6. Attach guild context to request
7. Proceed to handler

### Revocation

Any guild member with `admin.manage_api_keys` permission can revoke any key for that guild. Hard delete — hash is gone, key is dead. Audit logged as `api_key.revoked`.

### Expiry

Optional at creation. Choices: never, 30 days, 90 days, 1 year. Expired keys rejected at auth time with `401 KEY_EXPIRED`. Dashboard shows expired keys grayed out.

### Rotation

`POST /api/guilds/:guildId/api-keys/:keyId/rotate`:
1. Generate new key
2. Update hash and prefix on same row (preserves name, permissions, rate limit)
3. Return new key (shown once)
4. Old key immediately stops working
5. Audit logged as `api_key.rotated`

Key ID stays stable. For overlapping validity during rotation, create a second key, swap, then revoke the old one.

## Rate Limiting

### Implementation

In-memory sliding window counter. `Map<string, { timestamps: number[] }>` keyed by API key hash. On each request, prune timestamps older than 60s, check count against limit.

### Tier Defaults

- Free: 60 req/min
- Premium: 300 req/min

### Resolution Order

Per-key `rateLimitPerMinute` override → guild tier default from `PLAN_DEFAULTS`.

### Response Headers

Every `/v1` response includes:
- `X-RateLimit-Limit: 60`
- `X-RateLimit-Remaining: 42`
- `X-RateLimit-Reset: 1712438400` (Unix epoch)

### 429 Response

```json
{ "error": "RATE_LIMIT_EXCEEDED", "retryAfter": 18 }
```

Plus `Retry-After: 18` header (seconds).

### Memory Cleanup

`setInterval` every 5 minutes prunes keys from the Map whose newest timestamp is older than 10 minutes. Prevents unbounded growth.

### Dashboard API

No rate limiting on `/api/*` in Phase 5. Session-authenticated, behind login, insufficient load to warrant it.

## Auth Middleware

### Dashboard Auth (existing)

Session from Better Auth cookie via existing `authPlugin` macro `{ auth: true }`. Permission guard via existing `checkPermissions` beforeHandle factory. No changes.

### API Key Auth (new)

Elysia plugin with `derive` that:
1. Extracts `Authorization: Bearer tk_...` header
2. SHA-256 hashes the key
3. Looks up `api_keys` row by hash
4. Validates not expired
5. Updates `lastUsedAt` (fire-and-forget)
6. Injects `apiKey` and `guildId` into context

### API Key Permission Guard (new)

`beforeHandle` factory: `checkKeyPermission('tickets.read')` checks `apiKey.permissions.includes(required)`.

### Middleware Order for `/v1` Routes

1. API key auth (derive) — validates key, injects context
2. Rate limiter (beforeHandle) — checks/updates sliding window
3. Permission check (beforeHandle) — checks key has required permission
4. Handler

## Validation

Elysia TypeBox schemas on every route for `body`, `params`, and `query`.

```typescript
// Example: create category
app.post('/categories', handler, {
  body: t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 500 })),
    emoji: t.Optional(t.String({ maxLength: 10 })),
    maxOpenPerUser: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  }),
  params: t.Object({
    guildId: t.Numeric(),
  }),
})
```

Query params for list endpoints:
```typescript
t.Object({
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
  status: t.Optional(t.Union([t.Literal('open'), t.Literal('pending'), ...])),
  categoryId: t.Optional(t.Numeric()),
})
```

Validation errors flow through global `onError` and return `{ error: "VALIDATION_ERROR", message: "..." }` with 400 status.

## Dashboard API Routes

All prefixed `/api`, session-authenticated, permission-guarded.

### Guilds

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds` | (authenticated) | List user's guilds |
| GET | `/api/guilds/:guildId` | (guild member) | Guild details + settings |
| PUT | `/api/guilds/:guildId/settings` | `admin.manage_settings` | Update guild settings |

### Categories

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds/:guildId/categories` | (guild member) | List categories |
| POST | `/api/guilds/:guildId/categories` | `admin.manage_categories` | Create category |
| PUT | `/api/guilds/:guildId/categories/:categoryId` | `admin.manage_categories` | Update category |
| DELETE | `/api/guilds/:guildId/categories/:categoryId` | `admin.manage_categories` | Delete category |

### Panels

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds/:guildId/panels` | (guild member) | List panels |
| POST | `/api/guilds/:guildId/panels` | `admin.manage_panels` | Create panel |
| PUT | `/api/guilds/:guildId/panels/:panelId` | `admin.manage_panels` | Update panel |
| DELETE | `/api/guilds/:guildId/panels/:panelId` | `admin.manage_panels` | Delete panel |
| POST | `/api/guilds/:guildId/panels/:panelId/deploy` | `admin.manage_panels` | Deploy panel embed to Discord channel |

### Tickets

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds/:guildId/tickets` | `tickets.view` | List tickets (cursor, filterable) |
| GET | `/api/guilds/:guildId/tickets/:ticketId` | `tickets.view` | Ticket detail with messages |
| PUT | `/api/guilds/:guildId/tickets/:ticketId/status` | `tickets.manage` | Change status |
| PUT | `/api/guilds/:guildId/tickets/:ticketId/priority` | `tickets.manage` | Change priority |
| PUT | `/api/guilds/:guildId/tickets/:ticketId/assign` | `tickets.manage` | Assign/reassign |

### Transcripts

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds/:guildId/transcripts` | `transcripts.view` | List transcripts (cursor) |
| GET | `/api/guilds/:guildId/transcripts/:transcriptId` | `transcripts.view` | Full transcript data |
| GET | `/api/guilds/:guildId/transcripts/:transcriptId/export` | `transcripts.export` | Download as HTML/JSON |

### Roles & Permissions

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds/:guildId/roles` | `admin.manage_roles` | List roles with permissions |
| PUT | `/api/guilds/:guildId/roles/:roleId/permissions` | `admin.manage_roles` | Set role permissions |
| POST | `/api/guilds/:guildId/roles/refresh` | `admin.manage_roles` | Re-sync from Discord |

### Audit Logs

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds/:guildId/audit-logs` | `admin.view_audit_logs` | List audit logs (cursor, filterable) |

### API Keys

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/guilds/:guildId/api-keys` | `admin.manage_api_keys` | List keys (masked) |
| POST | `/api/guilds/:guildId/api-keys` | `admin.manage_api_keys` | Create key (returns full key once) |
| POST | `/api/guilds/:guildId/api-keys/:keyId/rotate` | `admin.manage_api_keys` | Rotate key |
| DELETE | `/api/guilds/:guildId/api-keys/:keyId` | `admin.manage_api_keys` | Revoke (hard delete) |

### User

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/user/me` | (authenticated) | Current user profile |
| POST | `/api/guilds/refresh` | (authenticated) | Re-sync guilds from Discord |

## Public API Routes

All prefixed `/v1`, API key authenticated, rate limited. Guild is implicit from the API key.

### Tickets

| Method | Path | Key Permission | Description |
|--------|------|---------------|-------------|
| GET | `/v1/tickets` | `tickets.read` | List guild's tickets (cursor, filterable) |
| GET | `/v1/tickets/:ticketId` | `tickets.read` | Ticket detail |
| PUT | `/v1/tickets/:ticketId/status` | `tickets.update` | Change status |
| PUT | `/v1/tickets/:ticketId/priority` | `tickets.update` | Change priority |
| PUT | `/v1/tickets/:ticketId/assign` | `tickets.update` | Assign/reassign |
| POST | `/v1/tickets/:ticketId/close` | `tickets.update` | Close ticket |

### Transcripts

| Method | Path | Key Permission | Description |
|--------|------|---------------|-------------|
| GET | `/v1/transcripts` | `transcripts.read` | List guild's transcripts (cursor) |
| GET | `/v1/transcripts/:transcriptId` | `transcripts.read` | Full transcript |

### Categories

| Method | Path | Key Permission | Description |
|--------|------|---------------|-------------|
| GET | `/v1/categories` | `categories.read` | List guild's categories (read-only) |

### Audit Logs

| Method | Path | Key Permission | Description |
|--------|------|---------------|-------------|
| GET | `/v1/audit-logs` | `audit_logs.read` | List guild's audit logs (cursor, filterable) |

### Guild

| Method | Path | Key Permission | Description |
|--------|------|---------------|-------------|
| GET | `/v1/guild` | `guild.read` | Guild info + settings (read-only) |

## Service Layer

Route handlers are thin. All business logic in `apps/server/src/services/`.

| Service | Responsibility |
|---------|---------------|
| `guild.ts` | Guild details, settings update, guild list for user |
| `ticket.ts` | List/get/status/priority/assign/close tickets with cursor pagination |
| `category.ts` | Category CRUD |
| `panel.ts` | Panel CRUD + deploy to Discord via `@discordjs/rest` |
| `transcript.ts` | Transcript list/get/export |
| `audit-log.ts` | Audit log list with cursor + filters |
| `role.ts` | Role list, permission update |
| `api-key.ts` | Key create/list/revoke/rotate |
| `cursor.ts` | Encode/decode/validate cursor, paginated query helper |

### Panel Deploy

`POST /api/guilds/:guildId/panels/:panelId/deploy` uses `@discordjs/rest` (REST client only, no bot gateway) to send the panel embed + buttons to the target Discord channel. The bot token is read from env. This is the only endpoint that talks to Discord.

## Scope Boundaries

### In Phase 5

- Schema: `api_keys` table, migration regenerated
- Config: `apiRateLimitPerMinute` added to `PLAN_DEFAULTS`
- Lib: `ApiError`, cursor encode/decode/validate, rate limiter
- Middleware: API key auth plugin, API key permission guard
- Services: 9 service modules (guild, ticket, category, panel, transcript, audit-log, role, api-key, cursor)
- Dashboard routes: 22 endpoints across 10 route files
- Public routes: 11 endpoints across 5 route files
- Validation: TypeBox schemas on all routes
- Global error handler
- Rate limit cleanup interval
- Panel deploy via `@discordjs/rest`

### Deferred

| Feature | Phase |
|---------|-------|
| SSE/WebSocket real-time updates | Future enhancement |
| Dashboard API rate limiting | When needed |
| API key usage analytics | Future enhancement |
| Webhook notifications | Future enhancement |
| Batch/bulk operations | Future enhancement |
| API versioning beyond v1 | When breaking changes needed |
| Public API write operations (create tickets) | Future enhancement |

## File Map

### New files

- `packages/db/src/schema/api-keys.ts` — api_keys table, relations, type exports
- `apps/server/src/lib/api-error.ts` — ApiError class
- `apps/server/src/lib/cursor.ts` — Cursor encode/decode/validate
- `apps/server/src/lib/rate-limiter.ts` — In-memory sliding window rate limiter
- `apps/server/src/middleware/api-key.ts` — API key auth derive plugin
- `apps/server/src/middleware/api-key-guard.ts` — Key permission beforeHandle guard
- `apps/server/src/services/guild.ts` — Guild details, settings, list
- `apps/server/src/services/ticket.ts` — Ticket CRUD + pagination
- `apps/server/src/services/category.ts` — Category CRUD
- `apps/server/src/services/panel.ts` — Panel CRUD + deploy
- `apps/server/src/services/transcript.ts` — Transcript list/get/export
- `apps/server/src/services/audit-log.ts` — Audit log list + filters
- `apps/server/src/services/role.ts` — Role list, permission update
- `apps/server/src/services/api-key.ts` — Key create/list/revoke/rotate
- `apps/server/src/routes/api/guilds.ts` — /api/guilds
- `apps/server/src/routes/api/settings.ts` — /api/guilds/:guildId/settings
- `apps/server/src/routes/api/categories.ts` — /api/guilds/:guildId/categories
- `apps/server/src/routes/api/panels.ts` — /api/guilds/:guildId/panels
- `apps/server/src/routes/api/tickets.ts` — /api/guilds/:guildId/tickets
- `apps/server/src/routes/api/transcripts.ts` — /api/guilds/:guildId/transcripts
- `apps/server/src/routes/api/roles.ts` — /api/guilds/:guildId/roles
- `apps/server/src/routes/api/audit-logs.ts` — /api/guilds/:guildId/audit-logs
- `apps/server/src/routes/api/api-keys.ts` — /api/guilds/:guildId/api-keys
- `apps/server/src/routes/api/user.ts` — /api/user/me
- `apps/server/src/routes/v1/tickets.ts` — /v1/tickets
- `apps/server/src/routes/v1/transcripts.ts` — /v1/transcripts
- `apps/server/src/routes/v1/categories.ts` — /v1/categories
- `apps/server/src/routes/v1/audit-logs.ts` — /v1/audit-logs
- `apps/server/src/routes/v1/guild.ts` — /v1/guild

### Modified files

- `apps/server/src/index.ts` — Mount route groups, global onError, rate limit cleanup interval
- `apps/server/package.json` — Add `@discordjs/rest` dependency
- `packages/db/src/schema/index.ts` — Export api-keys
- `packages/shared/src/constants/plan-defaults.ts` — Add apiRateLimitPerMinute
- `packages/db/migrations/` — Regenerated
