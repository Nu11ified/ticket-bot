# Phase 6: Next.js Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full admin dashboard for TicketBot — guild-scoped management of tickets, categories, panels, transcripts, roles, audit logs, API keys, and user-level billing with premium quota assignment.

**Architecture:** Next.js 15 App Router with route groups: `(auth)` for login, `(dashboard)` for the authenticated shell. Guild-scoped pages live under `[guildId]/` with sidebar + permission context. All data fetching via TanStack Query hooks wrapping a typed fetch client that talks to the Phase 5 Elysia API. Forms use React Hook Form + Zod. UI built on shadcn/ui restyled to the existing glass morphism theme.

**Tech Stack:** Next.js 15, React 19, TanStack Query v5, React Hook Form, Zod, shadcn/ui, Sonner, Tailwind CSS v4, Lucide React

---

## File Map

### Server additions
- Create: `packages/db/src/schema/billing.ts` — premium_assignments table
- Modify: `packages/db/src/schema/users.ts` — add billing columns
- Modify: `packages/db/src/schema/index.ts` — export billing schema
- Modify: `packages/db/src/client.ts` — add billing schema
- Create: `apps/server/src/services/billing.ts` — billing service
- Create: `apps/server/src/routes/api/billing.ts` — billing routes
- Modify: `apps/server/src/routes/api/guilds.ts` — add permissions endpoint
- Modify: `apps/server/src/index.ts` — mount billing routes

### Dashboard foundation
- Modify: `apps/dashboard/package.json` — add dependencies
- Modify: `apps/dashboard/next.config.ts` — add API rewrites
- Create: `apps/dashboard/components.json` — shadcn config
- Modify: `apps/dashboard/src/app/globals.css` — shadcn CSS variables + glass theme
- Create: `apps/dashboard/src/lib/api.ts` — typed fetch wrapper
- Create: `apps/dashboard/src/lib/query-client.ts` — QueryClient config
- Create: `apps/dashboard/src/providers/query-provider.tsx`
- Create: `apps/dashboard/src/providers/user-provider.tsx`
- Create: `apps/dashboard/src/providers/guild-provider.tsx`
- Create: `apps/dashboard/src/providers/permission-provider.tsx`
- Modify: `apps/dashboard/src/app/layout.tsx` — wrap with providers

### Shared components
- Create: `apps/dashboard/src/components/ui/` — shadcn components (via CLI)
- Create: `apps/dashboard/src/components/data-table.tsx`
- Create: `apps/dashboard/src/components/cursor-pagination.tsx`
- Create: `apps/dashboard/src/components/require-permission.tsx`
- Create: `apps/dashboard/src/components/filter-bar.tsx`
- Create: `apps/dashboard/src/components/confirm-dialog.tsx`
- Create: `apps/dashboard/src/components/page-header.tsx`
- Create: `apps/dashboard/src/components/empty-state.tsx`
- Create: `apps/dashboard/src/components/status-badge.tsx`
- Create: `apps/dashboard/src/components/priority-badge.tsx`

### Layout
- Create: `apps/dashboard/src/app/(auth)/layout.tsx`
- Create: `apps/dashboard/src/app/(auth)/login/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/layout.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/guilds/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/billing/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/layout.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/page.tsx`
- Create: `apps/dashboard/src/components/layout/top-bar.tsx`
- Create: `apps/dashboard/src/components/layout/sidebar.tsx`
- Create: `apps/dashboard/src/components/layout/mobile-nav.tsx`

### Pages + hooks + schemas
- Create: `apps/dashboard/src/hooks/use-user.ts`
- Create: `apps/dashboard/src/hooks/use-guilds.ts`
- Create: `apps/dashboard/src/hooks/use-categories.ts`
- Create: `apps/dashboard/src/hooks/use-panels.ts`
- Create: `apps/dashboard/src/hooks/use-tickets.ts`
- Create: `apps/dashboard/src/hooks/use-transcripts.ts`
- Create: `apps/dashboard/src/hooks/use-roles.ts`
- Create: `apps/dashboard/src/hooks/use-audit-logs.ts`
- Create: `apps/dashboard/src/hooks/use-api-keys.ts`
- Create: `apps/dashboard/src/hooks/use-billing.ts`
- Create: `apps/dashboard/src/schemas/settings.ts`
- Create: `apps/dashboard/src/schemas/category.ts`
- Create: `apps/dashboard/src/schemas/panel.ts`
- Create: `apps/dashboard/src/schemas/api-key.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/settings/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/categories/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/panels/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/panels/[panelId]/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/tickets/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/tickets/[ticketId]/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/transcripts/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/roles/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/audit-logs/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/api-keys/page.tsx`

---

### Task 1: Server — Billing Schema + Service + Routes + Permissions Endpoint

**Files:**
- Modify: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/billing.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/client.ts`
- Create: `apps/server/src/services/billing.ts`
- Create: `apps/server/src/routes/api/billing.ts`
- Modify: `apps/server/src/routes/api/guilds.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Add billing columns to users schema**

In `packages/db/src/schema/users.ts`, add three columns to the `users` table:

```typescript
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
	polarCustomerId: text('polar_customer_id'),
	subscriptionStatus: text('subscription_status').default('none').notNull(),
	premiumGuildQuota: integer('premium_guild_quota').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 2: Create premium_assignments table**

Create `packages/db/src/schema/billing.ts`:

```typescript
import { relations } from 'drizzle-orm'
import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { guilds } from './guilds.js'
import { users } from './users.js'

export const premiumAssignments = pgTable(
	'premium_assignments',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		guildId: integer('guild_id')
			.notNull()
			.references(() => guilds.id, { onDelete: 'cascade' }),
		assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		uniqueUserGuild: unique('uq_premium_assignments_user_guild').on(t.userId, t.guildId),
	}),
)

export const premiumAssignmentsRelations = relations(premiumAssignments, ({ one }) => ({
	user: one(users, { fields: [premiumAssignments.userId], references: [users.id] }),
	guild: one(guilds, { fields: [premiumAssignments.guildId], references: [guilds.id] }),
}))

export type PremiumAssignment = typeof premiumAssignments.$inferSelect
```

- [ ] **Step 3: Export billing schema**

In `packages/db/src/schema/index.ts`, add:

```typescript
export * from './billing.js'
```

In `packages/db/src/client.ts`, add the import and spread:

```typescript
import * as billingSchema from './schema/billing.js'

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
	...billingSchema,
}
```

- [ ] **Step 4: Run migration**

```bash
cd /data/github/ticket-bot && pnpm db:generate
```

Expected: migration SQL file created in `packages/db/migrations/`

- [ ] **Step 5: Create billing service**

Create `apps/server/src/services/billing.ts`:

```typescript
import type { Database } from '@ticketbot/db'
import { guildMembers, guilds, premiumAssignments, users } from '@ticketbot/db'
import { resolveUserPermissions } from '@ticketbot/auth'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function getBillingInfo(db: Database, userId: string) {
	const userRows = await db
		.select({
			polarCustomerId: users.polarCustomerId,
			subscriptionStatus: users.subscriptionStatus,
			premiumGuildQuota: users.premiumGuildQuota,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	const user = userRows[0]
	if (!user) {
		throw new ApiError(404, 'USER_NOT_FOUND', 'User not found')
	}

	const assignments = await db
		.select({
			id: premiumAssignments.id,
			guildId: premiumAssignments.guildId,
			guildName: guilds.name,
			guildIconUrl: guilds.iconUrl,
			assignedAt: premiumAssignments.assignedAt,
		})
		.from(premiumAssignments)
		.innerJoin(guilds, eq(premiumAssignments.guildId, guilds.id))
		.where(eq(premiumAssignments.userId, userId))

	return {
		subscriptionStatus: user.subscriptionStatus,
		polarCustomerId: user.polarCustomerId,
		quota: {
			total: user.premiumGuildQuota,
			used: assignments.length,
			available: user.premiumGuildQuota - assignments.length,
		},
		assignments,
	}
}

export async function assignPremium(db: Database, userId: string, guildId: number) {
	// Check user has admin permission in guild
	const perms = await resolveUserPermissions(db, userId, guildId)
	if (!perms.has('admin.manage_settings')) {
		throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'You must be an admin in this guild')
	}

	// Check quota
	const userRows = await db
		.select({ premiumGuildQuota: users.premiumGuildQuota })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	const user = userRows[0]
	if (!user) {
		throw new ApiError(404, 'USER_NOT_FOUND', 'User not found')
	}

	const existingCount = await db
		.select({ id: premiumAssignments.id })
		.from(premiumAssignments)
		.where(eq(premiumAssignments.userId, userId))

	if (existingCount.length >= user.premiumGuildQuota) {
		throw new ApiError(400, 'QUOTA_EXCEEDED', 'No premium slots available')
	}

	// Check not already assigned
	const existing = await db
		.select({ id: premiumAssignments.id })
		.from(premiumAssignments)
		.where(
			and(eq(premiumAssignments.userId, userId), eq(premiumAssignments.guildId, guildId)),
		)
		.limit(1)

	if (existing[0]) {
		throw new ApiError(409, 'ALREADY_ASSIGNED', 'Premium already assigned to this guild')
	}

	// Create assignment and update guild tier
	await db.insert(premiumAssignments).values({ userId, guildId })
	await db.update(guilds).set({ planTier: 'premium', updatedAt: new Date() }).where(eq(guilds.id, guildId))

	return { success: true }
}

export async function unassignPremium(db: Database, userId: string, guildId: number) {
	const rows = await db
		.delete(premiumAssignments)
		.where(
			and(eq(premiumAssignments.userId, userId), eq(premiumAssignments.guildId, guildId)),
		)
		.returning()

	if (rows.length === 0) {
		throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND', 'No premium assignment found for this guild')
	}

	// Check if any other user still has premium assigned to this guild
	const otherAssignments = await db
		.select({ id: premiumAssignments.id })
		.from(premiumAssignments)
		.where(eq(premiumAssignments.guildId, guildId))
		.limit(1)

	if (!otherAssignments[0]) {
		await db.update(guilds).set({ planTier: 'free', updatedAt: new Date() }).where(eq(guilds.id, guildId))
	}

	return { success: true }
}
```

- [ ] **Step 6: Create billing routes**

Create `apps/server/src/routes/api/billing.ts`:

```typescript
import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { assignPremium, getBillingInfo, unassignPremium } from '../../services/billing.js'

export function billingRoutes(db: Database) {
	return new Elysia({ prefix: '/billing' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user }: any) => {
				const billing = await getBillingInfo(db, user.id)
				return { data: billing }
			},
			// @ts-expect-error auth macro injected by parent plugin
			{ auth: true },
		)
		.post(
			'/assign',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, body }: any) => {
				const result = await assignPremium(db, user.id, body.guildId)
				return result
			},
			{
				auth: true,
				body: t.Object({
					guildId: t.Integer({ minimum: 1 }),
				}),
			},
		)
		.post(
			'/unassign',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, body }: any) => {
				const result = await unassignPremium(db, user.id, body.guildId)
				return result
			},
			{
				auth: true,
				body: t.Object({
					guildId: t.Integer({ minimum: 1 }),
				}),
			},
		)
}
```

- [ ] **Step 7: Add permissions endpoint to guild routes**

In `apps/server/src/routes/api/guilds.ts`, add the `resolveUserPermissions` import and a new endpoint after the GET `/:guildId` route:

Add import at top:
```typescript
import { resolveUserPermissions, syncUserGuilds } from '@ticketbot/auth'
```

Add route after `GET /:guildId`:
```typescript
		.get(
			'/:guildId/permissions',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, params }: any) => {
				const guildId = Number(params.guildId)
				const perms = await resolveUserPermissions(db, user.id, guildId)
				return { data: { permissions: Array.from(perms) } }
			},
			{
				auth: true,
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
```

- [ ] **Step 8: Mount billing routes in index.ts**

In `apps/server/src/index.ts`, add the import:

```typescript
import { billingRoutes } from './routes/api/billing.js'
```

Add `.use(billingRoutes(db))` inside the `/api` group, after `.use(apiKeyRoutes(db))`.

- [ ] **Step 9: Build and verify**

```bash
cd /data/github/ticket-bot && pnpm --filter @ticketbot/db exec tsc --noEmit && pnpm --filter @ticketbot/server exec tsc --noEmit && bunx biome check apps/server/src/services/billing.ts apps/server/src/routes/api/billing.ts apps/server/src/routes/api/guilds.ts
```

Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add packages/db/src/schema/billing.ts packages/db/src/schema/users.ts packages/db/src/schema/index.ts packages/db/src/client.ts packages/db/migrations/ apps/server/src/services/billing.ts apps/server/src/routes/api/billing.ts apps/server/src/routes/api/guilds.ts apps/server/src/index.ts
git commit -m "$(cat <<'EOF'
feat(server): add billing schema, service, routes, and permissions endpoint

- Add polarCustomerId, subscriptionStatus, premiumGuildQuota to users
- Create premium_assignments table for guild quota tracking
- Billing service: getBillingInfo, assignPremium, unassignPremium
- Billing routes: GET /api/billing, POST assign/unassign
- Add GET /api/guilds/:guildId/permissions for dashboard permission context
EOF
)"
```

---

### Task 2: Dashboard Dependencies + shadcn/ui Setup

**Files:**
- Modify: `apps/dashboard/package.json`
- Modify: `apps/dashboard/next.config.ts`
- Create: `apps/dashboard/components.json`
- Modify: `apps/dashboard/src/app/globals.css`

- [ ] **Step 1: Install dashboard dependencies**

```bash
cd /data/github/ticket-bot/apps/dashboard && pnpm add @tanstack/react-query@^5 react-hook-form @hookform/resolvers zod sonner
```

- [ ] **Step 2: Add API proxy rewrites to next.config.ts**

Replace `apps/dashboard/next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	output: 'standalone',
	transpilePackages: ['@ticketbot/shared'],
	async rewrites() {
		return [
			{
				source: '/api/:path*',
				destination: `${process.env.API_URL || 'http://localhost:3001'}/api/:path*`,
			},
		]
	},
}

export default nextConfig
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx shadcn@latest init -d
```

If the CLI prompts, choose:
- Style: New York
- Base color: Neutral
- CSS variables: Yes

This creates `components.json` and may modify `globals.css`. After init, verify `components.json` exists.

- [ ] **Step 4: Install required shadcn components**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx shadcn@latest add button input select textarea dialog sheet table tabs badge card dropdown-menu command form label checkbox switch separator skeleton tooltip popover avatar -y
```

- [ ] **Step 5: Update globals.css for glass morphism + shadcn integration**

Replace `apps/dashboard/src/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
	--color-glass-50: rgba(255, 255, 255, 0.05);
	--color-glass-100: rgba(255, 255, 255, 0.1);
	--color-glass-200: rgba(255, 255, 255, 0.2);
	--color-glass-300: rgba(255, 255, 255, 0.3);
	--color-surface: rgba(15, 15, 20, 1);
	--color-surface-raised: rgba(25, 25, 35, 1);
	--color-surface-overlay: rgba(30, 30, 45, 0.8);
	--color-accent: rgba(99, 102, 241, 1);
	--color-accent-glow: rgba(99, 102, 241, 0.3);
}

:root {
	--background: 240 10% 5%;
	--foreground: 0 0% 90%;
	--card: 240 10% 8%;
	--card-foreground: 0 0% 90%;
	--popover: 240 10% 8%;
	--popover-foreground: 0 0% 90%;
	--primary: 239 84% 67%;
	--primary-foreground: 0 0% 100%;
	--secondary: 240 10% 15%;
	--secondary-foreground: 0 0% 90%;
	--muted: 240 10% 15%;
	--muted-foreground: 0 0% 55%;
	--accent: 240 10% 18%;
	--accent-foreground: 0 0% 90%;
	--destructive: 0 84% 60%;
	--destructive-foreground: 0 0% 100%;
	--border: 240 10% 15%;
	--input: 240 10% 15%;
	--ring: 239 84% 67%;
	--radius: 0.75rem;
}

body {
	background: var(--color-surface);
	color: rgba(255, 255, 255, 0.9);
	font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
	-webkit-font-smoothing: antialiased;
}

.glass-panel {
	background: var(--color-surface-overlay);
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border: 1px solid var(--color-glass-100);
	border-radius: 16px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.glass-panel:hover {
	border-color: var(--color-glass-200);
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.glass-button {
	background: var(--color-glass-100);
	backdrop-filter: blur(12px);
	border: 1px solid var(--color-glass-200);
	border-radius: 12px;
	padding: 8px 16px;
	color: rgba(255, 255, 255, 0.9);
	transition: all 0.2s ease;
}

.glass-button:hover {
	background: var(--color-glass-200);
	border-color: var(--color-glass-300);
}
```

- [ ] **Step 6: Verify build**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
cd /data/github/ticket-bot && git add apps/dashboard/
git commit -m "$(cat <<'EOF'
feat(dashboard): install deps, init shadcn/ui, configure API proxy

- Add TanStack Query, React Hook Form, Zod, Sonner
- Initialize shadcn/ui with all required components
- Add API proxy rewrites in next.config.ts
- Integrate glass morphism theme with shadcn CSS variables
EOF
)"
```

---

### Task 3: API Client + Query Provider + Core Providers

**Files:**
- Create: `apps/dashboard/src/lib/api.ts`
- Create: `apps/dashboard/src/lib/query-client.ts`
- Create: `apps/dashboard/src/providers/query-provider.tsx`
- Create: `apps/dashboard/src/providers/user-provider.tsx`
- Create: `apps/dashboard/src/providers/guild-provider.tsx`
- Create: `apps/dashboard/src/providers/permission-provider.tsx`
- Modify: `apps/dashboard/src/app/layout.tsx`

- [ ] **Step 1: Create typed fetch wrapper**

Create `apps/dashboard/src/lib/api.ts`:

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

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...options?.headers,
		},
	})

	if (res.status === 401) {
		window.location.href = '/login'
		throw new ApiError(401, 'UNAUTHORIZED', 'Session expired')
	}

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: 'UNKNOWN', message: 'Request failed' }))
		throw new ApiError(res.status, body.error, body.message)
	}

	return res.json()
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'POST',
		body: JSON.stringify(body),
	})
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'PUT',
		body: JSON.stringify(body),
	})
}

export function apiDelete<T>(path: string): Promise<T> {
	return apiFetch<T>(path, { method: 'DELETE' })
}
```

- [ ] **Step 2: Create QueryClient config**

Create `apps/dashboard/src/lib/query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				gcTime: 300_000,
				retry: 3,
				refetchOnWindowFocus: false,
			},
			mutations: {
				onError(error) {
					if (error instanceof ApiError) {
						toast.error(error.message)
					} else {
						toast.error('Something went wrong')
					}
				},
			},
		},
	})
}
```

- [ ] **Step 3: Create QueryProvider**

Create `apps/dashboard/src/providers/query-provider.tsx`:

```tsx
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createQueryClient } from '@/lib/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(() => createQueryClient())
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

- [ ] **Step 4: Create UserProvider**

Create `apps/dashboard/src/providers/user-provider.tsx`:

```tsx
'use client'

import { createContext, useContext } from 'react'

export interface CurrentUser {
	id: string
	username: string
	displayName: string | null
	avatarUrl: string | null
	email: string | null
}

const UserContext = createContext<CurrentUser | null>(null)

export function UserProvider({
	user,
	children,
}: {
	user: CurrentUser
	children: React.ReactNode
}) {
	return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useCurrentUser() {
	const user = useContext(UserContext)
	if (!user) throw new Error('useCurrentUser must be used within UserProvider')
	return user
}
```

- [ ] **Step 5: Create GuildProvider**

Create `apps/dashboard/src/providers/guild-provider.tsx`:

```tsx
'use client'

import { createContext, useContext } from 'react'

export interface GuildInfo {
	id: number
	discordId: string
	name: string
	iconUrl: string | null
	planTier: string
	settings: {
		logChannelId: string | null
		transcriptChannelId: string | null
		locale: string
		timezone: string
		autoCloseHours: number | null
		transcriptRetentionDays: number
		ticketCooldownSeconds: number
	} | null
}

const GuildContext = createContext<GuildInfo | null>(null)

export function GuildProvider({
	guild,
	children,
}: {
	guild: GuildInfo
	children: React.ReactNode
}) {
	return <GuildContext.Provider value={guild}>{children}</GuildContext.Provider>
}

export function useGuild() {
	const guild = useContext(GuildContext)
	if (!guild) throw new Error('useGuild must be used within GuildProvider')
	return guild
}
```

- [ ] **Step 6: Create PermissionProvider**

Create `apps/dashboard/src/providers/permission-provider.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext } from 'react'

const PermissionContext = createContext<Set<string>>(new Set())

export function PermissionProvider({
	permissions,
	children,
}: {
	permissions: string[]
	children: React.ReactNode
}) {
	const permSet = new Set(permissions)
	return <PermissionContext.Provider value={permSet}>{children}</PermissionContext.Provider>
}

export function usePermissions() {
	return useContext(PermissionContext)
}

export function useHasPermission(permission: string) {
	const perms = useContext(PermissionContext)
	return perms.has(permission)
}
```

- [ ] **Step 7: Update root layout**

Replace `apps/dashboard/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/providers/query-provider'
import './globals.css'

export const metadata: Metadata = {
	title: 'TicketBot Dashboard',
	description: 'Manage your Discord ticket bot',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<body className="min-h-screen bg-surface antialiased">
				<QueryProvider>
					{children}
					<Toaster theme="dark" richColors />
				</QueryProvider>
			</body>
		</html>
	)
}
```

- [ ] **Step 8: Verify**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit && cd /data/github/ticket-bot && bunx biome check apps/dashboard/src/lib/api.ts apps/dashboard/src/lib/query-client.ts apps/dashboard/src/providers/
```

- [ ] **Step 9: Commit**

```bash
cd /data/github/ticket-bot && git add apps/dashboard/src/lib/api.ts apps/dashboard/src/lib/query-client.ts apps/dashboard/src/providers/ apps/dashboard/src/app/layout.tsx
git commit -m "feat(dashboard): add API client, query config, and context providers"
```

---

### Task 4: Shared UI Components

**Files:**
- Create: `apps/dashboard/src/components/require-permission.tsx`
- Create: `apps/dashboard/src/components/page-header.tsx`
- Create: `apps/dashboard/src/components/empty-state.tsx`
- Create: `apps/dashboard/src/components/status-badge.tsx`
- Create: `apps/dashboard/src/components/priority-badge.tsx`
- Create: `apps/dashboard/src/components/cursor-pagination.tsx`
- Create: `apps/dashboard/src/components/data-table.tsx`
- Create: `apps/dashboard/src/components/confirm-dialog.tsx`
- Create: `apps/dashboard/src/components/filter-bar.tsx`

- [ ] **Step 1: Create RequirePermission**

Create `apps/dashboard/src/components/require-permission.tsx`:

```tsx
'use client'

import { ShieldX } from 'lucide-react'
import { useHasPermission } from '@/providers/permission-provider'

export function RequirePermission({
	permission,
	children,
}: {
	permission: string
	children: React.ReactNode
}) {
	const hasPermission = useHasPermission(permission)

	if (!hasPermission) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
				<ShieldX className="h-12 w-12" />
				<h2 className="text-lg font-medium">Access denied</h2>
				<p className="text-sm">You don&apos;t have permission to view this page.</p>
			</div>
		)
	}

	return <>{children}</>
}
```

- [ ] **Step 2: Create PageHeader**

Create `apps/dashboard/src/components/page-header.tsx`:

```tsx
export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string
	description?: string
	actions?: React.ReactNode
}) {
	return (
		<div className="flex items-center justify-between mb-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	)
}
```

- [ ] **Step 3: Create EmptyState**

Create `apps/dashboard/src/components/empty-state.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react'

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: LucideIcon
	title: string
	description: string
	action?: React.ReactNode
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
			<Icon className="h-10 w-10 text-muted-foreground" />
			<h3 className="text-base font-medium">{title}</h3>
			<p className="text-sm text-muted-foreground max-w-sm">{description}</p>
			{action}
		</div>
	)
}
```

- [ ] **Step 4: Create StatusBadge and PriorityBadge**

Create `apps/dashboard/src/components/status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import type { TicketStatus } from '@ticketbot/shared'

const statusColors: Record<TicketStatus, string> = {
	open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
	pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
	waiting_user: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
	waiting_staff: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
	escalated: 'bg-red-500/20 text-red-400 border-red-500/30',
	resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
	closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
	archived: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
}

const statusLabels: Record<TicketStatus, string> = {
	open: 'Open',
	pending: 'Pending',
	waiting_user: 'Waiting User',
	waiting_staff: 'Waiting Staff',
	escalated: 'Escalated',
	resolved: 'Resolved',
	closed: 'Closed',
	archived: 'Archived',
}

export function StatusBadge({ status }: { status: TicketStatus }) {
	return (
		<Badge variant="outline" className={statusColors[status]}>
			{statusLabels[status]}
		</Badge>
	)
}
```

Create `apps/dashboard/src/components/priority-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import type { TicketPriority } from '@ticketbot/shared'

const priorityColors: Record<TicketPriority, string> = {
	low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
	normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
	high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
	urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const priorityLabels: Record<TicketPriority, string> = {
	low: 'Low',
	normal: 'Normal',
	high: 'High',
	urgent: 'Urgent',
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
	return (
		<Badge variant="outline" className={priorityColors[priority]}>
			{priorityLabels[priority]}
		</Badge>
	)
}
```

- [ ] **Step 5: Create CursorPagination**

Create `apps/dashboard/src/components/cursor-pagination.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CursorPaginationProps {
	hasMore: boolean
	hasPrev: boolean
	onNext: () => void
	onPrev: () => void
}

export function CursorPagination({ hasMore, hasPrev, onNext, onPrev }: CursorPaginationProps) {
	return (
		<div className="flex items-center justify-end gap-2 mt-4">
			<Button variant="outline" size="sm" disabled={!hasPrev} onClick={onPrev}>
				<ChevronLeft className="h-4 w-4 mr-1" />
				Previous
			</Button>
			<Button variant="outline" size="sm" disabled={!hasMore} onClick={onNext}>
				Next
				<ChevronRight className="h-4 w-4 ml-1" />
			</Button>
		</div>
	)
}
```

- [ ] **Step 6: Create DataTable**

Create `apps/dashboard/src/components/data-table.tsx`:

```tsx
'use client'

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export interface Column<T> {
	key: string
	header: string
	cell: (row: T) => React.ReactNode
	className?: string
}

interface DataTableProps<T> {
	columns: Column<T>[]
	data: T[]
	isLoading?: boolean
	onRowClick?: (row: T) => void
	emptyState?: React.ReactNode
}

export function DataTable<T>({
	columns,
	data,
	isLoading,
	onRowClick,
	emptyState,
}: DataTableProps<T>) {
	if (isLoading) {
		return (
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((col) => (
							<TableHead key={col.key} className={col.className}>
								{col.header}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: 5 }).map((_, i) => (
						<TableRow key={i}>
							{columns.map((col) => (
								<TableCell key={col.key}>
									<Skeleton className="h-4 w-full" />
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		)
	}

	if (data.length === 0 && emptyState) {
		return <>{emptyState}</>
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					{columns.map((col) => (
						<TableHead key={col.key} className={col.className}>
							{col.header}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{data.map((row, i) => (
					<TableRow
						key={i}
						className={onRowClick ? 'cursor-pointer hover:bg-glass-50' : undefined}
						onClick={() => onRowClick?.(row)}
					>
						{columns.map((col) => (
							<TableCell key={col.key} className={col.className}>
								{col.cell(row)}
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}
```

- [ ] **Step 7: Create ConfirmDialog**

Create `apps/dashboard/src/components/confirm-dialog.tsx`:

```tsx
'use client'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	confirmLabel?: string
	destructive?: boolean
	onConfirm: () => void
	loading?: boolean
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = 'Confirm',
	destructive = false,
	onConfirm,
	loading,
}: ConfirmDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={loading}
						className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
					>
						{loading ? 'Loading...' : confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
```

Note: If shadcn does not include `alert-dialog` by default, install it:
```bash
npx shadcn@latest add alert-dialog -y
```

- [ ] **Step 8: Create FilterBar**

Create `apps/dashboard/src/components/filter-bar.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'

interface FilterOption {
	label: string
	value: string
}

interface FilterConfig {
	key: string
	label: string
	options: FilterOption[]
}

interface FilterBarProps {
	filters: FilterConfig[]
	values: Record<string, string | undefined>
	onChange: (key: string, value: string | undefined) => void
}

export function FilterBar({ filters, values, onChange }: FilterBarProps) {
	const activeFilters = Object.entries(values).filter(([, v]) => v !== undefined)

	return (
		<div className="flex flex-wrap items-center gap-2 mb-4">
			{filters.map((filter) => (
				<Select
					key={filter.key}
					value={values[filter.key] ?? ''}
					onValueChange={(v) => onChange(filter.key, v || undefined)}
				>
					<SelectTrigger className="w-[160px] h-8 text-xs">
						<SelectValue placeholder={filter.label} />
					</SelectTrigger>
					<SelectContent>
						{filter.options.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			))}
			{activeFilters.length > 0 && (
				<Button
					variant="ghost"
					size="sm"
					className="h-8 text-xs"
					onClick={() => {
						for (const [key] of activeFilters) {
							onChange(key, undefined)
						}
					}}
				>
					Clear filters
					<X className="h-3 w-3 ml-1" />
				</Button>
			)}
		</div>
	)
}
```

- [ ] **Step 9: Verify**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit && cd /data/github/ticket-bot && bunx biome check apps/dashboard/src/components/require-permission.tsx apps/dashboard/src/components/page-header.tsx apps/dashboard/src/components/empty-state.tsx apps/dashboard/src/components/status-badge.tsx apps/dashboard/src/components/priority-badge.tsx apps/dashboard/src/components/cursor-pagination.tsx apps/dashboard/src/components/data-table.tsx apps/dashboard/src/components/confirm-dialog.tsx apps/dashboard/src/components/filter-bar.tsx
```

- [ ] **Step 10: Commit**

```bash
cd /data/github/ticket-bot && git add apps/dashboard/src/components/
git commit -m "feat(dashboard): add shared UI components — table, pagination, badges, guards"
```

---

### Task 5: Auth Layout + Login Page

**Files:**
- Create: `apps/dashboard/src/app/(auth)/layout.tsx`
- Create: `apps/dashboard/src/app/(auth)/login/page.tsx`
- Modify: `apps/dashboard/src/app/page.tsx`

- [ ] **Step 1: Create auth layout**

Create `apps/dashboard/src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center p-8">{children}</main>
	)
}
```

- [ ] **Step 2: Create login page**

Create `apps/dashboard/src/app/(auth)/login/page.tsx`:

```tsx
import { LogIn } from 'lucide-react'

export default function LoginPage() {
	const apiBase = process.env.API_URL || 'http://localhost:3001'

	return (
		<div className="glass-panel p-12 text-center max-w-md">
			<h1 className="text-3xl font-semibold tracking-tight mb-3">TicketBot</h1>
			<p className="text-glass-300 text-sm mb-6">
				Sign in to manage your Discord servers.
			</p>
			<a
				href={`${apiBase}/api/auth/sign-in/social?provider=discord&callbackURL=/guilds`}
				className="glass-button inline-flex items-center gap-2"
			>
				<LogIn className="h-4 w-4" />
				Sign in with Discord
			</a>
		</div>
	)
}
```

- [ ] **Step 3: Update landing page to redirect**

Replace `apps/dashboard/src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
	redirect('/guilds')
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/app/
git commit -m "feat(dashboard): add auth layout and login page with Discord OAuth"
```

---

### Task 6: Dashboard Layout + Top Bar + User Hook

**Files:**
- Create: `apps/dashboard/src/hooks/use-user.ts`
- Create: `apps/dashboard/src/components/layout/top-bar.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create useUser hook**

Create `apps/dashboard/src/hooks/use-user.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { CurrentUser } from '@/providers/user-provider'

export function useUser() {
	return useQuery({
		queryKey: ['user', 'me'],
		queryFn: () => apiFetch<{ data: CurrentUser }>('/api/user/me').then((r) => r.data),
	})
}
```

- [ ] **Step 2: Create TopBar**

Create `apps/dashboard/src/components/layout/top-bar.tsx`:

```tsx
'use client'

import { CreditCard, LogOut, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/providers/user-provider'

export function TopBar({ planTier }: { planTier?: string }) {
	const user = useCurrentUser()

	return (
		<header className="sticky top-0 z-40 border-b border-glass-100 bg-surface/80 backdrop-blur-lg">
			<div className="flex h-14 items-center justify-between px-4">
				<div className="flex items-center gap-3">
					<Link href="/guilds" className="text-lg font-semibold">
						TicketBot
					</Link>
				</div>
				<div className="flex items-center gap-3">
					{planTier && (
						<Link href="/billing">
							<Badge variant={planTier === 'premium' ? 'default' : 'outline'}>
								{planTier === 'premium' ? 'Premium' : 'Free'}
							</Badge>
						</Link>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 rounded-full p-0">
								<Avatar className="h-8 w-8">
									<AvatarImage src={user.avatarUrl ?? undefined} />
									<AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<div className="px-2 py-1.5 text-sm font-medium">{user.displayName ?? user.username}</div>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href="/guilds">
									<RefreshCw className="mr-2 h-4 w-4" />
									Switch guild
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/billing">
									<CreditCard className="mr-2 h-4 w-4" />
									Billing
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<a href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/sign-out`}>
									<LogOut className="mr-2 h-4 w-4" />
									Sign out
								</a>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	)
}
```

- [ ] **Step 3: Create dashboard layout**

Create `apps/dashboard/src/app/(dashboard)/layout.tsx`:

```tsx
'use client'

import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/components/layout/top-bar'
import { useUser } from '@/hooks/use-user'
import { UserProvider } from '@/providers/user-provider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { data: user, isLoading, error } = useUser()

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Skeleton className="h-8 w-48" />
			</div>
		)
	}

	if (error || !user) {
		redirect('/login')
	}

	return (
		<UserProvider user={user}>
			<TopBar />
			<main className="p-6">{children}</main>
		</UserProvider>
	)
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-user.ts apps/dashboard/src/components/layout/top-bar.tsx apps/dashboard/src/app/\(dashboard\)/layout.tsx
git commit -m "feat(dashboard): add dashboard layout with top bar and user context"
```

---

### Task 7: Guild Selector Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-guilds.ts`
- Create: `apps/dashboard/src/app/(dashboard)/guilds/page.tsx`

- [ ] **Step 1: Create useGuilds hook**

Create `apps/dashboard/src/hooks/use-guilds.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, apiPost } from '@/lib/api'

interface Guild {
	id: number
	discordId: string
	name: string
	iconUrl: string | null
	planTier: string
}

interface GuildDetails {
	id: number
	discordId: string
	name: string
	iconUrl: string | null
	planTier: string
	settings: {
		logChannelId: string | null
		transcriptChannelId: string | null
		locale: string
		timezone: string
		autoCloseHours: number | null
		transcriptRetentionDays: number
		ticketCooldownSeconds: number
	} | null
}

export function useGuilds() {
	return useQuery({
		queryKey: ['guilds'],
		queryFn: () => apiFetch<{ data: Guild[] }>('/api/guilds').then((r) => r.data),
	})
}

export function useGuildDetails(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId],
		queryFn: () => apiFetch<{ data: GuildDetails }>(`/api/guilds/${guildId}`).then((r) => r.data),
		enabled: guildId > 0,
	})
}

export function useGuildPermissions(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'permissions'],
		queryFn: () =>
			apiFetch<{ data: { permissions: string[] } }>(`/api/guilds/${guildId}/permissions`).then(
				(r) => r.data.permissions,
			),
		enabled: guildId > 0,
	})
}

export function useRefreshGuilds() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => apiPost<{ success: boolean }>('/api/guilds/refresh', {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds'] })
			toast.success('Guilds refreshed from Discord')
		},
	})
}
```

- [ ] **Step 2: Create guild selector page**

Create `apps/dashboard/src/app/(dashboard)/guilds/page.tsx`:

```tsx
'use client'

import { RefreshCw, Server } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useGuilds, useRefreshGuilds } from '@/hooks/use-guilds'

export default function GuildsPage() {
	const { data: guilds, isLoading } = useGuilds()
	const refreshGuilds = useRefreshGuilds()

	return (
		<div className="max-w-4xl mx-auto">
			<PageHeader
				title="Your Servers"
				description="Select a server to manage"
				actions={
					<Button
						variant="outline"
						size="sm"
						onClick={() => refreshGuilds.mutate()}
						disabled={refreshGuilds.isPending}
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${refreshGuilds.isPending ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				}
			/>
			{isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))}
				</div>
			) : !guilds?.length ? (
				<EmptyState
					icon={Server}
					title="No servers found"
					description="Add TicketBot to a Discord server to get started."
				/>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{guilds.map((guild) => (
						<Link
							key={guild.id}
							href={`/${guild.id}/tickets`}
							className="glass-panel p-4 flex items-center gap-4 transition-all"
						>
							<Avatar className="h-12 w-12">
								<AvatarImage src={guild.iconUrl ?? undefined} />
								<AvatarFallback>{guild.name[0]?.toUpperCase()}</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<p className="font-medium truncate">{guild.name}</p>
								<Badge variant="outline" className="mt-1 text-xs">
									{guild.planTier === 'premium' ? 'Premium' : 'Free'}
								</Badge>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	)
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-guilds.ts apps/dashboard/src/app/\(dashboard\)/guilds/
git commit -m "feat(dashboard): add guild selector page with refresh"
```

---

### Task 8: Guild Layout + Sidebar

**Files:**
- Create: `apps/dashboard/src/components/layout/sidebar.tsx`
- Create: `apps/dashboard/src/components/layout/mobile-nav.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/layout.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/page.tsx`

- [ ] **Step 1: Create Sidebar**

Create `apps/dashboard/src/components/layout/sidebar.tsx`:

```tsx
'use client'

import {
	BookOpen,
	FileText,
	Key,
	LayoutGrid,
	Monitor,
	ScrollText,
	Settings,
	Shield,
	Ticket,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useGuild } from '@/providers/guild-provider'
import { useHasPermission } from '@/providers/permission-provider'

interface NavItem {
	label: string
	href: string
	icon: React.ElementType
	permission: string
}

interface NavGroup {
	label: string
	items: NavItem[]
}

const navGroups: NavGroup[] = [
	{
		label: 'Setup',
		items: [
			{ label: 'Settings', href: '/settings', icon: Settings, permission: 'admin.manage_settings' },
			{ label: 'Categories', href: '/categories', icon: LayoutGrid, permission: 'admin.manage_categories' },
			{ label: 'Panels', href: '/panels', icon: Monitor, permission: 'admin.manage_panels' },
		],
	},
	{
		label: 'Support',
		items: [
			{ label: 'Tickets', href: '/tickets', icon: Ticket, permission: 'tickets.view' },
			{ label: 'Transcripts', href: '/transcripts', icon: FileText, permission: 'transcripts.view' },
		],
	},
	{
		label: 'Admin',
		items: [
			{ label: 'Roles', href: '/roles', icon: Shield, permission: 'admin.manage_roles' },
			{ label: 'Audit Logs', href: '/audit-logs', icon: ScrollText, permission: 'admin.view_audit_logs' },
			{ label: 'API Keys', href: '/api-keys', icon: Key, permission: 'admin.manage_api_keys' },
		],
	},
]

export function Sidebar({ guildId }: { guildId: number }) {
	const guild = useGuild()
	const pathname = usePathname()

	return (
		<aside className="w-64 border-r border-glass-100 bg-surface h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
			<div className="p-4">
				<Link href="/guilds" className="flex items-center gap-3 mb-6">
					<Avatar className="h-10 w-10">
						<AvatarImage src={guild.iconUrl ?? undefined} />
						<AvatarFallback>{guild.name[0]?.toUpperCase()}</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<p className="font-medium text-sm truncate">{guild.name}</p>
						<p className="text-xs text-muted-foreground">Switch server</p>
					</div>
				</Link>

				<nav className="space-y-6">
					{navGroups.map((group) => (
						<SidebarGroup key={group.label} group={group} guildId={guildId} pathname={pathname} />
					))}
				</nav>
			</div>
		</aside>
	)
}

function SidebarGroup({
	group,
	guildId,
	pathname,
}: {
	group: NavGroup
	guildId: number
	pathname: string
}) {
	const visibleItems = group.items.filter((item) => useHasPermission(item.permission))

	if (visibleItems.length === 0) return null

	return (
		<div>
			<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
				{group.label}
			</p>
			<div className="space-y-1">
				{visibleItems.map((item) => {
					const href = `/${guildId}${item.href}`
					const isActive = pathname === href || pathname.startsWith(`${href}/`)
					return (
						<Link
							key={item.href}
							href={href}
							className={cn(
								'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
								isActive
									? 'bg-accent/20 text-accent-foreground'
									: 'text-muted-foreground hover:bg-glass-50 hover:text-foreground',
							)}
						>
							<item.icon className="h-4 w-4" />
							{item.label}
						</Link>
					)
				})}
			</div>
		</div>
	)
}
```

- [ ] **Step 2: Create MobileNav**

Create `apps/dashboard/src/components/layout/mobile-nav.tsx`:

```tsx
'use client'

import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'

export function MobileNav({ guildId }: { guildId: number }) {
	const [open, setOpen] = useState(false)

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="sm" className="lg:hidden">
					<Menu className="h-5 w-5" />
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="p-0 w-64">
				<Sidebar guildId={guildId} />
			</SheetContent>
		</Sheet>
	)
}
```

- [ ] **Step 3: Create guild layout**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/layout.tsx`:

```tsx
'use client'

import { useParams, redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { useGuildDetails, useGuildPermissions } from '@/hooks/use-guilds'
import { GuildProvider } from '@/providers/guild-provider'
import { PermissionProvider } from '@/providers/permission-provider'

export default function GuildLayout({ children }: { children: React.ReactNode }) {
	const params = useParams()
	const guildId = Number(params.guildId)

	const { data: guild, isLoading: guildLoading, error: guildError } = useGuildDetails(guildId)
	const { data: permissions, isLoading: permsLoading } = useGuildPermissions(guildId)

	if (guildLoading || permsLoading) {
		return (
			<div className="flex h-[calc(100vh-3.5rem)]">
				<div className="w-64 border-r border-glass-100 p-4 hidden lg:block">
					<Skeleton className="h-10 w-full mb-6" />
					<div className="space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-8 w-full" />
						))}
					</div>
				</div>
				<div className="flex-1 p-6">
					<Skeleton className="h-8 w-48 mb-4" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		)
	}

	if (guildError || !guild) {
		redirect('/guilds')
	}

	return (
		<GuildProvider guild={guild}>
			<PermissionProvider permissions={permissions ?? []}>
				<div className="flex h-[calc(100vh-3.5rem)]">
					<div className="hidden lg:block">
						<Sidebar guildId={guildId} />
					</div>
					<div className="flex-1 overflow-y-auto">
						<div className="lg:hidden border-b border-glass-100 px-4 py-2">
							<MobileNav guildId={guildId} />
						</div>
						<div className="p-6">{children}</div>
					</div>
				</div>
			</PermissionProvider>
		</GuildProvider>
	)
}
```

- [ ] **Step 4: Create guild index redirect**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function GuildIndexPage({ params }: { params: { guildId: string } }) {
	redirect(`/${params.guildId}/tickets`)
}
```

- [ ] **Step 5: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/components/layout/ apps/dashboard/src/app/\(dashboard\)/\[guildId\]/
git commit -m "feat(dashboard): add guild layout with sidebar and permission context"
```

---

### Task 9: Settings Page

**Files:**
- Create: `apps/dashboard/src/schemas/settings.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/settings/page.tsx`

- [ ] **Step 1: Create settings schema**

Create `apps/dashboard/src/schemas/settings.ts`:

```typescript
import { z } from 'zod'

export const settingsSchema = z.object({
	locale: z.string().min(1),
	timezone: z.string().min(1),
	logChannelId: z.string().nullable(),
	transcriptChannelId: z.string().nullable(),
	ticketCooldownSeconds: z.coerce.number().int().min(0).max(3600),
	autoCloseHours: z.coerce.number().int().min(1).nullable(),
	transcriptRetentionDays: z.coerce.number().int().min(1).max(365),
})

export type SettingsFormData = z.infer<typeof settingsSchema>
```

- [ ] **Step 2: Create settings page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/settings/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useGuild } from '@/providers/guild-provider'
import { apiPut } from '@/lib/api'
import { settingsSchema, type SettingsFormData } from '@/schemas/settings'

export default function SettingsPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const guild = useGuild()
	const queryClient = useQueryClient()

	const form = useForm<SettingsFormData>({
		resolver: zodResolver(settingsSchema),
		defaultValues: {
			locale: guild.settings?.locale ?? 'en',
			timezone: guild.settings?.timezone ?? 'UTC',
			logChannelId: guild.settings?.logChannelId ?? null,
			transcriptChannelId: guild.settings?.transcriptChannelId ?? null,
			ticketCooldownSeconds: guild.settings?.ticketCooldownSeconds ?? 60,
			autoCloseHours: guild.settings?.autoCloseHours ?? null,
			transcriptRetentionDays: guild.settings?.transcriptRetentionDays ?? 5,
		},
	})

	const updateSettings = useMutation({
		mutationFn: (data: SettingsFormData) =>
			apiPut(`/api/guilds/${guildId}/settings`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId] })
			toast.success('Settings saved')
		},
	})

	return (
		<RequirePermission permission="admin.manage_settings">
			<PageHeader title="Settings" description="Configure your server settings" />
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit((data) => updateSettings.mutate(data))}
					className="space-y-8 max-w-2xl"
				>
					<div className="glass-panel p-6 space-y-4">
						<h3 className="text-sm font-medium">General</h3>
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="locale"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Locale</FormLabel>
										<FormControl>
											<Input {...field} placeholder="en" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="timezone"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Timezone</FormLabel>
										<FormControl>
											<Input {...field} placeholder="UTC" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>

					<div className="glass-panel p-6 space-y-4">
						<h3 className="text-sm font-medium">Channels</h3>
						<FormField
							control={form.control}
							name="logChannelId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Log Channel ID</FormLabel>
									<FormControl>
										<Input {...field} value={field.value ?? ''} placeholder="Channel ID" />
									</FormControl>
									<FormDescription>Channel for ticket log messages</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="transcriptChannelId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Transcript Channel ID</FormLabel>
									<FormControl>
										<Input {...field} value={field.value ?? ''} placeholder="Channel ID" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="glass-panel p-6 space-y-4">
						<h3 className="text-sm font-medium">Tickets</h3>
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="ticketCooldownSeconds"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Cooldown (seconds)</FormLabel>
										<FormControl>
											<Input type="number" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="autoCloseHours"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Auto-close (hours)</FormLabel>
										<FormControl>
											<Input
												type="number"
												{...field}
												value={field.value ?? ''}
												onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="transcriptRetentionDays"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Transcript retention (days)</FormLabel>
									<FormControl>
										<Input type="number" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<Button type="submit" disabled={updateSettings.isPending || !form.formState.isDirty}>
						<Save className="h-4 w-4 mr-2" />
						{updateSettings.isPending ? 'Saving...' : 'Save settings'}
					</Button>
				</form>
			</Form>
		</RequirePermission>
	)
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/schemas/settings.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/settings/
git commit -m "feat(dashboard): add settings page with form validation"
```

---

### Task 10: Categories Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-categories.ts`
- Create: `apps/dashboard/src/schemas/category.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/categories/page.tsx`

- [ ] **Step 1: Create categories hook**

Create `apps/dashboard/src/hooks/use-categories.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiDelete, apiFetch, apiPost, apiPut } from '@/lib/api'

interface Category {
	id: number
	name: string
	description: string | null
	emoji: string | null
	channelMode: string
	targetChannelId: string | null
	maxOpenPerUser: number
	autoCloseHours: number | null
	position: number
	isEnabled: boolean
}

export function useCategories(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'categories'],
		queryFn: () =>
			apiFetch<{ data: Category[] }>(`/api/guilds/${guildId}/categories`).then((r) => r.data),
	})
}

export function useCreateCategory(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: { name: string; description?: string; emoji?: string; maxOpenPerUser?: number }) =>
			apiPost(`/api/guilds/${guildId}/categories`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'categories'] })
			toast.success('Category created')
		},
	})
}

export function useUpdateCategory(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ categoryId, ...data }: { categoryId: number } & Record<string, unknown>) =>
			apiPut(`/api/guilds/${guildId}/categories/${categoryId}`, data),
		async onMutate({ categoryId, ...data }) {
			await queryClient.cancelQueries({ queryKey: ['guilds', guildId, 'categories'] })
			const previous = queryClient.getQueryData<Category[]>(['guilds', guildId, 'categories'])
			if (previous) {
				queryClient.setQueryData(
					['guilds', guildId, 'categories'],
					previous.map((c) => (c.id === categoryId ? { ...c, ...data } : c)),
				)
			}
			return { previous }
		},
		onError(_err, _vars, context) {
			if (context?.previous) {
				queryClient.setQueryData(['guilds', guildId, 'categories'], context.previous)
			}
		},
		onSettled() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'categories'] })
		},
		onSuccess() {
			toast.success('Category updated')
		},
	})
}

export function useDeleteCategory(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (categoryId: number) =>
			apiDelete(`/api/guilds/${guildId}/categories/${categoryId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'categories'] })
			toast.success('Category deleted')
		},
	})
}
```

- [ ] **Step 2: Create category schema**

Create `apps/dashboard/src/schemas/category.ts`:

```typescript
import { z } from 'zod'

export const categorySchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	description: z.string().max(500).optional(),
	emoji: z.string().max(10).optional(),
	maxOpenPerUser: z.coerce.number().int().min(1).max(50).optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>
```

- [ ] **Step 3: Create categories page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/categories/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LayoutGrid, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type Column } from '@/components/data-table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/use-categories'
import { categorySchema, type CategoryFormData } from '@/schemas/category'

export default function CategoriesPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const { data: categories, isLoading } = useCategories(guildId)
	const createCategory = useCreateCategory(guildId)
	const updateCategory = useUpdateCategory(guildId)
	const deleteCategory = useDeleteCategory(guildId)

	const [sheetOpen, setSheetOpen] = useState(false)
	const [deleteId, setDeleteId] = useState<number | null>(null)

	const form = useForm<CategoryFormData>({
		resolver: zodResolver(categorySchema),
		defaultValues: { name: '', description: '', emoji: '' },
	})

	const columns: Column<(typeof categories extends (infer T)[] | undefined ? T : never)>[] = [
		{ key: 'emoji', header: '', cell: (row) => row.emoji ?? '—', className: 'w-10' },
		{ key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
		{ key: 'channelMode', header: 'Mode', cell: (row) => row.channelMode },
		{ key: 'maxOpenPerUser', header: 'Max Open', cell: (row) => row.maxOpenPerUser },
		{
			key: 'isEnabled',
			header: 'Enabled',
			cell: (row) => (
				<Switch
					checked={row.isEnabled}
					onCheckedChange={(checked) =>
						updateCategory.mutate({ categoryId: row.id, isEnabled: checked })
					}
				/>
			),
		},
		{
			key: 'actions',
			header: '',
			cell: (row) => (
				<Button
					variant="ghost"
					size="sm"
					onClick={(e) => {
						e.stopPropagation()
						setDeleteId(row.id)
					}}
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			),
			className: 'w-10',
		},
	]

	return (
		<RequirePermission permission="admin.manage_categories">
			<PageHeader
				title="Categories"
				description="Manage ticket categories"
				actions={
					<Button size="sm" onClick={() => setSheetOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Category
					</Button>
				}
			/>

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={categories ?? []}
					isLoading={isLoading}
					emptyState={
						<EmptyState
							icon={LayoutGrid}
							title="No categories"
							description="Create your first ticket category."
							action={
								<Button size="sm" onClick={() => setSheetOpen(true)}>
									<Plus className="h-4 w-4 mr-2" />
									New Category
								</Button>
							}
						/>
					}
				/>
			</div>

			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>New Category</SheetTitle>
					</SheetHeader>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit((data) => {
								createCategory.mutate(data, {
									onSuccess() {
										setSheetOpen(false)
										form.reset()
									},
								})
							})}
							className="space-y-4 mt-4"
						>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl><Input {...field} /></FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="emoji"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Emoji</FormLabel>
										<FormControl><Input {...field} placeholder="🎫" /></FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Description</FormLabel>
										<FormControl><Input {...field} /></FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="maxOpenPerUser"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Max open per user</FormLabel>
										<FormControl><Input type="number" {...field} /></FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" disabled={createCategory.isPending} className="w-full">
								{createCategory.isPending ? 'Creating...' : 'Create Category'}
							</Button>
						</form>
					</Form>
				</SheetContent>
			</Sheet>

			<ConfirmDialog
				open={deleteId !== null}
				onOpenChange={() => setDeleteId(null)}
				title="Delete category"
				description="This will permanently delete this category. This action cannot be undone."
				confirmLabel="Delete"
				destructive
				loading={deleteCategory.isPending}
				onConfirm={() => {
					if (deleteId) {
						deleteCategory.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
					}
				}}
			/>
		</RequirePermission>
	)
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-categories.ts apps/dashboard/src/schemas/category.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/categories/
git commit -m "feat(dashboard): add categories page with CRUD and sheet form"
```

---

### Task 11: Panels Page + Editor

**Files:**
- Create: `apps/dashboard/src/hooks/use-panels.ts`
- Create: `apps/dashboard/src/schemas/panel.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/panels/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/panels/[panelId]/page.tsx`

- [ ] **Step 1: Create panels hook**

Create `apps/dashboard/src/hooks/use-panels.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiDelete, apiFetch, apiPost, apiPut } from '@/lib/api'

interface Panel {
	id: number
	name: string
	channelId: string | null
	messageId: string | null
	embedTitle: string | null
	embedDescription: string | null
	embedColor: number | null
	embedThumbnailUrl: string | null
	embedFooterText: string | null
	isPublished: boolean
	createdAt: string
}

interface PanelWithButtons extends Panel {
	buttons: Array<{
		id: number
		categoryId: number
		label: string
		emoji: string | null
		style: string
		position: number
	}>
}

export function usePanels(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'panels'],
		queryFn: () => apiFetch<{ data: Panel[] }>(`/api/guilds/${guildId}/panels`).then((r) => r.data),
	})
}

export function usePanelDetail(guildId: number, panelId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'panels', panelId],
		queryFn: () =>
			apiFetch<{ data: PanelWithButtons }>(`/api/guilds/${guildId}/panels/${panelId}`).then((r) => r.data),
		enabled: panelId > 0,
	})
}

export function useCreatePanel(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: { name: string }) => apiPost<{ data: Panel }>(`/api/guilds/${guildId}/panels`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			toast.success('Panel created')
		},
	})
}

export function useUpdatePanel(guildId: number, panelId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: Record<string, unknown>) =>
			apiPut(`/api/guilds/${guildId}/panels/${panelId}`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels', panelId] })
			toast.success('Panel updated')
		},
	})
}

export function useDeletePanel(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (panelId: number) => apiDelete(`/api/guilds/${guildId}/panels/${panelId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			toast.success('Panel deleted')
		},
	})
}

export function useDeployPanel(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (panelId: number) =>
			apiPost(`/api/guilds/${guildId}/panels/${panelId}/deploy`, {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			toast.success('Panel deployed to Discord')
		},
	})
}
```

- [ ] **Step 2: Create panel schema**

Create `apps/dashboard/src/schemas/panel.ts`:

```typescript
import { z } from 'zod'

export const panelSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	embedTitle: z.string().max(256).optional().nullable(),
	embedDescription: z.string().max(4096).optional().nullable(),
	embedColor: z.coerce.number().int().min(0).max(16777215).optional().nullable(),
	embedThumbnailUrl: z.string().url().optional().nullable().or(z.literal('')),
	embedFooterText: z.string().max(2048).optional().nullable(),
	channelId: z.string().optional().nullable(),
})

export type PanelFormData = z.infer<typeof panelSchema>
```

- [ ] **Step 3: Create panels list page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/panels/page.tsx`:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Monitor, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataTable, type Column } from '@/components/data-table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { usePanels, useCreatePanel, useDeletePanel } from '@/hooks/use-panels'

export default function PanelsPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)
	const { data: panels, isLoading } = usePanels(guildId)
	const createPanel = useCreatePanel(guildId)
	const deletePanel = useDeletePanel(guildId)

	const [createOpen, setCreateOpen] = useState(false)
	const [newName, setNewName] = useState('')
	const [deleteId, setDeleteId] = useState<number | null>(null)

	const columns: Column<NonNullable<typeof panels>[number]>[] = [
		{ key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
		{ key: 'channelId', header: 'Channel', cell: (row) => row.channelId ?? '—' },
		{
			key: 'isPublished',
			header: 'Status',
			cell: (row) => (
				<Badge variant={row.isPublished ? 'default' : 'outline'}>
					{row.isPublished ? 'Published' : 'Draft'}
				</Badge>
			),
		},
		{
			key: 'actions',
			header: '',
			cell: (row) => (
				<Button
					variant="ghost"
					size="sm"
					onClick={(e) => {
						e.stopPropagation()
						setDeleteId(row.id)
					}}
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			),
			className: 'w-10',
		},
	]

	return (
		<RequirePermission permission="admin.manage_panels">
			<PageHeader
				title="Panels"
				description="Manage ticket panels"
				actions={
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Panel
					</Button>
				}
			/>

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={panels ?? []}
					isLoading={isLoading}
					onRowClick={(row) => router.push(`/${guildId}/panels/${row.id}`)}
					emptyState={
						<EmptyState
							icon={Monitor}
							title="No panels"
							description="Create a panel to let users open tickets in Discord."
						/>
					}
				/>
			</div>

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Panel</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault()
							createPanel.mutate(
								{ name: newName },
								{
									onSuccess(res) {
										setCreateOpen(false)
										setNewName('')
										router.push(`/${guildId}/panels/${res.data.id}`)
									},
								},
							)
						}}
						className="space-y-4"
					>
						<Input
							placeholder="Panel name"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							required
						/>
						<Button type="submit" disabled={createPanel.isPending} className="w-full">
							{createPanel.isPending ? 'Creating...' : 'Create'}
						</Button>
					</form>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={deleteId !== null}
				onOpenChange={() => setDeleteId(null)}
				title="Delete panel"
				description="This will permanently delete this panel."
				confirmLabel="Delete"
				destructive
				loading={deletePanel.isPending}
				onConfirm={() => {
					if (deleteId) deletePanel.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
				}}
			/>
		</RequirePermission>
	)
}
```

- [ ] **Step 4: Add button management hooks to use-panels.ts**

Append these to `apps/dashboard/src/hooks/use-panels.ts`:

```typescript
export function useAddPanelButton(guildId: number, panelId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: { categoryId: number; label: string; emoji?: string; style?: string }) =>
			apiPost(`/api/guilds/${guildId}/panels/${panelId}/buttons`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels', panelId] })
			toast.success('Button added')
		},
	})
}

export function useRemovePanelButton(guildId: number, panelId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (buttonId: number) =>
			apiDelete(`/api/guilds/${guildId}/panels/${panelId}/buttons/${buttonId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels', panelId] })
			toast.success('Button removed')
		},
	})
}
```

- [ ] **Step 5: Create panel editor page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/panels/[panelId]/page.tsx`:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, GripVertical, Plus, Rocket, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PageHeader } from '@/components/page-header'
import { usePanelDetail, useUpdatePanel, useDeployPanel, useAddPanelButton, useRemovePanelButton } from '@/hooks/use-panels'
import { useCategories } from '@/hooks/use-categories'
import { panelSchema, type PanelFormData } from '@/schemas/panel'

const BUTTON_STYLES = [
	{ label: 'Primary', value: 'primary' },
	{ label: 'Secondary', value: 'secondary' },
	{ label: 'Success', value: 'success' },
	{ label: 'Danger', value: 'danger' },
]

export default function PanelEditorPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)
	const panelId = Number(params.panelId)

	const { data: panel, isLoading } = usePanelDetail(guildId, panelId)
	const { data: categories } = useCategories(guildId)
	const updatePanel = useUpdatePanel(guildId, panelId)
	const deployPanel = useDeployPanel(guildId)
	const addButton = useAddPanelButton(guildId, panelId)
	const removeButton = useRemovePanelButton(guildId, panelId)

	const [addButtonOpen, setAddButtonOpen] = useState(false)
	const [newButton, setNewButton] = useState({ categoryId: '', label: '', emoji: '', style: 'primary' })

	const form = useForm<PanelFormData>({
		resolver: zodResolver(panelSchema),
		values: panel
			? {
					name: panel.name,
					embedTitle: panel.embedTitle,
					embedDescription: panel.embedDescription,
					embedColor: panel.embedColor,
					embedThumbnailUrl: panel.embedThumbnailUrl,
					embedFooterText: panel.embedFooterText,
					channelId: panel.channelId,
				}
			: undefined,
	})

	if (isLoading) {
		return <Skeleton className="h-96 w-full" />
	}

	return (
		<div>
			<div className="mb-4">
				<Button variant="ghost" size="sm" onClick={() => router.push(`/${guildId}/panels`)}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to panels
				</Button>
			</div>

			<PageHeader
				title={panel?.name ?? 'Panel'}
				actions={
					<Button
						size="sm"
						variant="outline"
						onClick={() => deployPanel.mutate(panelId)}
						disabled={deployPanel.isPending}
					>
						<Rocket className="h-4 w-4 mr-2" />
						{deployPanel.isPending ? 'Deploying...' : 'Deploy'}
					</Button>
				}
			/>

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit((data) => updatePanel.mutate(data))}
					className="grid grid-cols-1 lg:grid-cols-2 gap-6"
				>
					<div className="space-y-6">
						<div className="glass-panel p-6 space-y-4">
							<h3 className="text-sm font-medium">Panel Settings</h3>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl><Input {...field} /></FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="channelId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Channel ID</FormLabel>
										<FormControl>
											<Input {...field} value={field.value ?? ''} placeholder="Discord channel ID" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="glass-panel p-6 space-y-4">
							<h3 className="text-sm font-medium">Embed</h3>
							<FormField
								control={form.control}
								name="embedTitle"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Title</FormLabel>
										<FormControl>
											<Input {...field} value={field.value ?? ''} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="embedDescription"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Textarea {...field} value={field.value ?? ''} rows={4} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="embedColor"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Color</FormLabel>
										<FormControl>
											<Input
												type="color"
												value={field.value ? `#${field.value.toString(16).padStart(6, '0')}` : '#5865f2'}
												onChange={(e) => field.onChange(Number.parseInt(e.target.value.slice(1), 16))}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="embedFooterText"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Footer</FormLabel>
										<FormControl>
											<Input {...field} value={field.value ?? ''} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Button list */}
						<div className="glass-panel p-6 space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-medium">Buttons</h3>
								<Button type="button" variant="outline" size="sm" onClick={() => setAddButtonOpen(true)}>
									<Plus className="h-4 w-4 mr-1" />
									Add
								</Button>
							</div>
							{panel?.buttons.length === 0 ? (
								<p className="text-sm text-muted-foreground">No buttons yet. Add one to let users open tickets.</p>
							) : (
								<div className="space-y-2">
									{panel?.buttons
										.sort((a, b) => a.position - b.position)
										.map((btn) => (
											<div key={btn.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised">
												<GripVertical className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm">{btn.emoji ?? ''}</span>
												<span className="text-sm font-medium flex-1">{btn.label}</span>
												<span className="text-xs text-muted-foreground capitalize">{btn.style}</span>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => removeButton.mutate(btn.id)}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										))}
								</div>
							)}
						</div>

						<Button type="submit" disabled={updatePanel.isPending || !form.formState.isDirty}>
							<Save className="h-4 w-4 mr-2" />
							{updatePanel.isPending ? 'Saving...' : 'Save changes'}
						</Button>
					</div>

					<div className="glass-panel p-6">
						<h3 className="text-sm font-medium mb-4">Preview</h3>
						<div
							className="rounded-lg p-4 border-l-4"
							style={{ borderColor: form.watch('embedColor') ? `#${form.watch('embedColor')?.toString(16).padStart(6, '0')}` : '#5865f2' }}
						>
							{form.watch('embedTitle') && (
								<h4 className="font-semibold mb-1">{form.watch('embedTitle')}</h4>
							)}
							{form.watch('embedDescription') && (
								<p className="text-sm text-muted-foreground whitespace-pre-wrap">
									{form.watch('embedDescription')}
								</p>
							)}
							{form.watch('embedFooterText') && (
								<p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-glass-100">
									{form.watch('embedFooterText')}
								</p>
							)}
						</div>
						{panel?.buttons && panel.buttons.length > 0 && (
							<div className="flex flex-wrap gap-2 mt-4">
								{panel.buttons.sort((a, b) => a.position - b.position).map((btn) => (
									<div
										key={btn.id}
										className="px-4 py-2 rounded text-sm font-medium bg-accent/30 text-accent-foreground"
									>
										{btn.emoji ? `${btn.emoji} ` : ''}{btn.label}
									</div>
								))}
							</div>
						)}
					</div>
				</form>
			</Form>

			{/* Add button dialog */}
			<Dialog open={addButtonOpen} onOpenChange={setAddButtonOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Button</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault()
							addButton.mutate(
								{
									categoryId: Number(newButton.categoryId),
									label: newButton.label,
									emoji: newButton.emoji || undefined,
									style: newButton.style,
								},
								{
									onSuccess() {
										setAddButtonOpen(false)
										setNewButton({ categoryId: '', label: '', emoji: '', style: 'primary' })
									},
								},
							)
						}}
						className="space-y-4"
					>
						<div>
							<label className="text-sm font-medium">Category</label>
							<Select value={newButton.categoryId} onValueChange={(v) => setNewButton((s) => ({ ...s, categoryId: v }))}>
								<SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
								<SelectContent>
									{categories?.map((cat) => (
										<SelectItem key={cat.id} value={String(cat.id)}>
											{cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-sm font-medium">Label</label>
							<Input value={newButton.label} onChange={(e) => setNewButton((s) => ({ ...s, label: e.target.value }))} required />
						</div>
						<div>
							<label className="text-sm font-medium">Emoji</label>
							<Input value={newButton.emoji} onChange={(e) => setNewButton((s) => ({ ...s, emoji: e.target.value }))} placeholder="🎫 (optional)" />
						</div>
						<div>
							<label className="text-sm font-medium">Style</label>
							<Select value={newButton.style} onValueChange={(v) => setNewButton((s) => ({ ...s, style: v }))}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{BUTTON_STYLES.map((s) => (
										<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<Button type="submit" disabled={addButton.isPending || !newButton.categoryId || !newButton.label} className="w-full">
							{addButton.isPending ? 'Adding...' : 'Add Button'}
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	)
}
```

- [ ] **Step 5: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-panels.ts apps/dashboard/src/schemas/panel.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/panels/
git commit -m "feat(dashboard): add panels page with editor and embed preview"
```

---

### Task 12: Tickets List + Detail Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-tickets.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/tickets/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/tickets/[ticketId]/page.tsx`

- [ ] **Step 1: Create tickets hook**

Create `apps/dashboard/src/hooks/use-tickets.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, apiPut } from '@/lib/api'

interface Ticket {
	id: number
	ticketNumber: number
	subject: string
	status: string
	priority: string
	channelId: string | null
	creatorId: string | null
	assignedToId: string | null
	categoryId: number | null
	categoryName: string | null
	createdAt: string
	updatedAt: string
	closedAt: string | null
}

interface TicketDetail extends Ticket {
	messages: Array<{
		id: number
		content: string
		isStaff: boolean
		isInternalNote: boolean
		createdAt: string
		user: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null
	}>
}

interface PaginatedResponse<T> {
	data: T[]
	pagination: { cursor: string | null; hasMore: boolean; limit: number }
}

interface TicketFilters {
	status?: string
	priority?: string
	categoryId?: string
	assignedToId?: string
	cursor?: string
	limit?: number
}

export function useTickets(guildId: number, filters: TicketFilters = {}) {
	const params = new URLSearchParams()
	if (filters.status) params.set('status', filters.status)
	if (filters.priority) params.set('priority', filters.priority)
	if (filters.categoryId) params.set('categoryId', filters.categoryId)
	if (filters.assignedToId) params.set('assignedToId', filters.assignedToId)
	if (filters.cursor) params.set('cursor', filters.cursor)
	if (filters.limit) params.set('limit', String(filters.limit))
	const qs = params.toString()

	return useQuery({
		queryKey: ['guilds', guildId, 'tickets', filters],
		queryFn: () =>
			apiFetch<PaginatedResponse<Ticket>>(`/api/guilds/${guildId}/tickets${qs ? `?${qs}` : ''}`),
	})
}

export function useTicketDetail(guildId: number, ticketId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'tickets', ticketId],
		queryFn: () =>
			apiFetch<{ data: TicketDetail }>(`/api/guilds/${guildId}/tickets/${ticketId}`).then((r) => r.data),
		enabled: ticketId > 0,
	})
}

export function useUpdateTicketStatus(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ ticketId, status }: { ticketId: number; status: string }) =>
			apiPut(`/api/guilds/${guildId}/tickets/${ticketId}/status`, { status }),
		async onMutate({ ticketId, status }) {
			await queryClient.cancelQueries({ queryKey: ['guilds', guildId, 'tickets', ticketId] })
			const previous = queryClient.getQueryData<TicketDetail>(['guilds', guildId, 'tickets', ticketId])
			if (previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], { ...previous, status })
			}
			return { previous }
		},
		onError(_err, { ticketId }, context) {
			if (context?.previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], context.previous)
			}
		},
		onSettled() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'tickets'] })
		},
		onSuccess() {
			toast.success('Status updated')
		},
	})
}

export function useUpdateTicketPriority(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ ticketId, priority }: { ticketId: number; priority: string }) =>
			apiPut(`/api/guilds/${guildId}/tickets/${ticketId}/priority`, { priority }),
		async onMutate({ ticketId, priority }) {
			await queryClient.cancelQueries({ queryKey: ['guilds', guildId, 'tickets', ticketId] })
			const previous = queryClient.getQueryData<TicketDetail>(['guilds', guildId, 'tickets', ticketId])
			if (previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], { ...previous, priority })
			}
			return { previous }
		},
		onError(_err, { ticketId }, context) {
			if (context?.previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], context.previous)
			}
		},
		onSettled() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'tickets'] })
		},
		onSuccess() {
			toast.success('Priority updated')
		},
	})
}

export function useAssignTicket(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ ticketId, assignedToId }: { ticketId: number; assignedToId: string | null }) =>
			apiPut(`/api/guilds/${guildId}/tickets/${ticketId}/assign`, { assignedToId }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'tickets'] })
			toast.success('Ticket assigned')
		},
	})
}
```

- [ ] **Step 2: Create tickets list page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/tickets/page.tsx`:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Ticket } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import { CursorPagination } from '@/components/cursor-pagination'
import { EmptyState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PriorityBadge } from '@/components/priority-badge'
import { RequirePermission } from '@/components/require-permission'
import { StatusBadge } from '@/components/status-badge'
import { useTickets } from '@/hooks/use-tickets'
import type { TicketPriority, TicketStatus } from '@ticketbot/shared'

const statusOptions = [
	{ label: 'Open', value: 'open' },
	{ label: 'Pending', value: 'pending' },
	{ label: 'Waiting User', value: 'waiting_user' },
	{ label: 'Waiting Staff', value: 'waiting_staff' },
	{ label: 'Escalated', value: 'escalated' },
	{ label: 'Resolved', value: 'resolved' },
	{ label: 'Closed', value: 'closed' },
]

const priorityOptions = [
	{ label: 'Low', value: 'low' },
	{ label: 'Normal', value: 'normal' },
	{ label: 'High', value: 'high' },
	{ label: 'Urgent', value: 'urgent' },
]

export default function TicketsPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)

	const [filters, setFilters] = useState<Record<string, string | undefined>>({})
	const [cursorStack, setCursorStack] = useState<string[]>([])
	const [currentCursor, setCurrentCursor] = useState<string | undefined>()

	const { data, isLoading } = useTickets(guildId, {
		...filters,
		cursor: currentCursor,
	})

	const columns: Column<NonNullable<typeof data>['data'][number]>[] = [
		{
			key: 'ticketNumber',
			header: '#',
			cell: (row) => <span className="font-mono text-sm">#{row.ticketNumber}</span>,
			className: 'w-20',
		},
		{ key: 'subject', header: 'Subject', cell: (row) => <span className="font-medium">{row.subject}</span> },
		{ key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status as TicketStatus} /> },
		{ key: 'priority', header: 'Priority', cell: (row) => <PriorityBadge priority={row.priority as TicketPriority} /> },
		{ key: 'categoryName', header: 'Category', cell: (row) => row.categoryName ?? '—' },
		{
			key: 'createdAt',
			header: 'Created',
			cell: (row) => new Date(row.createdAt).toLocaleDateString(),
		},
	]

	return (
		<RequirePermission permission="tickets.view">
			<PageHeader title="Tickets" description="View and manage support tickets" />

			<FilterBar
				filters={[
					{ key: 'status', label: 'Status', options: statusOptions },
					{ key: 'priority', label: 'Priority', options: priorityOptions },
				]}
				values={filters}
				onChange={(key, value) => {
					setFilters((prev) => ({ ...prev, [key]: value }))
					setCursorStack([])
					setCurrentCursor(undefined)
				}}
			/>

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={data?.data ?? []}
					isLoading={isLoading}
					onRowClick={(row) => router.push(`/${guildId}/tickets/${row.id}`)}
					emptyState={
						<EmptyState icon={Ticket} title="No tickets" description="No tickets match your filters." />
					}
				/>
			</div>

			{data && (
				<CursorPagination
					hasMore={data.pagination.hasMore}
					hasPrev={cursorStack.length > 0}
					onNext={() => {
						if (data.pagination.cursor) {
							setCursorStack((prev) => [...prev, currentCursor ?? ''])
							setCurrentCursor(data.pagination.cursor)
						}
					}}
					onPrev={() => {
						const prev = cursorStack[cursorStack.length - 1]
						setCursorStack((s) => s.slice(0, -1))
						setCurrentCursor(prev || undefined)
					}}
				/>
			)}
		</RequirePermission>
	)
}
```

- [ ] **Step 3: Create ticket detail page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/tickets/[ticketId]/page.tsx`:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { PriorityBadge } from '@/components/priority-badge'
import { RequirePermission } from '@/components/require-permission'
import { StatusBadge } from '@/components/status-badge'
import { useTicketDetail, useUpdateTicketStatus, useUpdateTicketPriority } from '@/hooks/use-tickets'
import { useHasPermission } from '@/providers/permission-provider'
import type { TicketPriority, TicketStatus } from '@ticketbot/shared'
import { cn } from '@/lib/utils'

const STATUSES: TicketStatus[] = ['open', 'pending', 'waiting_user', 'waiting_staff', 'escalated', 'resolved']
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent']

export default function TicketDetailPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)
	const ticketId = Number(params.ticketId)
	const canManage = useHasPermission('tickets.manage')

	const { data: ticket, isLoading } = useTicketDetail(guildId, ticketId)
	const updateStatus = useUpdateTicketStatus(guildId)
	const updatePriority = useUpdateTicketPriority(guildId)

	if (isLoading) return <Skeleton className="h-96 w-full" />
	if (!ticket) return null

	return (
		<RequirePermission permission="tickets.view">
			<div className="mb-4">
				<Button variant="ghost" size="sm" onClick={() => router.push(`/${guildId}/tickets`)}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to tickets
				</Button>
			</div>

			<PageHeader title={`#${ticket.ticketNumber} — ${ticket.subject}`} />

			<div className="flex items-center gap-3 mb-6">
				<StatusBadge status={ticket.status as TicketStatus} />
				<PriorityBadge priority={ticket.priority as TicketPriority} />
				{ticket.categoryName && <Badge variant="outline">{ticket.categoryName}</Badge>}
			</div>

			{canManage && (
				<div className="flex gap-3 mb-6">
					<Select
						value={ticket.status}
						onValueChange={(status) => updateStatus.mutate({ ticketId, status })}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							{STATUSES.map((s) => (
								<SelectItem key={s} value={s}>
									{s.replace('_', ' ')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={ticket.priority}
						onValueChange={(priority) => updatePriority.mutate({ ticketId, priority })}
					>
						<SelectTrigger className="w-[140px]">
							<SelectValue placeholder="Priority" />
						</SelectTrigger>
						<SelectContent>
							{PRIORITIES.map((p) => (
								<SelectItem key={p} value={p}>
									{p}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="space-y-4">
				{ticket.messages.map((msg) => (
					<div
						key={msg.id}
						className={cn(
							'glass-panel p-4',
							msg.isInternalNote && 'border-yellow-500/30 bg-yellow-500/5',
						)}
					>
						<div className="flex items-center gap-3 mb-2">
							<Avatar className="h-8 w-8">
								<AvatarImage src={msg.user?.avatarUrl ?? undefined} />
								<AvatarFallback>
									{msg.user?.username?.[0]?.toUpperCase() ?? '?'}
								</AvatarFallback>
							</Avatar>
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium">
									{msg.user?.displayName ?? msg.user?.username ?? 'Unknown'}
								</span>
								{msg.isStaff && (
									<Badge variant="outline" className="text-xs">
										Staff
									</Badge>
								)}
								{msg.isInternalNote && (
									<Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
										Internal
									</Badge>
								)}
								<span className="text-xs text-muted-foreground">
									{new Date(msg.createdAt).toLocaleString()}
								</span>
							</div>
						</div>
						<p className="text-sm whitespace-pre-wrap pl-11">{msg.content}</p>
					</div>
				))}
			</div>
		</RequirePermission>
	)
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-tickets.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/tickets/
git commit -m "feat(dashboard): add tickets list with filters/pagination and detail page"
```

---

### Task 13: Transcripts Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-transcripts.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/transcripts/page.tsx`

- [ ] **Step 1: Create transcripts hook**

Create `apps/dashboard/src/hooks/use-transcripts.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface Transcript {
	id: number
	ticketId: number
	ticketNumber: number
	messageCount: number
	participants: unknown
	metadata: unknown
	expiresAt: string | null
	createdAt: string
}

interface PaginatedResponse<T> {
	data: T[]
	pagination: { cursor: string | null; hasMore: boolean; limit: number }
}

export function useTranscripts(guildId: number, cursor?: string) {
	const params = new URLSearchParams()
	if (cursor) params.set('cursor', cursor)
	const qs = params.toString()

	return useQuery({
		queryKey: ['guilds', guildId, 'transcripts', { cursor }],
		queryFn: () =>
			apiFetch<PaginatedResponse<Transcript>>(
				`/api/guilds/${guildId}/transcripts${qs ? `?${qs}` : ''}`,
			),
	})
}

export function useExportTranscript(guildId: number, transcriptId: number, format: 'json' | 'html') {
	return {
		download() {
			window.open(`/api/guilds/${guildId}/transcripts/${transcriptId}/export?format=${format}`, '_blank')
		},
	}
}
```

- [ ] **Step 2: Create transcripts page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/transcripts/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/data-table'
import { CursorPagination } from '@/components/cursor-pagination'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useTranscripts } from '@/hooks/use-transcripts'
import { useHasPermission } from '@/providers/permission-provider'

export default function TranscriptsPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const canExport = useHasPermission('transcripts.export')

	const [cursorStack, setCursorStack] = useState<string[]>([])
	const [currentCursor, setCurrentCursor] = useState<string | undefined>()

	const { data, isLoading } = useTranscripts(guildId, currentCursor)

	const columns: Column<NonNullable<typeof data>['data'][number]>[] = [
		{
			key: 'ticketNumber',
			header: 'Ticket',
			cell: (row) => <span className="font-mono">#{row.ticketNumber}</span>,
		},
		{ key: 'messageCount', header: 'Messages', cell: (row) => row.messageCount },
		{
			key: 'createdAt',
			header: 'Created',
			cell: (row) => new Date(row.createdAt).toLocaleDateString(),
		},
		{
			key: 'actions',
			header: '',
			cell: (row) =>
				canExport ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm">
								<Download className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem
								onClick={() =>
									window.open(`/api/guilds/${guildId}/transcripts/${row.id}/export?format=html`, '_blank')
								}
							>
								Export HTML
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									window.open(`/api/guilds/${guildId}/transcripts/${row.id}/export?format=json`, '_blank')
								}
							>
								Export JSON
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null,
			className: 'w-10',
		},
	]

	return (
		<RequirePermission permission="transcripts.view">
			<PageHeader title="Transcripts" description="Browse closed ticket transcripts" />

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={data?.data ?? []}
					isLoading={isLoading}
					emptyState={
						<EmptyState icon={FileText} title="No transcripts" description="Transcripts appear when tickets are closed." />
					}
				/>
			</div>

			{data && (
				<CursorPagination
					hasMore={data.pagination.hasMore}
					hasPrev={cursorStack.length > 0}
					onNext={() => {
						if (data.pagination.cursor) {
							setCursorStack((prev) => [...prev, currentCursor ?? ''])
							setCurrentCursor(data.pagination.cursor)
						}
					}}
					onPrev={() => {
						const prev = cursorStack[cursorStack.length - 1]
						setCursorStack((s) => s.slice(0, -1))
						setCurrentCursor(prev || undefined)
					}}
				/>
			)}
		</RequirePermission>
	)
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-transcripts.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/transcripts/
git commit -m "feat(dashboard): add transcripts page with export and pagination"
```

---

### Task 14: Roles Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-roles.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/roles/page.tsx`

- [ ] **Step 1: Create roles hook**

Create `apps/dashboard/src/hooks/use-roles.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, apiPost, apiPut } from '@/lib/api'

interface RolePermission {
	id: number
	key: string
	description: string | null
	category: string
}

interface Role {
	id: number
	discordRoleId: string
	name: string
	color: number | null
	position: number | null
	permissions: RolePermission[]
}

export function useRoles(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'roles'],
		queryFn: () => apiFetch<{ data: Role[] }>(`/api/guilds/${guildId}/roles`).then((r) => r.data),
	})
}

export function useUpdateRolePermissions(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ roleId, permissions }: { roleId: number; permissions: string[] }) =>
			apiPut(`/api/guilds/${guildId}/roles/${roleId}/permissions`, { permissions }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'roles'] })
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'permissions'] })
			toast.success('Permissions updated')
		},
	})
}

export function useRefreshRoles(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => apiPost(`/api/guilds/${guildId}/roles/refresh`, {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'roles'] })
			toast.success('Roles refreshed from Discord')
		},
	})
}
```

- [ ] **Step 2: Create roles page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/roles/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useRoles, useUpdateRolePermissions, useRefreshRoles } from '@/hooks/use-roles'

const ALL_PERMISSIONS = [
	{ key: 'tickets.view', label: 'View tickets', category: 'tickets' },
	{ key: 'tickets.manage', label: 'Manage tickets', category: 'tickets' },
	{ key: 'transcripts.view', label: 'View transcripts', category: 'transcripts' },
	{ key: 'transcripts.export', label: 'Export transcripts', category: 'transcripts' },
	{ key: 'admin.manage_settings', label: 'Manage settings', category: 'admin' },
	{ key: 'admin.manage_categories', label: 'Manage categories', category: 'admin' },
	{ key: 'admin.manage_panels', label: 'Manage panels', category: 'admin' },
	{ key: 'admin.manage_roles', label: 'Manage roles', category: 'admin' },
	{ key: 'admin.view_audit_logs', label: 'View audit logs', category: 'admin' },
	{ key: 'admin.manage_api_keys', label: 'Manage API keys', category: 'admin' },
]

const CATEGORIES = ['tickets', 'transcripts', 'admin']

export default function RolesPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const { data: roles, isLoading } = useRoles(guildId)
	const updatePermissions = useUpdateRolePermissions(guildId)
	const refreshRoles = useRefreshRoles(guildId)

	const [expandedRole, setExpandedRole] = useState<number | null>(null)

	if (isLoading) return <Skeleton className="h-96 w-full" />

	return (
		<RequirePermission permission="admin.manage_roles">
			<PageHeader
				title="Roles"
				description="Manage role permissions"
				actions={
					<Button
						variant="outline"
						size="sm"
						onClick={() => refreshRoles.mutate()}
						disabled={refreshRoles.isPending}
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${refreshRoles.isPending ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				}
			/>

			{!roles?.length ? (
				<EmptyState icon={Shield} title="No roles" description="Refresh roles from Discord to get started." />
			) : (
				<div className="space-y-2">
					{roles.map((role) => {
						const isExpanded = expandedRole === role.id
						const rolePermKeys = role.permissions.map((p) => p.key)

						return (
							<div key={role.id} className="glass-panel">
								<button
									type="button"
									className="w-full flex items-center justify-between p-4"
									onClick={() => setExpandedRole(isExpanded ? null : role.id)}
								>
									<div className="flex items-center gap-3">
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }}
										/>
										<span className="font-medium">{role.name}</span>
									</div>
									<span className="text-sm text-muted-foreground">
										{role.permissions.length} permissions
									</span>
								</button>
								{isExpanded && (
									<div className="px-4 pb-4 border-t border-glass-100 pt-4">
										{CATEGORIES.map((cat) => (
											<div key={cat} className="mb-4">
												<p className="text-xs font-medium text-muted-foreground uppercase mb-2">
													{cat}
												</p>
												<div className="space-y-2">
													{ALL_PERMISSIONS.filter((p) => p.category === cat).map((perm) => (
														<label key={perm.key} className="flex items-center gap-2 cursor-pointer">
															<Checkbox
																checked={rolePermKeys.includes(perm.key)}
																onCheckedChange={(checked) => {
																	const newPerms = checked
																		? [...rolePermKeys, perm.key]
																		: rolePermKeys.filter((k) => k !== perm.key)
																	updatePermissions.mutate({
																		roleId: role.id,
																		permissions: newPerms,
																	})
																}}
															/>
															<span className="text-sm">{perm.label}</span>
														</label>
													))}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}
		</RequirePermission>
	)
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-roles.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/roles/
git commit -m "feat(dashboard): add roles page with permission checkbox grid"
```

---

### Task 15: Audit Logs Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-audit-logs.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/audit-logs/page.tsx`

- [ ] **Step 1: Create audit logs hook**

Create `apps/dashboard/src/hooks/use-audit-logs.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface AuditLog {
	id: number
	guildId: number
	ticketId: number | null
	actorId: string | null
	actorDiscordId: string
	actorType: string
	action: string
	metadata: Record<string, unknown>
	createdAt: string
	actorUsername: string | null
	actorDisplayName: string | null
}

interface PaginatedResponse<T> {
	data: T[]
	pagination: { cursor: string | null; hasMore: boolean; limit: number }
}

interface AuditLogFilters {
	action?: string
	actorId?: string
	cursor?: string
}

export function useAuditLogs(guildId: number, filters: AuditLogFilters = {}) {
	const params = new URLSearchParams()
	if (filters.action) params.set('action', filters.action)
	if (filters.actorId) params.set('actorId', filters.actorId)
	if (filters.cursor) params.set('cursor', filters.cursor)
	const qs = params.toString()

	return useQuery({
		queryKey: ['guilds', guildId, 'audit-logs', filters],
		queryFn: () =>
			apiFetch<PaginatedResponse<AuditLog>>(
				`/api/guilds/${guildId}/audit-logs${qs ? `?${qs}` : ''}`,
			),
	})
}
```

- [ ] **Step 2: Create audit logs page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/audit-logs/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/data-table'
import { CursorPagination } from '@/components/cursor-pagination'
import { EmptyState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useAuditLogs } from '@/hooks/use-audit-logs'

const actionOptions = [
	{ label: 'Ticket Created', value: 'ticket.created' },
	{ label: 'Ticket Closed', value: 'ticket.closed' },
	{ label: 'Status Changed', value: 'ticket.status_changed' },
	{ label: 'Settings Updated', value: 'settings.updated' },
	{ label: 'Category Created', value: 'category.created' },
	{ label: 'Panel Deployed', value: 'panel.deployed' },
	{ label: 'API Key Created', value: 'api_key.created' },
	{ label: 'API Key Revoked', value: 'api_key.revoked' },
]

export default function AuditLogsPage() {
	const params = useParams()
	const guildId = Number(params.guildId)

	const [filters, setFilters] = useState<Record<string, string | undefined>>({})
	const [cursorStack, setCursorStack] = useState<string[]>([])
	const [currentCursor, setCurrentCursor] = useState<string | undefined>()

	const { data, isLoading } = useAuditLogs(guildId, { ...filters, cursor: currentCursor })

	const columns: Column<NonNullable<typeof data>['data'][number]>[] = [
		{
			key: 'createdAt',
			header: 'Time',
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{new Date(row.createdAt).toLocaleString()}
				</span>
			),
			className: 'w-44',
		},
		{
			key: 'actor',
			header: 'Actor',
			cell: (row) => (
				<span className="text-sm">
					{row.actorDisplayName ?? row.actorUsername ?? row.actorDiscordId}
				</span>
			),
		},
		{
			key: 'action',
			header: 'Action',
			cell: (row) => (
				<Badge variant="outline" className="font-mono text-xs">
					{row.action}
				</Badge>
			),
		},
		{
			key: 'metadata',
			header: 'Details',
			cell: (row) => (
				<span className="text-xs text-muted-foreground truncate max-w-xs block">
					{JSON.stringify(row.metadata)}
				</span>
			),
		},
	]

	return (
		<RequirePermission permission="admin.view_audit_logs">
			<PageHeader title="Audit Logs" description="Track all actions in this server" />

			<FilterBar
				filters={[{ key: 'action', label: 'Action', options: actionOptions }]}
				values={filters}
				onChange={(key, value) => {
					setFilters((prev) => ({ ...prev, [key]: value }))
					setCursorStack([])
					setCurrentCursor(undefined)
				}}
			/>

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={data?.data ?? []}
					isLoading={isLoading}
					emptyState={
						<EmptyState icon={ScrollText} title="No audit logs" description="Actions will appear here as they happen." />
					}
				/>
			</div>

			{data && (
				<CursorPagination
					hasMore={data.pagination.hasMore}
					hasPrev={cursorStack.length > 0}
					onNext={() => {
						if (data.pagination.cursor) {
							setCursorStack((prev) => [...prev, currentCursor ?? ''])
							setCurrentCursor(data.pagination.cursor)
						}
					}}
					onPrev={() => {
						const prev = cursorStack[cursorStack.length - 1]
						setCursorStack((s) => s.slice(0, -1))
						setCurrentCursor(prev || undefined)
					}}
				/>
			)}
		</RequirePermission>
	)
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-audit-logs.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/audit-logs/
git commit -m "feat(dashboard): add audit logs page with action filter and pagination"
```

---

### Task 16: API Keys Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-api-keys.ts`
- Create: `apps/dashboard/src/schemas/api-key.ts`
- Create: `apps/dashboard/src/app/(dashboard)/[guildId]/api-keys/page.tsx`

- [ ] **Step 1: Create API keys hook**

Create `apps/dashboard/src/hooks/use-api-keys.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiDelete, apiFetch, apiPost } from '@/lib/api'

interface ApiKey {
	id: number
	name: string
	keyPrefix: string
	permissions: string[]
	rateLimitPerMinute: number | null
	lastUsedAt: string | null
	expiresAt: string | null
	createdAt: string
}

interface CreateApiKeyResult {
	id: number
	name: string
	key: string
	keyPrefix: string
	permissions: string[]
}

export function useApiKeys(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'api-keys'],
		queryFn: () => apiFetch<{ data: ApiKey[] }>(`/api/guilds/${guildId}/api-keys`).then((r) => r.data),
	})
}

export function useCreateApiKey(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: { name: string; permissions: string[]; expiresInDays?: 30 | 90 | 365 }) =>
			apiPost<{ data: CreateApiKeyResult }>(`/api/guilds/${guildId}/api-keys`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'api-keys'] })
			toast.success('API key created')
		},
	})
}

export function useRotateApiKey(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (keyId: number) =>
			apiPost<{ data: { key: string } }>(`/api/guilds/${guildId}/api-keys/${keyId}/rotate`, {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'api-keys'] })
			toast.success('API key rotated')
		},
	})
}

export function useRevokeApiKey(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (keyId: number) => apiDelete(`/api/guilds/${guildId}/api-keys/${keyId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'api-keys'] })
			toast.success('API key revoked')
		},
	})
}
```

- [ ] **Step 2: Create API key schema**

Create `apps/dashboard/src/schemas/api-key.ts`:

```typescript
import { z } from 'zod'

export const apiKeySchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	permissions: z.array(z.string()).min(1, 'Select at least one permission'),
	expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).optional(),
})

export type ApiKeyFormData = z.infer<typeof apiKeySchema>
```

- [ ] **Step 3: Create API keys page**

Create `apps/dashboard/src/app/(dashboard)/[guildId]/api-keys/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Key, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DataTable, type Column } from '@/components/data-table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useRotateApiKey } from '@/hooks/use-api-keys'
import { apiKeySchema, type ApiKeyFormData } from '@/schemas/api-key'
import { API_KEY_PERMISSIONS } from '@ticketbot/shared'

export default function ApiKeysPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const { data: keys, isLoading } = useApiKeys(guildId)
	const createKey = useCreateApiKey(guildId)
	const revokeKey = useRevokeApiKey(guildId)
	const rotateKey = useRotateApiKey(guildId)

	const [createOpen, setCreateOpen] = useState(false)
	const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
	const [revokeId, setRevokeId] = useState<number | null>(null)
	const [rotateId, setRotateId] = useState<number | null>(null)

	const form = useForm<ApiKeyFormData>({
		resolver: zodResolver(apiKeySchema),
		defaultValues: { name: '', permissions: [] },
	})

	const columns: Column<NonNullable<typeof keys>[number]>[] = [
		{ key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
		{
			key: 'keyPrefix',
			header: 'Key',
			cell: (row) => <code className="text-xs">{row.keyPrefix}...</code>,
		},
		{
			key: 'permissions',
			header: 'Permissions',
			cell: (row) => <span className="text-sm">{row.permissions.length}</span>,
		},
		{
			key: 'lastUsedAt',
			header: 'Last Used',
			cell: (row) =>
				row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleDateString() : 'Never',
		},
		{
			key: 'expiresAt',
			header: 'Expires',
			cell: (row) =>
				row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : 'Never',
		},
		{
			key: 'actions',
			header: '',
			cell: (row) => (
				<div className="flex gap-1">
					<Button variant="ghost" size="sm" onClick={() => setRotateId(row.id)}>
						<RotateCw className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="sm" onClick={() => setRevokeId(row.id)}>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</div>
			),
			className: 'w-24',
		},
	]

	return (
		<RequirePermission permission="admin.manage_api_keys">
			<PageHeader
				title="API Keys"
				description="Manage API keys for external integrations"
				actions={
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Key
					</Button>
				}
			/>

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={keys ?? []}
					isLoading={isLoading}
					emptyState={
						<EmptyState icon={Key} title="No API keys" description="Create an API key for external access." />
					}
				/>
			</div>

			{/* Create dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create API Key</DialogTitle>
					</DialogHeader>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit((data) => {
								createKey.mutate(data, {
									onSuccess(res) {
										setNewKeyValue(res.data.key)
										setCreateOpen(false)
										form.reset()
									},
								})
							})}
							className="space-y-4"
						>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl><Input {...field} placeholder="My integration" /></FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="permissions"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Permissions</FormLabel>
										<div className="space-y-2">
											{API_KEY_PERMISSIONS.map((perm) => (
												<label key={perm} className="flex items-center gap-2 cursor-pointer">
													<Checkbox
														checked={field.value.includes(perm)}
														onCheckedChange={(checked) => {
															const newPerms = checked
																? [...field.value, perm]
																: field.value.filter((p) => p !== perm)
															field.onChange(newPerms)
														}}
													/>
													<span className="text-sm font-mono">{perm}</span>
												</label>
											))}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="expiresInDays"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Expiry</FormLabel>
										<Select
											value={field.value ? String(field.value) : 'never'}
											onValueChange={(v) => field.onChange(v === 'never' ? undefined : Number(v))}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="never">Never</SelectItem>
												<SelectItem value="30">30 days</SelectItem>
												<SelectItem value="90">90 days</SelectItem>
												<SelectItem value="365">1 year</SelectItem>
											</SelectContent>
										</Select>
									</FormItem>
								)}
							/>
							<Button type="submit" disabled={createKey.isPending} className="w-full">
								{createKey.isPending ? 'Creating...' : 'Create Key'}
							</Button>
						</form>
					</Form>
				</DialogContent>
			</Dialog>

			{/* Key reveal dialog */}
			<Dialog open={newKeyValue !== null} onOpenChange={() => setNewKeyValue(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>API Key Created</DialogTitle>
						<DialogDescription>
							Copy this key now. It won&apos;t be shown again.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2 p-3 bg-surface-raised rounded-lg">
						<code className="text-sm flex-1 break-all">{newKeyValue}</code>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								navigator.clipboard.writeText(newKeyValue ?? '')
								toast.success('Copied to clipboard')
							}}
						>
							<Copy className="h-4 w-4" />
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Revoke confirm */}
			<ConfirmDialog
				open={revokeId !== null}
				onOpenChange={() => setRevokeId(null)}
				title="Revoke API key"
				description="This will permanently delete this key. Any integrations using it will stop working immediately."
				confirmLabel="Revoke"
				destructive
				loading={revokeKey.isPending}
				onConfirm={() => {
					if (revokeId) revokeKey.mutate(revokeId, { onSuccess: () => setRevokeId(null) })
				}}
			/>

			{/* Rotate confirm */}
			<ConfirmDialog
				open={rotateId !== null}
				onOpenChange={() => setRotateId(null)}
				title="Rotate API key"
				description="This will generate a new key. The old key will stop working immediately."
				confirmLabel="Rotate"
				loading={rotateKey.isPending}
				onConfirm={() => {
					if (rotateId) {
						rotateKey.mutate(rotateId, {
							onSuccess(res) {
								setRotateId(null)
								setNewKeyValue(res.data.key)
							},
						})
					}
				}}
			/>
		</RequirePermission>
	)
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-api-keys.ts apps/dashboard/src/schemas/api-key.ts apps/dashboard/src/app/\(dashboard\)/\[guildId\]/api-keys/
git commit -m "feat(dashboard): add API keys page with create, rotate, revoke"
```

---

### Task 17: Billing Page

**Files:**
- Create: `apps/dashboard/src/hooks/use-billing.ts`
- Create: `apps/dashboard/src/app/(dashboard)/billing/page.tsx`

- [ ] **Step 1: Create billing hook**

Create `apps/dashboard/src/hooks/use-billing.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, apiPost } from '@/lib/api'

interface BillingAssignment {
	id: number
	guildId: number
	guildName: string
	guildIconUrl: string | null
	assignedAt: string
}

interface BillingInfo {
	subscriptionStatus: string
	polarCustomerId: string | null
	quota: {
		total: number
		used: number
		available: number
	}
	assignments: BillingAssignment[]
}

export function useBilling() {
	return useQuery({
		queryKey: ['billing'],
		queryFn: () => apiFetch<{ data: BillingInfo }>('/api/billing').then((r) => r.data),
	})
}

export function useAssignPremium() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (guildId: number) => apiPost('/api/billing/assign', { guildId }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['billing'] })
			queryClient.invalidateQueries({ queryKey: ['guilds'] })
			toast.success('Premium assigned to server')
		},
	})
}

export function useUnassignPremium() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (guildId: number) => apiPost('/api/billing/unassign', { guildId }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['billing'] })
			queryClient.invalidateQueries({ queryKey: ['guilds'] })
			toast.success('Premium removed from server')
		},
	})
}
```

- [ ] **Step 2: Create billing page**

Create `apps/dashboard/src/app/(dashboard)/billing/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { CreditCard, ExternalLink, Minus, Plus, Server } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useBilling, useAssignPremium, useUnassignPremium } from '@/hooks/use-billing'
import { useGuilds } from '@/hooks/use-guilds'
import { PREMIUM_PRICE } from '@ticketbot/shared'

export default function BillingPage() {
	const { data: billing, isLoading } = useBilling()
	const { data: guilds } = useGuilds()
	const assignPremium = useAssignPremium()
	const unassignPremium = useUnassignPremium()

	const [addOpen, setAddOpen] = useState(false)
	const [removeGuildId, setRemoveGuildId] = useState<number | null>(null)

	if (isLoading) return <Skeleton className="h-96 w-full max-w-2xl mx-auto" />

	const isSubscribed = billing?.subscriptionStatus === 'active'
	const isPastDue = billing?.subscriptionStatus === 'past_due'
	const isCanceled = billing?.subscriptionStatus === 'canceled'

	const assignedGuildIds = new Set(billing?.assignments.map((a) => a.guildId) ?? [])
	const eligibleGuilds = guilds?.filter((g) => g.planTier === 'free' && !assignedGuildIds.has(g.id)) ?? []

	return (
		<div className="max-w-2xl mx-auto">
			<PageHeader title="Billing" description="Manage your premium subscription" />

			{(isPastDue || isCanceled) && (
				<div className="glass-panel p-4 mb-6 border-yellow-500/30 bg-yellow-500/5">
					<p className="text-sm text-yellow-400">
						{isPastDue
							? 'Your payment is past due. Please update your payment method.'
							: 'Your subscription has been canceled.'}
					</p>
				</div>
			)}

			{/* Subscription status */}
			<div className="glass-panel p-6 mb-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-medium">Subscription</h3>
						<Badge variant={isSubscribed ? 'default' : 'outline'} className="mt-1">
							{isSubscribed ? 'Active' : billing?.subscriptionStatus ?? 'None'}
						</Badge>
					</div>
					{isSubscribed || isPastDue || isCanceled ? (
						<a
							href={`https://polar.sh/settings/subscriptions`}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Button variant="outline" size="sm">
								Manage subscription
								<ExternalLink className="h-3 w-3 ml-2" />
							</Button>
						</a>
					) : (
						<a href="https://polar.sh" target="_blank" rel="noopener noreferrer">
							<Button size="sm">
								<CreditCard className="h-4 w-4 mr-2" />
								Subscribe — ${PREMIUM_PRICE.base / 100}/mo
							</Button>
						</a>
					)}
				</div>
				{isSubscribed && billing && (
					<p className="text-sm text-muted-foreground">
						{billing.quota.used} of {billing.quota.total} premium servers used
						{billing.quota.available > 0 && ` — ${billing.quota.available} available`}
					</p>
				)}
			</div>

			{/* Assigned servers */}
			{isSubscribed && billing && (
				<div className="glass-panel p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-medium">Premium Servers</h3>
						{billing.quota.available > 0 && (
							<Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Add server
							</Button>
						)}
					</div>

					{billing.assignments.length === 0 ? (
						<EmptyState
							icon={Server}
							title="No servers assigned"
							description="Assign premium to a server to unlock higher limits."
							action={
								<Button size="sm" onClick={() => setAddOpen(true)}>
									<Plus className="h-4 w-4 mr-2" />
									Add server
								</Button>
							}
						/>
					) : (
						<div className="space-y-3">
							{billing.assignments.map((assignment) => (
								<div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-raised">
									<div className="flex items-center gap-3">
										<Avatar className="h-8 w-8">
											<AvatarImage src={assignment.guildIconUrl ?? undefined} />
											<AvatarFallback>{assignment.guildName[0]?.toUpperCase()}</AvatarFallback>
										</Avatar>
										<span className="text-sm font-medium">{assignment.guildName}</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setRemoveGuildId(assignment.guildId)}
									>
										<Minus className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Add server dialog */}
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Premium Server</DialogTitle>
					</DialogHeader>
					{eligibleGuilds.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">
							No eligible servers. All your servers already have premium or you need admin permissions.
						</p>
					) : (
						<div className="space-y-2">
							{eligibleGuilds.map((guild) => (
								<button
									key={guild.id}
									type="button"
									className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised w-full hover:bg-glass-50 transition-colors"
									onClick={() => {
										assignPremium.mutate(guild.id, { onSuccess: () => setAddOpen(false) })
									}}
									disabled={assignPremium.isPending}
								>
									<Avatar className="h-8 w-8">
										<AvatarImage src={guild.iconUrl ?? undefined} />
										<AvatarFallback>{guild.name[0]?.toUpperCase()}</AvatarFallback>
									</Avatar>
									<span className="text-sm font-medium">{guild.name}</span>
								</button>
							))}
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Remove confirm */}
			<ConfirmDialog
				open={removeGuildId !== null}
				onOpenChange={() => setRemoveGuildId(null)}
				title="Remove premium"
				description="This server will immediately drop to the free tier. Higher limits and features will be lost."
				confirmLabel="Remove"
				destructive
				loading={unassignPremium.isPending}
				onConfirm={() => {
					if (removeGuildId) {
						unassignPremium.mutate(removeGuildId, { onSuccess: () => setRemoveGuildId(null) })
					}
				}}
			/>
		</div>
	)
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx tsc --noEmit
cd /data/github/ticket-bot && git add apps/dashboard/src/hooks/use-billing.ts apps/dashboard/src/app/\(dashboard\)/billing/
git commit -m "feat(dashboard): add billing page with quota management and server assignment"
```

---

### Task 18: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: TypeScript check across all packages**

```bash
cd /data/github/ticket-bot && pnpm --filter @ticketbot/db exec tsc --noEmit && pnpm --filter @ticketbot/server exec tsc --noEmit && cd apps/dashboard && npx tsc --noEmit
```

Expected: 0 errors across all packages

- [ ] **Step 2: Biome lint check**

```bash
cd /data/github/ticket-bot && bunx biome check apps/dashboard/src/ apps/server/src/services/billing.ts apps/server/src/routes/api/billing.ts
```

Expected: 0 fixes needed

- [ ] **Step 3: Dashboard dev server startup**

```bash
cd /data/github/ticket-bot/apps/dashboard && npx next build 2>&1 | tail -20
```

Expected: Build succeeds. Any warnings about client components or dynamic imports are acceptable; errors are not.

- [ ] **Step 4: Verify all routes exist**

Check that the following pages resolve in the build output:
- `/login`
- `/guilds`
- `/billing`
- `/[guildId]/settings`
- `/[guildId]/categories`
- `/[guildId]/panels`
- `/[guildId]/panels/[panelId]`
- `/[guildId]/tickets`
- `/[guildId]/tickets/[ticketId]`
- `/[guildId]/transcripts`
- `/[guildId]/roles`
- `/[guildId]/audit-logs`
- `/[guildId]/api-keys`
