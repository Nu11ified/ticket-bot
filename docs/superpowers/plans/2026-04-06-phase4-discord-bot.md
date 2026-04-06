# Phase 4: Discord Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Discord bot that powers ticket creation/lifecycle, guild/role/member sync, real-time message logging, transcript generation, and audit logging — all talking directly to PostgreSQL via `@ticketbot/db`.

**Architecture:** Bottom-up build: schema changes → config layer → service layer (audit, guild, ticket, transcript) → event handlers → slash commands → interaction handlers → bot entrypoint. Services encapsulate all DB logic; event handlers and commands are thin wrappers that call services and send Discord responses.

**Tech Stack:** discord.js v15 (dev tag), Drizzle ORM, PostgreSQL 16, Bun

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/config/plan-defaults.ts` | Tier default values for guild settings |
| `apps/bot/src/services/audit.ts` | Write audit log entries |
| `apps/bot/src/services/guild.ts` | Guild upsert, role sync, member sync |
| `apps/bot/src/services/ticket.ts` | Ticket CRUD, lifecycle, rate limiting |
| `apps/bot/src/services/transcript.ts` | Build/store transcripts, cleanup job |
| `apps/bot/src/utils/embeds.ts` | Embed builders for tickets, transcripts, status changes |
| `apps/bot/src/utils/permissions.ts` | Discord channel permission helpers |
| `apps/bot/src/events/ready.ts` | Ready event handler |
| `apps/bot/src/events/guild-create.ts` | Guild join: upsert + sync |
| `apps/bot/src/events/guild-delete.ts` | Guild leave: no-op |
| `apps/bot/src/events/guild-member-add.ts` | Member join: upsert guild_members |
| `apps/bot/src/events/guild-member-remove.ts` | Member leave: delete guild_members |
| `apps/bot/src/events/role-create.ts` | Insert discord_roles |
| `apps/bot/src/events/role-update.ts` | Update discord_roles |
| `apps/bot/src/events/role-delete.ts` | Delete discord_roles |
| `apps/bot/src/events/interaction-create.ts` | Route interactions to handlers |
| `apps/bot/src/events/message-create.ts` | Log messages in ticket channels |
| `apps/bot/src/commands/registry.ts` | Slash command definitions + registration |
| `apps/bot/src/commands/close.ts` | Close ticket command |
| `apps/bot/src/commands/reopen.ts` | Reopen ticket command |
| `apps/bot/src/commands/claim.ts` | Claim ticket command |
| `apps/bot/src/commands/unclaim.ts` | Unclaim ticket command |
| `apps/bot/src/commands/transfer.ts` | Transfer ticket command |
| `apps/bot/src/commands/priority.ts` | Set priority command |
| `apps/bot/src/commands/status.ts` | Set status command |
| `apps/bot/src/commands/add.ts` | Add user to ticket command |
| `apps/bot/src/commands/remove.ts` | Remove user from ticket command |
| `apps/bot/src/interactions/panel-button.ts` | Panel button click handler |
| `apps/bot/src/interactions/form-modal.ts` | Form modal submit handler |

### Modified files

| File | Change |
|------|--------|
| `packages/shared/src/config/index.ts` | Create (new file) — re-export plan-defaults |
| `packages/shared/src/index.ts` | Add config re-export |
| `packages/shared/package.json` | Add config export path |
| `packages/db/src/schema/guilds.ts` | Add 2 columns to guild_settings |
| `packages/db/migrations/` | Regenerated |
| `apps/bot/src/index.ts` | Rewrite: event registration, command registration, cleanup job |
| `apps/bot/package.json` | Add `@ticketbot/auth` dependency |

---

### Task 1: Schema — Add guild_settings columns + regenerate migration

**Files:**
- Modify: `packages/db/src/schema/guilds.ts`
- Regenerated: `packages/db/migrations/`

- [ ] **Step 1: Add columns to `guild_settings` in `packages/db/src/schema/guilds.ts`**

Add `transcriptRetentionDays` and `ticketCooldownSeconds` to the `guildSettings` table definition. Add them after the `autoCloseHours` column:

```typescript
autoCloseHours: integer('auto_close_hours').default(48),
transcriptRetentionDays: integer('transcript_retention_days').default(5).notNull(),
ticketCooldownSeconds: integer('ticket_cooldown_seconds').default(60).notNull(),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /data/github/ticket-bot/packages/db && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Delete old migration**

Run: `rm -rf /data/github/ticket-bot/packages/db/migrations`

- [ ] **Step 4: Start test Postgres**

```bash
docker run -d --name ticketbot-pg-test -p 5435:5432 -e POSTGRES_DB=ticketbot -e POSTGRES_USER=ticketbot -e POSTGRES_PASSWORD=ticketbot postgres:16-alpine
sleep 3
```

- [ ] **Step 5: Generate new migration**

Run: `cd /data/github/ticket-bot && DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5435/ticketbot pnpm --filter @ticketbot/db generate -- --name init`

Expected: Migration file generated with 25 tables.

- [ ] **Step 6: Apply migration and seed**

```bash
cd /data/github/ticket-bot && DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5435/ticketbot pnpm --filter @ticketbot/db migrate
cd /data/github/ticket-bot && DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5435/ticketbot pnpm --filter @ticketbot/db seed
```

- [ ] **Step 7: Verify new columns exist**

Run: `docker exec ticketbot-pg-test psql -U ticketbot -d ticketbot -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'guild_settings' AND column_name IN ('transcript_retention_days', 'ticket_cooldown_seconds');"`

Expected: Both columns exist, type `integer`, defaults `5` and `60`.

- [ ] **Step 8: Clean up**

Run: `docker stop ticketbot-pg-test && docker rm ticketbot-pg-test`

- [ ] **Step 9: Commit**

```bash
cd /data/github/ticket-bot && git add packages/db/src/schema/guilds.ts packages/db/migrations/
git commit -m "feat: add transcriptRetentionDays and ticketCooldownSeconds to guild_settings"
```

---

### Task 2: Config — Create plan defaults

**Files:**
- Create: `packages/shared/src/config/plan-defaults.ts`
- Create: `packages/shared/src/config/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Create `packages/shared/src/config/plan-defaults.ts`**

```typescript
import type { PlanTier } from '../types/index.js'

interface PlanDefaults {
	transcriptRetentionDays: number
	ticketCooldownSeconds: number
	maxOpenTicketsPerUser: number
}

export const PLAN_DEFAULTS: Record<PlanTier, PlanDefaults> = {
	free: {
		transcriptRetentionDays: 5,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 1,
	},
	premium: {
		transcriptRetentionDays: 180,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 5,
	},
} as const
```

- [ ] **Step 2: Replace `packages/shared/src/config/index.ts`**

Read the existing file first. Replace it with:

```typescript
export { PLAN_DEFAULTS } from './plan-defaults.js'

export const TICKET_RATE_LIMIT = {
	maxPerMinute: 1,
	windowMs: 60_000,
} as const

export const TRANSCRIPT_RETENTION = {
	free: 1 * 24 * 60 * 60 * 1000, // 1 day in ms
	premium: Number.POSITIVE_INFINITY,
} as const

export const PREMIUM_PRICE = {
	base: 800, // $8.00 in cents
	additionalServer: 300, // $3.00 in cents
	includedServers: 3,
} as const
```

- [ ] **Step 3: Update `packages/shared/src/index.ts`**

Read the existing file. It should already have `export * from './constants/index.js'`. The existing export re-exports everything from `constants/index.ts`, which now includes `PLAN_DEFAULTS`. Verify it has:

```typescript
export * from './types/index.js'
export * from './constants/index.js'
```

If it already looks like this, no change needed. If `config` is a separate directory from `constants`, add the export. The existing structure uses `constants/` not `config/`, so the plan-defaults file goes under `constants/` following the established pattern.

**Correction:** The spec says `packages/shared/src/config/plan-defaults.ts` but the existing codebase uses `packages/shared/src/constants/`. Follow the existing pattern — create the file at `packages/shared/src/constants/plan-defaults.ts` instead. Update Step 1 path accordingly.

- [ ] **Step 4: Add config export to `packages/shared/package.json`**

Read the file. It has an `exports` map. Add a `"./config"` entry:

```json
{
	"exports": {
		".": "./src/index.ts",
		"./types": "./src/types/index.ts",
		"./constants": "./src/constants/index.ts",
		"./config": "./src/constants/index.ts"
	}
}
```

This gives consumers a `@ticketbot/shared/config` alias if they prefer it, while keeping the canonical path at `constants`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /data/github/ticket-bot/packages/shared && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /data/github/ticket-bot && git add packages/shared/
git commit -m "feat: add PLAN_DEFAULTS config for tier-based guild settings"
```

---

### Task 3: Bot — Add @ticketbot/auth dependency

**Files:**
- Modify: `apps/bot/package.json`

- [ ] **Step 1: Add `@ticketbot/auth` to dependencies in `apps/bot/package.json`**

Read the existing file. Add `"@ticketbot/auth": "workspace:*"` to `dependencies`:

```json
{
	"dependencies": {
		"@ticketbot/auth": "workspace:*",
		"@ticketbot/db": "workspace:*",
		"@ticketbot/shared": "workspace:*",
		"discord.js": "dev"
	}
}
```

- [ ] **Step 2: Install**

Run: `cd /data/github/ticket-bot && pnpm install`

- [ ] **Step 3: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/package.json pnpm-lock.yaml
git commit -m "chore: add @ticketbot/auth dependency to bot"
```

---

### Task 4: Services — Audit service

**Files:**
- Create: `apps/bot/src/services/audit.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p /data/github/ticket-bot/apps/bot/src/services`

- [ ] **Step 2: Create `apps/bot/src/services/audit.ts`**

```typescript
import { eq } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { auditLogs, users } from '@ticketbot/db'
import type { AuditAction, AuditActorType } from '@ticketbot/shared'

interface AuditEntry {
	guildId: number
	ticketId?: number | null
	actorDiscordId: string
	actorType: AuditActorType
	action: AuditAction
	metadata?: Record<string, unknown>
}

export async function writeAuditLog(db: Database, entry: AuditEntry): Promise<void> {
	let actorId: string | null = null

	if (entry.actorType === 'user') {
		const user = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.discordId, entry.actorDiscordId))
			.limit(1)

		const firstUser = user[0]
		if (firstUser) {
			actorId = firstUser.id
		}
	}

	await db.insert(auditLogs).values({
		guildId: entry.guildId,
		ticketId: entry.ticketId ?? null,
		actorId,
		actorDiscordId: entry.actorDiscordId,
		actorType: entry.actorType,
		action: entry.action,
		metadata: entry.metadata ?? {},
	})
}
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/services/audit.ts
git commit -m "feat: add audit logging service"
```

---

### Task 5: Services — Guild service

**Files:**
- Create: `apps/bot/src/services/guild.ts`

- [ ] **Step 1: Create `apps/bot/src/services/guild.ts`**

```typescript
import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { discordRoles, guildMembers, guildSettings, guilds, users } from '@ticketbot/db'
import { PLAN_DEFAULTS } from '@ticketbot/shared'
import type { PlanTier } from '@ticketbot/shared'
import type { Guild as DiscordGuild, Role as DiscordRole, GuildMember as DiscordMember } from 'discord.js'

export async function upsertGuild(
	db: Database,
	discordGuild: DiscordGuild,
): Promise<{ guildId: number; isNew: boolean }> {
	const existing = await db
		.select({ id: guilds.id, planTier: guilds.planTier })
		.from(guilds)
		.where(eq(guilds.discordId, discordGuild.id))
		.limit(1)

	const first = existing[0]
	if (first) {
		await db
			.update(guilds)
			.set({
				name: discordGuild.name,
				iconUrl: discordGuild.iconURL() ?? null,
				updatedAt: new Date(),
			})
			.where(eq(guilds.id, first.id))

		return { guildId: first.id, isNew: false }
	}

	const inserted = await db
		.insert(guilds)
		.values({
			discordId: discordGuild.id,
			name: discordGuild.name,
			iconUrl: discordGuild.iconURL() ?? null,
		})
		.returning({ id: guilds.id, planTier: guilds.planTier })

	const newGuild = inserted[0]
	if (!newGuild) throw new Error('Failed to insert guild')

	const tier = newGuild.planTier as PlanTier
	const defaults = PLAN_DEFAULTS[tier]

	await db.insert(guildSettings).values({
		guildId: newGuild.id,
		transcriptRetentionDays: defaults.transcriptRetentionDays,
		ticketCooldownSeconds: defaults.ticketCooldownSeconds,
	})

	return { guildId: newGuild.id, isNew: true }
}

export async function syncGuildRoles(
	db: Database,
	guildId: number,
	roles: DiscordRole[],
): Promise<void> {
	const existingRoles = await db
		.select({ id: discordRoles.id, discordRoleId: discordRoles.discordRoleId })
		.from(discordRoles)
		.where(eq(discordRoles.guildId, guildId))

	const existingMap = new Map(existingRoles.map((r) => [r.discordRoleId, r.id]))
	const currentIds = new Set(roles.map((r) => r.id))

	for (const role of roles) {
		if (role.managed) continue

		if (existingMap.has(role.id)) {
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

	for (const [discordRoleId, dbId] of existingMap) {
		if (!currentIds.has(discordRoleId)) {
			await db.delete(discordRoles).where(eq(discordRoles.id, dbId))
		}
	}
}

export async function syncGuildMembers(
	db: Database,
	guildId: number,
	members: DiscordMember[],
): Promise<void> {
	const discordIds = members.map((m) => m.user.id)
	if (discordIds.length === 0) return

	const knownUsers = await db
		.select({ id: users.id, discordId: users.discordId })
		.from(users)
		.where(inArray(users.discordId, discordIds))

	for (const user of knownUsers) {
		const existing = await db
			.select({ id: guildMembers.id })
			.from(guildMembers)
			.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, user.id)))
			.limit(1)

		if (existing.length === 0) {
			await db.insert(guildMembers).values({ guildId, userId: user.id })
		}
	}
}

export async function upsertGuildMember(
	db: Database,
	guildId: number,
	discordId: string,
): Promise<void> {
	const user = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.discordId, discordId))
		.limit(1)

	const first = user[0]
	if (!first) return

	const existing = await db
		.select({ id: guildMembers.id })
		.from(guildMembers)
		.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, first.id)))
		.limit(1)

	if (existing.length === 0) {
		await db.insert(guildMembers).values({ guildId, userId: first.id })
	}
}

export async function removeGuildMember(
	db: Database,
	guildId: number,
	discordId: string,
): Promise<void> {
	const user = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.discordId, discordId))
		.limit(1)

	const first = user[0]
	if (!first) return

	await db
		.delete(guildMembers)
		.where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, first.id)))
}

export async function resolveGuildId(db: Database, discordGuildId: string): Promise<number | null> {
	const result = await db
		.select({ id: guilds.id })
		.from(guilds)
		.where(eq(guilds.discordId, discordGuildId))
		.limit(1)

	return result[0]?.id ?? null
}
```

- [ ] **Step 2: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/services/guild.ts
git commit -m "feat: add guild service (upsert, role sync, member sync)"
```

---

### Task 6: Utilities — Embeds and permissions helpers

**Files:**
- Create: `apps/bot/src/utils/embeds.ts`
- Create: `apps/bot/src/utils/permissions.ts`

- [ ] **Step 1: Create directories**

Run: `mkdir -p /data/github/ticket-bot/apps/bot/src/utils`

- [ ] **Step 2: Create `apps/bot/src/utils/embeds.ts`**

```typescript
import { EmbedBuilder } from 'discord.js'
import type { TicketStatus, TicketPriority } from '@ticketbot/shared'

const STATUS_COLORS: Record<string, number> = {
	open: 0x22c55e,
	pending: 0xf59e0b,
	waiting_user: 0x3b82f6,
	waiting_staff: 0x8b5cf6,
	escalated: 0xef4444,
	resolved: 0x06b6d4,
	closed: 0x6b7280,
	archived: 0x374151,
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
	low: 'Low',
	normal: 'Normal',
	high: 'High',
	urgent: 'Urgent',
}

export function ticketWelcomeEmbed(opts: {
	ticketNumber: string
	categoryName: string
	creatorTag: string
	formResponses?: Array<{ label: string; value: string }>
}): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setTitle(`Ticket ${opts.ticketNumber}`)
		.setDescription(`Category: **${opts.categoryName}**\nCreated by: ${opts.creatorTag}`)
		.setColor(STATUS_COLORS.open)
		.setTimestamp()

	if (opts.formResponses && opts.formResponses.length > 0) {
		for (const response of opts.formResponses) {
			embed.addFields({ name: response.label, value: response.value || 'N/A' })
		}
	}

	return embed
}

export function ticketClosedEmbed(opts: {
	ticketNumber: string
	closerTag: string
	reason?: string
}): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle(`Ticket ${opts.ticketNumber} — Closed`)
		.setDescription(
			`Closed by: ${opts.closerTag}${opts.reason ? `\nReason: ${opts.reason}` : ''}`,
		)
		.setColor(STATUS_COLORS.closed)
		.setTimestamp()
}

export function ticketReopenedEmbed(opts: {
	ticketNumber: string
	reopenerTag: string
}): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle(`Ticket ${opts.ticketNumber} — Reopened`)
		.setDescription(`Reopened by: ${opts.reopenerTag}`)
		.setColor(STATUS_COLORS.open)
		.setTimestamp()
}

export function statusChangeEmbed(opts: {
	field: string
	oldValue: string
	newValue: string
	changerTag: string
}): EmbedBuilder {
	const color = STATUS_COLORS[opts.newValue] ?? 0x6b7280
	return new EmbedBuilder()
		.setDescription(
			`**${opts.field}** changed: ${opts.oldValue} → **${opts.newValue}** by ${opts.changerTag}`,
		)
		.setColor(color)
		.setTimestamp()
}

export function claimEmbed(userTag: string, action: 'claimed' | 'unclaimed'): EmbedBuilder {
	return new EmbedBuilder()
		.setDescription(`${userTag} ${action} this ticket`)
		.setColor(action === 'claimed' ? 0x22c55e : 0xf59e0b)
		.setTimestamp()
}

export function transferEmbed(fromTag: string, toTag: string): EmbedBuilder {
	return new EmbedBuilder()
		.setDescription(`${fromTag} transferred this ticket to ${toTag}`)
		.setColor(0x3b82f6)
		.setTimestamp()
}

export function userAddRemoveEmbed(
	actorTag: string,
	targetTag: string,
	action: 'added' | 'removed',
): EmbedBuilder {
	return new EmbedBuilder()
		.setDescription(`${actorTag} ${action} ${targetTag} ${action === 'added' ? 'to' : 'from'} the ticket`)
		.setColor(action === 'added' ? 0x22c55e : 0xef4444)
		.setTimestamp()
}

export function transcriptSummaryEmbed(opts: {
	ticketNumber: string
	messageCount: number
	participantCount: number
	durationSeconds: number
	categoryName: string
}): EmbedBuilder {
	const hours = Math.floor(opts.durationSeconds / 3600)
	const minutes = Math.floor((opts.durationSeconds % 3600) / 60)
	const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

	return new EmbedBuilder()
		.setTitle(`Transcript — ${opts.ticketNumber}`)
		.addFields(
			{ name: 'Category', value: opts.categoryName, inline: true },
			{ name: 'Messages', value: String(opts.messageCount), inline: true },
			{ name: 'Participants', value: String(opts.participantCount), inline: true },
			{ name: 'Duration', value: duration, inline: true },
		)
		.setColor(0x6b7280)
		.setTimestamp()
}
```

- [ ] **Step 3: Create `apps/bot/src/utils/permissions.ts`**

```typescript
import {
	ChannelType,
	OverwriteType,
	PermissionFlagsBits,
	type CategoryChannel,
	type Guild,
	type GuildChannelCreateOptions,
	type TextChannel,
} from 'discord.js'

export function buildTicketChannelOptions(opts: {
	guild: Guild
	channelName: string
	categoryChannel?: CategoryChannel | null
	creatorId: string
	staffRoleIds: string[]
}): GuildChannelCreateOptions {
	const permissionOverwrites = [
		{
			id: opts.guild.roles.everyone.id,
			type: OverwriteType.Role as const,
			deny: [PermissionFlagsBits.ViewChannel],
		},
		{
			id: opts.creatorId,
			type: OverwriteType.Member as const,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
				PermissionFlagsBits.AttachFiles,
			],
		},
		...opts.staffRoleIds.map((roleId) => ({
			id: roleId,
			type: OverwriteType.Role as const,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
				PermissionFlagsBits.AttachFiles,
				PermissionFlagsBits.ManageMessages,
			],
		})),
	]

	return {
		name: opts.channelName,
		type: ChannelType.GuildText,
		parent: opts.categoryChannel ?? undefined,
		permissionOverwrites,
	}
}

export async function lockTicketChannel(
	channel: TextChannel,
	creatorId: string,
	staffRoleIds: string[],
): Promise<void> {
	await channel.permissionOverwrites.edit(creatorId, {
		SendMessages: false,
	})

	for (const roleId of staffRoleIds) {
		await channel.permissionOverwrites.edit(roleId, {
			SendMessages: false,
		})
	}
}

export async function unlockTicketChannel(
	channel: TextChannel,
	creatorId: string,
	staffRoleIds: string[],
): Promise<void> {
	await channel.permissionOverwrites.edit(creatorId, {
		SendMessages: true,
	})

	for (const roleId of staffRoleIds) {
		await channel.permissionOverwrites.edit(roleId, {
			SendMessages: true,
		})
	}
}
```

- [ ] **Step 4: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/utils/
git commit -m "feat: add embed builders and channel permission helpers"
```

---

### Task 7: Services — Ticket service

**Files:**
- Create: `apps/bot/src/services/ticket.ts`

- [ ] **Step 1: Create `apps/bot/src/services/ticket.ts`**

```typescript
import { and, eq, inArray, notInArray, sql, count } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import {
	categories,
	categoryRoleAccess,
	discordRoles,
	guildSettings,
	guilds,
	rateLimits,
	ticketFormResponses,
	ticketMessages,
	tickets,
	users,
} from '@ticketbot/db'

export interface TicketContext {
	ticketId: number
	guildId: number
	ticketNumber: string
	categoryId: number
	channelId: string
	creatorId: string
	creatorDiscordId: string
	assignedToId: string | null
	status: string
	priority: string
}

export async function resolveTicketByChannelId(
	db: Database,
	channelId: string,
): Promise<TicketContext | null> {
	const result = await db
		.select({
			ticketId: tickets.id,
			guildId: tickets.guildId,
			ticketNumber: tickets.ticketNumber,
			categoryId: tickets.categoryId,
			channelId: tickets.channelId,
			creatorId: tickets.creatorId,
			assignedToId: tickets.assignedToId,
			status: tickets.status,
			priority: tickets.priority,
		})
		.from(tickets)
		.where(eq(tickets.channelId, channelId))
		.limit(1)

	const ticket = result[0]
	if (!ticket || !ticket.channelId) return null

	const creator = await db
		.select({ discordId: users.discordId })
		.from(users)
		.where(eq(users.id, ticket.creatorId))
		.limit(1)

	return {
		...ticket,
		channelId: ticket.channelId,
		creatorDiscordId: creator[0]?.discordId ?? '',
	}
}

export async function getStaffRoleDiscordIds(
	db: Database,
	categoryId: number,
): Promise<string[]> {
	const access = await db
		.select({ discordRoleId: discordRoles.discordRoleId })
		.from(categoryRoleAccess)
		.innerJoin(discordRoles, eq(categoryRoleAccess.discordRoleId, discordRoles.id))
		.where(and(eq(categoryRoleAccess.categoryId, categoryId), eq(categoryRoleAccess.accessType, 'staff')))

	return access.map((r) => r.discordRoleId)
}

export async function checkRateLimit(
	db: Database,
	guildId: number,
	userDiscordId: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
	const settings = await db
		.select({ ticketCooldownSeconds: guildSettings.ticketCooldownSeconds })
		.from(guildSettings)
		.where(eq(guildSettings.guildId, guildId))
		.limit(1)

	const cooldown = settings[0]?.ticketCooldownSeconds ?? 60

	const rateLimit = await db
		.select({ lastActionAt: rateLimits.lastActionAt })
		.from(rateLimits)
		.where(
			and(
				eq(rateLimits.guildId, guildId),
				eq(rateLimits.userDiscordId, userDiscordId),
				eq(rateLimits.action, 'ticket.create'),
			),
		)
		.limit(1)

	const last = rateLimit[0]
	if (!last) return { allowed: true }

	const elapsed = (Date.now() - last.lastActionAt.getTime()) / 1000
	if (elapsed < cooldown) {
		return { allowed: false, retryAfterSeconds: Math.ceil(cooldown - elapsed) }
	}

	return { allowed: true }
}

export async function checkMaxOpen(
	db: Database,
	creatorId: string,
	categoryId: number,
): Promise<{ allowed: boolean; current: number; max: number }> {
	const category = await db
		.select({ maxOpenPerUser: categories.maxOpenPerUser })
		.from(categories)
		.where(eq(categories.id, categoryId))
		.limit(1)

	const max = category[0]?.maxOpenPerUser ?? 1

	const openCount = await db
		.select({ count: count() })
		.from(tickets)
		.where(
			and(
				eq(tickets.creatorId, creatorId),
				eq(tickets.categoryId, categoryId),
				notInArray(tickets.status, ['closed', 'archived']),
			),
		)

	const current = openCount[0]?.count ?? 0

	return { allowed: current < max, current, max }
}

export async function createTicket(
	db: Database,
	opts: {
		guildId: number
		categoryId: number
		channelId: string
		creatorId: string
		creatorDiscordId: string
		subject?: string
		formResponses?: Array<{ fieldId: number; value: string }>
	},
): Promise<{ ticketId: number; ticketNumber: string }> {
	const guild = await db
		.select({ ticketPrefix: guilds.ticketPrefix, ticketCounter: guilds.ticketCounter })
		.from(guilds)
		.where(eq(guilds.id, opts.guildId))
		.limit(1)

	const guildRow = guild[0]
	if (!guildRow) throw new Error('Guild not found')

	const newCounter = guildRow.ticketCounter + 1
	const ticketNumber = `${guildRow.ticketPrefix}-${String(newCounter).padStart(4, '0')}`

	await db
		.update(guilds)
		.set({ ticketCounter: newCounter, updatedAt: new Date() })
		.where(eq(guilds.id, opts.guildId))

	const inserted = await db
		.insert(tickets)
		.values({
			guildId: opts.guildId,
			categoryId: opts.categoryId,
			ticketNumber,
			channelId: opts.channelId,
			creatorId: opts.creatorId,
			subject: opts.subject ?? null,
			status: 'open',
			priority: 'normal',
		})
		.returning({ id: tickets.id })

	const ticket = inserted[0]
	if (!ticket) throw new Error('Failed to insert ticket')

	if (opts.formResponses && opts.formResponses.length > 0) {
		await db.insert(ticketFormResponses).values(
			opts.formResponses.map((r) => ({
				ticketId: ticket.id,
				fieldId: r.fieldId,
				value: r.value,
			})),
		)
	}

	await db
		.insert(rateLimits)
		.values({
			guildId: opts.guildId,
			userDiscordId: opts.creatorDiscordId,
			action: 'ticket.create',
			lastActionAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [rateLimits.guildId, rateLimits.userDiscordId, rateLimits.action],
			set: { lastActionAt: new Date() },
		})

	return { ticketId: ticket.id, ticketNumber }
}

export async function updateTicketStatus(
	db: Database,
	ticketId: number,
	status: string,
): Promise<void> {
	await db
		.update(tickets)
		.set({ status, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function closeTicket(
	db: Database,
	ticketId: number,
	closedById: string,
	reason?: string,
): Promise<void> {
	await db
		.update(tickets)
		.set({
			status: 'closed',
			closedById,
			closedAt: new Date(),
			closeReason: reason ?? null,
			updatedAt: new Date(),
		})
		.where(eq(tickets.id, ticketId))
}

export async function reopenTicket(db: Database, ticketId: number): Promise<void> {
	await db
		.update(tickets)
		.set({
			status: 'open',
			closedById: null,
			closedAt: null,
			closeReason: null,
			reopenedCount: sql`${tickets.reopenedCount} + 1`,
			updatedAt: new Date(),
		})
		.where(eq(tickets.id, ticketId))
}

export async function claimTicket(
	db: Database,
	ticketId: number,
	userId: string,
): Promise<void> {
	await db
		.update(tickets)
		.set({ assignedToId: userId, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function unclaimTicket(db: Database, ticketId: number): Promise<void> {
	await db
		.update(tickets)
		.set({ assignedToId: null, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function transferTicket(
	db: Database,
	ticketId: number,
	newAssigneeId: string,
): Promise<void> {
	await db
		.update(tickets)
		.set({ assignedToId: newAssigneeId, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function updateTicketPriority(
	db: Database,
	ticketId: number,
	priority: string,
): Promise<void> {
	await db
		.update(tickets)
		.set({ priority, updatedAt: new Date() })
		.where(eq(tickets.id, ticketId))
}

export async function ensureUser(
	db: Database,
	discordId: string,
	username: string,
	displayName?: string,
	avatarUrl?: string,
): Promise<string> {
	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.discordId, discordId))
		.limit(1)

	const first = existing[0]
	if (first) {
		await db
			.update(users)
			.set({ username, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null, updatedAt: new Date() })
			.where(eq(users.id, first.id))
		return first.id
	}

	const inserted = await db
		.insert(users)
		.values({ discordId, username, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null })
		.returning({ id: users.id })

	const newUser = inserted[0]
	if (!newUser) throw new Error('Failed to insert user')
	return newUser.id
}

export async function logMessage(
	db: Database,
	opts: {
		ticketId: number
		userId: string
		discordMessageId: string
		content: string
		isStaff: boolean
		attachments: unknown[]
	},
): Promise<void> {
	await db.insert(ticketMessages).values({
		ticketId: opts.ticketId,
		userId: opts.userId,
		discordMessageId: opts.discordMessageId,
		content: opts.content,
		isStaff: opts.isStaff,
		attachments: opts.attachments,
	})
}

export async function setFirstResponseAt(db: Database, ticketId: number): Promise<void> {
	await db
		.update(tickets)
		.set({ firstResponseAt: new Date() })
		.where(and(eq(tickets.id, ticketId), sql`${tickets.firstResponseAt} IS NULL`))
}
```

- [ ] **Step 2: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/services/ticket.ts
git commit -m "feat: add ticket service (CRUD, lifecycle, rate limiting)"
```

---

### Task 8: Services — Transcript service

**Files:**
- Create: `apps/bot/src/services/transcript.ts`

- [ ] **Step 1: Create `apps/bot/src/services/transcript.ts`**

```typescript
import { and, eq, lt, sql } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import {
	categories,
	guildSettings,
	ticketMessages,
	tickets,
	transcripts,
	users,
} from '@ticketbot/db'
import type { Client } from 'discord.js'

interface TranscriptMessage {
	userId: string
	discordId: string
	username: string
	content: string
	timestamp: string
	isStaff: boolean
	attachments: unknown[]
}

interface TranscriptParticipant {
	userId: string
	discordId: string
	username: string
	messageCount: number
	isStaff: boolean
}

export async function buildAndStoreTranscript(
	db: Database,
	ticketId: number,
	guildId: number,
): Promise<number> {
	const messages = await db
		.select({
			userId: ticketMessages.userId,
			content: ticketMessages.content,
			isStaff: ticketMessages.isStaff,
			attachments: ticketMessages.attachments,
			createdAt: ticketMessages.createdAt,
		})
		.from(ticketMessages)
		.where(eq(ticketMessages.ticketId, ticketId))
		.orderBy(ticketMessages.createdAt)

	const userIds = [...new Set(messages.map((m) => m.userId))]
	const userRows = await db
		.select({ id: users.id, discordId: users.discordId, username: users.username })
		.from(users)

	const userMap = new Map(userRows.map((u) => [u.id, u]))

	const transcriptMessages: TranscriptMessage[] = messages.map((m) => {
		const user = userMap.get(m.userId)
		return {
			userId: m.userId,
			discordId: user?.discordId ?? '',
			username: user?.username ?? 'Unknown',
			content: m.content,
			timestamp: m.createdAt.toISOString(),
			isStaff: m.isStaff,
			attachments: m.attachments as unknown[],
		}
	})

	const participantMap = new Map<string, { count: number; isStaff: boolean }>()
	for (const msg of messages) {
		const existing = participantMap.get(msg.userId)
		if (existing) {
			existing.count++
		} else {
			participantMap.set(msg.userId, { count: 1, isStaff: msg.isStaff })
		}
	}

	const participants: TranscriptParticipant[] = [...participantMap.entries()].map(
		([userId, data]) => {
			const user = userMap.get(userId)
			return {
				userId,
				discordId: user?.discordId ?? '',
				username: user?.username ?? 'Unknown',
				messageCount: data.count,
				isStaff: data.isStaff,
			}
		},
	)

	const ticket = await db
		.select({
			createdAt: tickets.createdAt,
			priority: tickets.priority,
			categoryId: tickets.categoryId,
		})
		.from(tickets)
		.where(eq(tickets.id, ticketId))
		.limit(1)

	const ticketRow = ticket[0]
	const durationSeconds = ticketRow
		? Math.floor((Date.now() - ticketRow.createdAt.getTime()) / 1000)
		: 0

	const category = ticketRow
		? await db
				.select({ name: categories.name })
				.from(categories)
				.where(eq(categories.id, ticketRow.categoryId))
				.limit(1)
		: []

	const settings = await db
		.select({ transcriptRetentionDays: guildSettings.transcriptRetentionDays })
		.from(guildSettings)
		.where(eq(guildSettings.guildId, guildId))
		.limit(1)

	const retentionDays = settings[0]?.transcriptRetentionDays ?? 5
	const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)

	const metadata = {
		duration: durationSeconds,
		messageCount: messages.length,
		category: category[0]?.name ?? 'Unknown',
		priority: ticketRow?.priority ?? 'normal',
	}

	const inserted = await db
		.insert(transcripts)
		.values({
			ticketId,
			guildId,
			messages: transcriptMessages,
			messageCount: messages.length,
			participants,
			metadata,
			expiresAt,
		})
		.returning({ id: transcripts.id })

	const transcript = inserted[0]
	if (!transcript) throw new Error('Failed to insert transcript')
	return transcript.id
}

export async function runCleanupJob(db: Database, client: Client): Promise<{ purged: number; channelsDeleted: number }> {
	const expired = await db
		.select({
			id: transcripts.id,
			ticketId: transcripts.ticketId,
		})
		.from(transcripts)
		.where(lt(transcripts.expiresAt, new Date()))

	let purged = 0
	let channelsDeleted = 0

	for (const transcript of expired) {
		const ticket = await db
			.select({ channelId: tickets.channelId, guildId: tickets.guildId })
			.from(tickets)
			.where(eq(tickets.id, transcript.ticketId))
			.limit(1)

		const ticketRow = ticket[0]
		if (ticketRow?.channelId) {
			try {
				const channel = await client.channels.fetch(ticketRow.channelId)
				if (channel) {
					await channel.delete()
					channelsDeleted++
				}
			} catch {
				// Channel already deleted or bot lacks permissions
			}
		}

		await db.delete(ticketMessages).where(eq(ticketMessages.ticketId, transcript.ticketId))
		await db.delete(transcripts).where(eq(transcripts.id, transcript.id))
		purged++
	}

	return { purged, channelsDeleted }
}
```

- [ ] **Step 2: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/services/transcript.ts
git commit -m "feat: add transcript service (build, store, cleanup)"
```

---

### Task 9: Events — ready, guild-create, guild-delete

**Files:**
- Create: `apps/bot/src/events/ready.ts`
- Create: `apps/bot/src/events/guild-create.ts`
- Create: `apps/bot/src/events/guild-delete.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p /data/github/ticket-bot/apps/bot/src/events`

- [ ] **Step 2: Create `apps/bot/src/events/ready.ts`**

```typescript
import type { Client } from 'discord.js'

export function handleReady(client: Client<true>): void {
	console.log(`Bot ready as ${client.user.tag} — serving ${client.guilds.cache.size} guilds`)
}
```

- [ ] **Step 3: Create `apps/bot/src/events/guild-create.ts`**

```typescript
import type { Guild as DiscordGuild } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { upsertGuild, syncGuildRoles, syncGuildMembers } from '../services/guild.js'

export async function handleGuildCreate(db: Database, guild: DiscordGuild): Promise<void> {
	console.log(`Joined guild: ${guild.name} (${guild.id})`)

	const { guildId } = await upsertGuild(db, guild)

	const roles = [...guild.roles.cache.values()]
	await syncGuildRoles(db, guildId, roles)

	try {
		const members = await guild.members.fetch()
		await syncGuildMembers(db, guildId, [...members.values()])
	} catch (err) {
		console.error(`Failed to fetch members for guild ${guild.id}:`, err)
	}
}
```

- [ ] **Step 4: Create `apps/bot/src/events/guild-delete.ts`**

```typescript
import type { Guild as DiscordGuild } from 'discord.js'

export function handleGuildDelete(guild: DiscordGuild): void {
	console.log(`Left guild: ${guild.name} (${guild.id})`)
}
```

- [ ] **Step 5: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/events/ready.ts apps/bot/src/events/guild-create.ts apps/bot/src/events/guild-delete.ts
git commit -m "feat: add ready, guild-create, guild-delete event handlers"
```

---

### Task 10: Events — guild-member-add, guild-member-remove

**Files:**
- Create: `apps/bot/src/events/guild-member-add.ts`
- Create: `apps/bot/src/events/guild-member-remove.ts`

- [ ] **Step 1: Create `apps/bot/src/events/guild-member-add.ts`**

```typescript
import type { GuildMember } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { resolveGuildId, upsertGuildMember } from '../services/guild.js'

export async function handleGuildMemberAdd(db: Database, member: GuildMember): Promise<void> {
	const guildId = await resolveGuildId(db, member.guild.id)
	if (!guildId) return

	await upsertGuildMember(db, guildId, member.user.id)
}
```

- [ ] **Step 2: Create `apps/bot/src/events/guild-member-remove.ts`**

```typescript
import type { GuildMember, PartialGuildMember } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { resolveGuildId, removeGuildMember } from '../services/guild.js'

export async function handleGuildMemberRemove(
	db: Database,
	member: GuildMember | PartialGuildMember,
): Promise<void> {
	const guildId = await resolveGuildId(db, member.guild.id)
	if (!guildId) return

	await removeGuildMember(db, guildId, member.user.id)
}
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/events/guild-member-add.ts apps/bot/src/events/guild-member-remove.ts
git commit -m "feat: add guild member add/remove event handlers"
```

---

### Task 11: Events — role-create, role-update, role-delete

**Files:**
- Create: `apps/bot/src/events/role-create.ts`
- Create: `apps/bot/src/events/role-update.ts`
- Create: `apps/bot/src/events/role-delete.ts`

- [ ] **Step 1: Create `apps/bot/src/events/role-create.ts`**

```typescript
import { eq } from 'drizzle-orm'
import type { Role } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { discordRoles } from '@ticketbot/db'
import { resolveGuildId } from '../services/guild.js'

export async function handleRoleCreate(db: Database, role: Role): Promise<void> {
	if (role.managed) return

	const guildId = await resolveGuildId(db, role.guild.id)
	if (!guildId) return

	await db.insert(discordRoles).values({
		guildId,
		discordRoleId: role.id,
		name: role.name,
		color: role.color,
		position: role.position,
	})
}
```

- [ ] **Step 2: Create `apps/bot/src/events/role-update.ts`**

```typescript
import { and, eq } from 'drizzle-orm'
import type { Role } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { discordRoles } from '@ticketbot/db'
import { resolveGuildId } from '../services/guild.js'

export async function handleRoleUpdate(db: Database, _oldRole: Role, newRole: Role): Promise<void> {
	if (newRole.managed) return

	const guildId = await resolveGuildId(db, newRole.guild.id)
	if (!guildId) return

	await db
		.update(discordRoles)
		.set({
			name: newRole.name,
			color: newRole.color,
			position: newRole.position,
			updatedAt: new Date(),
		})
		.where(and(eq(discordRoles.guildId, guildId), eq(discordRoles.discordRoleId, newRole.id)))
}
```

- [ ] **Step 3: Create `apps/bot/src/events/role-delete.ts`**

```typescript
import { and, eq } from 'drizzle-orm'
import type { Role } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { discordRoles } from '@ticketbot/db'
import { resolveGuildId } from '../services/guild.js'

export async function handleRoleDelete(db: Database, role: Role): Promise<void> {
	const guildId = await resolveGuildId(db, role.guild.id)
	if (!guildId) return

	await db
		.delete(discordRoles)
		.where(and(eq(discordRoles.guildId, guildId), eq(discordRoles.discordRoleId, role.id)))
}
```

- [ ] **Step 4: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/events/role-create.ts apps/bot/src/events/role-update.ts apps/bot/src/events/role-delete.ts
git commit -m "feat: add role create/update/delete event handlers"
```

---

### Task 12: Events — message-create (ticket message logging)

**Files:**
- Create: `apps/bot/src/events/message-create.ts`

- [ ] **Step 1: Create `apps/bot/src/events/message-create.ts`**

```typescript
import type { Message } from 'discord.js'
import type { Database } from '@ticketbot/db'
import {
	resolveTicketByChannelId,
	ensureUser,
	logMessage,
	setFirstResponseAt,
	getStaffRoleDiscordIds,
} from '../services/ticket.js'

export async function handleMessageCreate(db: Database, message: Message): Promise<void> {
	if (message.author.bot) return
	if (!message.guild) return

	const ticket = await resolveTicketByChannelId(db, message.channel.id)
	if (!ticket) return
	if (ticket.status === 'closed' || ticket.status === 'archived') return

	const userId = await ensureUser(
		db,
		message.author.id,
		message.author.username,
		message.author.displayName,
		message.author.avatarURL() ?? undefined,
	)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const member = message.member
	const isStaff = member
		? staffRoleIds.some((roleId) => member.roles.cache.has(roleId))
		: false

	const attachments = [...message.attachments.values()].map((a) => ({
		id: a.id,
		url: a.url,
		name: a.name,
		size: a.size,
		contentType: a.contentType,
	}))

	await logMessage(db, {
		ticketId: ticket.ticketId,
		userId,
		discordMessageId: message.id,
		content: message.content,
		isStaff,
		attachments,
	})

	if (isStaff) {
		await setFirstResponseAt(db, ticket.ticketId)
	}
}
```

- [ ] **Step 2: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/events/message-create.ts
git commit -m "feat: add message-create handler for ticket message logging"
```

---

### Task 13: Commands — Registry (slash command definitions + registration)

**Files:**
- Create: `apps/bot/src/commands/registry.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p /data/github/ticket-bot/apps/bot/src/commands`

- [ ] **Step 2: Create `apps/bot/src/commands/registry.ts`**

```typescript
import {
	ApplicationCommandOptionType,
	type Client,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js'

export const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
	{
		name: 'close',
		description: 'Close the current ticket',
		options: [
			{
				name: 'reason',
				description: 'Reason for closing',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
		],
	},
	{
		name: 'reopen',
		description: 'Reopen a closed ticket',
	},
	{
		name: 'claim',
		description: 'Claim the current ticket',
	},
	{
		name: 'unclaim',
		description: 'Unclaim the current ticket',
	},
	{
		name: 'transfer',
		description: 'Transfer the ticket to another staff member',
		options: [
			{
				name: 'user',
				description: 'Staff member to transfer to',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	{
		name: 'priority',
		description: 'Set ticket priority',
		options: [
			{
				name: 'level',
				description: 'Priority level',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{ name: 'Low', value: 'low' },
					{ name: 'Normal', value: 'normal' },
					{ name: 'High', value: 'high' },
					{ name: 'Urgent', value: 'urgent' },
				],
			},
		],
	},
	{
		name: 'status',
		description: 'Set ticket status',
		options: [
			{
				name: 'status',
				description: 'New status',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{ name: 'Open', value: 'open' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Waiting on User', value: 'waiting_user' },
					{ name: 'Waiting on Staff', value: 'waiting_staff' },
					{ name: 'Escalated', value: 'escalated' },
					{ name: 'Resolved', value: 'resolved' },
				],
			},
		],
	},
	{
		name: 'add',
		description: 'Add a user to this ticket',
		options: [
			{
				name: 'user',
				description: 'User to add',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	{
		name: 'remove',
		description: 'Remove a user from this ticket',
		options: [
			{
				name: 'user',
				description: 'User to remove',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
]

export async function registerCommandsForAllGuilds(client: Client<true>): Promise<void> {
	const commandCount = commands.length
	let registered = 0

	for (const guild of client.guilds.cache.values()) {
		try {
			await guild.commands.set(commands)
			registered++
		} catch (err) {
			console.error(`Failed to register commands for guild ${guild.id}:`, err)
		}
	}

	console.log(`Registered ${commandCount} commands in ${registered}/${client.guilds.cache.size} guilds`)
}

export async function registerCommandsForGuild(
	client: Client<true>,
	guildId: string,
): Promise<void> {
	const guild = client.guilds.cache.get(guildId)
	if (!guild) return

	try {
		await guild.commands.set(commands)
	} catch (err) {
		console.error(`Failed to register commands for guild ${guildId}:`, err)
	}
}
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/commands/registry.ts
git commit -m "feat: add slash command definitions and registration"
```

---

### Task 14: Commands — close and reopen

**Files:**
- Create: `apps/bot/src/commands/close.ts`
- Create: `apps/bot/src/commands/reopen.ts`

- [ ] **Step 1: Create `apps/bot/src/commands/close.ts`**

```typescript
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { closeTicket, ensureUser, getStaffRoleDiscordIds, resolveTicketByChannelId } from '../services/ticket.js'
import { buildAndStoreTranscript } from '../services/transcript.js'
import { writeAuditLog } from '../services/audit.js'
import { ticketClosedEmbed, transcriptSummaryEmbed } from '../utils/embeds.js'
import { lockTicketChannel } from '../utils/permissions.js'
import { eq } from 'drizzle-orm'
import { categories, guildSettings } from '@ticketbot/db'

export async function handleClose(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'This ticket is already closed.', ephemeral: true })
		return
	}

	await interaction.deferReply()

	const reason = interaction.options.getString('reason') ?? undefined
	const closerId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	await closeTicket(db, ticket.ticketId, closerId, reason)
	await buildAndStoreTranscript(db, ticket.ticketId, ticket.guildId)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const channel = interaction.channel as TextChannel
	await lockTicketChannel(channel, ticket.creatorDiscordId, staffRoleIds)

	const embed = ticketClosedEmbed({
		ticketNumber: ticket.ticketNumber,
		closerTag: interaction.user.toString(),
		reason,
	})
	await interaction.editReply({ embeds: [embed] })

	const settings = await db
		.select({ transcriptChannelId: guildSettings.transcriptChannelId })
		.from(guildSettings)
		.where(eq(guildSettings.guildId, ticket.guildId))
		.limit(1)

	const transcriptChannelId = settings[0]?.transcriptChannelId
	if (transcriptChannelId) {
		try {
			const transcriptChannel = await interaction.guild?.channels.fetch(transcriptChannelId)
			if (transcriptChannel?.isTextBased()) {
				const category = await db
					.select({ name: categories.name })
					.from(categories)
					.where(eq(categories.id, ticket.categoryId))
					.limit(1)

				const summary = transcriptSummaryEmbed({
					ticketNumber: ticket.ticketNumber,
					messageCount: 0,
					participantCount: 0,
					durationSeconds: 0,
					categoryName: category[0]?.name ?? 'Unknown',
				})
				await transcriptChannel.send({ embeds: [summary] })
			}
		} catch {
			// Transcript channel unavailable
		}
	}

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.closed',
		metadata: { reason, closedById: closerId },
	})
}
```

- [ ] **Step 2: Create `apps/bot/src/commands/reopen.ts`**

```typescript
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { reopenTicket, getStaffRoleDiscordIds, resolveTicketByChannelId } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { ticketReopenedEmbed } from '../utils/embeds.js'
import { unlockTicketChannel } from '../utils/permissions.js'

export async function handleReopen(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	if (ticket.status !== 'closed') {
		await interaction.reply({ content: 'This ticket is not closed.', ephemeral: true })
		return
	}

	await interaction.deferReply()

	await reopenTicket(db, ticket.ticketId)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const channel = interaction.channel as TextChannel
	await unlockTicketChannel(channel, ticket.creatorDiscordId, staffRoleIds)

	const embed = ticketReopenedEmbed({
		ticketNumber: ticket.ticketNumber,
		reopenerTag: interaction.user.toString(),
	})
	await interaction.editReply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.reopened',
	})
}
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/commands/close.ts apps/bot/src/commands/reopen.ts
git commit -m "feat: add /close and /reopen slash commands"
```

---

### Task 15: Commands — claim, unclaim, transfer

**Files:**
- Create: `apps/bot/src/commands/claim.ts`
- Create: `apps/bot/src/commands/unclaim.ts`
- Create: `apps/bot/src/commands/transfer.ts`

- [ ] **Step 1: Create `apps/bot/src/commands/claim.ts`**

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { claimTicket, ensureUser, resolveTicketByChannelId } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { claimEmbed } from '../utils/embeds.js'

export async function handleClaim(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'Cannot claim a closed ticket.', ephemeral: true })
		return
	}

	const userId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	await claimTicket(db, ticket.ticketId, userId)

	const embed = claimEmbed(interaction.user.toString(), 'claimed')
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.claimed',
	})
}
```

- [ ] **Step 2: Create `apps/bot/src/commands/unclaim.ts`**

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { unclaimTicket, resolveTicketByChannelId, ensureUser } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { claimEmbed } from '../utils/embeds.js'

export async function handleUnclaim(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'Cannot unclaim a closed ticket.', ephemeral: true })
		return
	}

	const userId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	if (ticket.assignedToId !== userId) {
		await interaction.reply({ content: 'You are not assigned to this ticket.', ephemeral: true })
		return
	}

	await unclaimTicket(db, ticket.ticketId)

	const embed = claimEmbed(interaction.user.toString(), 'unclaimed')
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.unclaimed',
	})
}
```

- [ ] **Step 3: Create `apps/bot/src/commands/transfer.ts`**

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { transferTicket, ensureUser, resolveTicketByChannelId, getStaffRoleDiscordIds } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { transferEmbed } from '../utils/embeds.js'

export async function handleTransfer(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'Cannot transfer a closed ticket.', ephemeral: true })
		return
	}

	const targetUser = interaction.options.getUser('user', true)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const targetMember = await interaction.guild?.members.fetch(targetUser.id)
	const isTargetStaff = targetMember
		? staffRoleIds.some((roleId) => targetMember.roles.cache.has(roleId))
		: false

	if (!isTargetStaff) {
		await interaction.reply({
			content: 'Target user does not have staff access to this category.',
			ephemeral: true,
		})
		return
	}

	const newAssigneeId = await ensureUser(
		db,
		targetUser.id,
		targetUser.username,
		targetUser.displayName,
		targetUser.avatarURL() ?? undefined,
	)

	const oldAssigneeId = ticket.assignedToId
	await transferTicket(db, ticket.ticketId, newAssigneeId)

	const embed = transferEmbed(interaction.user.toString(), targetUser.toString())
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.reassigned',
		metadata: { fromId: oldAssigneeId, toId: newAssigneeId },
	})
}
```

- [ ] **Step 4: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/commands/claim.ts apps/bot/src/commands/unclaim.ts apps/bot/src/commands/transfer.ts
git commit -m "feat: add /claim, /unclaim, /transfer slash commands"
```

---

### Task 16: Commands — priority, status

**Files:**
- Create: `apps/bot/src/commands/priority.ts`
- Create: `apps/bot/src/commands/status.ts`

- [ ] **Step 1: Create `apps/bot/src/commands/priority.ts`**

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { updateTicketPriority, resolveTicketByChannelId } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { statusChangeEmbed } from '../utils/embeds.js'

export async function handlePriority(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'Cannot change priority of a closed ticket.', ephemeral: true })
		return
	}

	const newPriority = interaction.options.getString('level', true)
	const oldPriority = ticket.priority

	await updateTicketPriority(db, ticket.ticketId, newPriority)

	const embed = statusChangeEmbed({
		field: 'Priority',
		oldValue: oldPriority,
		newValue: newPriority,
		changerTag: interaction.user.toString(),
	})
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.status_changed',
		metadata: { field: 'priority', old: oldPriority, new: newPriority },
	})
}
```

- [ ] **Step 2: Create `apps/bot/src/commands/status.ts`**

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { updateTicketStatus, resolveTicketByChannelId } from '../services/ticket.js'
import { writeAuditLog } from '../services/audit.js'
import { statusChangeEmbed } from '../utils/embeds.js'

export async function handleStatus(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	if (ticket.status === 'closed') {
		await interaction.reply({ content: 'Cannot change status of a closed ticket. Use /reopen first.', ephemeral: true })
		return
	}

	const newStatus = interaction.options.getString('status', true)
	const oldStatus = ticket.status

	if (newStatus === oldStatus) {
		await interaction.reply({ content: `Ticket is already ${newStatus}.`, ephemeral: true })
		return
	}

	await updateTicketStatus(db, ticket.ticketId, newStatus)

	const embed = statusChangeEmbed({
		field: 'Status',
		oldValue: oldStatus,
		newValue: newStatus,
		changerTag: interaction.user.toString(),
	})
	await interaction.reply({ embeds: [embed] })

	await writeAuditLog(db, {
		guildId: ticket.guildId,
		ticketId: ticket.ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.status_changed',
		metadata: { field: 'status', old: oldStatus, new: newStatus },
	})
}
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/commands/priority.ts apps/bot/src/commands/status.ts
git commit -m "feat: add /priority and /status slash commands"
```

---

### Task 17: Commands — add, remove

**Files:**
- Create: `apps/bot/src/commands/add.ts`
- Create: `apps/bot/src/commands/remove.ts`

- [ ] **Step 1: Create `apps/bot/src/commands/add.ts`**

```typescript
import { PermissionFlagsBits, type ChatInputCommandInteraction, type TextChannel } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { resolveTicketByChannelId } from '../services/ticket.js'
import { userAddRemoveEmbed } from '../utils/embeds.js'

export async function handleAdd(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	const targetUser = interaction.options.getUser('user', true)
	const channel = interaction.channel as TextChannel

	await channel.permissionOverwrites.edit(targetUser.id, {
		ViewChannel: true,
		SendMessages: true,
		ReadMessageHistory: true,
		AttachFiles: true,
	})

	const embed = userAddRemoveEmbed(interaction.user.toString(), targetUser.toString(), 'added')
	await interaction.reply({ embeds: [embed] })
}
```

- [ ] **Step 2: Create `apps/bot/src/commands/remove.ts`**

```typescript
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { resolveTicketByChannelId } from '../services/ticket.js'
import { userAddRemoveEmbed } from '../utils/embeds.js'

export async function handleRemove(
	db: Database,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const ticket = await resolveTicketByChannelId(db, interaction.channelId)
	if (!ticket) {
		await interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true })
		return
	}

	const targetUser = interaction.options.getUser('user', true)

	if (targetUser.id === ticket.creatorDiscordId) {
		await interaction.reply({
			content: 'Cannot remove the ticket creator.',
			ephemeral: true,
		})
		return
	}

	const channel = interaction.channel as TextChannel
	await channel.permissionOverwrites.delete(targetUser.id)

	const embed = userAddRemoveEmbed(interaction.user.toString(), targetUser.toString(), 'removed')
	await interaction.reply({ embeds: [embed] })
}
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/commands/add.ts apps/bot/src/commands/remove.ts
git commit -m "feat: add /add and /remove slash commands"
```

---

### Task 18: Interactions — panel-button and form-modal

**Files:**
- Create: `apps/bot/src/interactions/panel-button.ts`
- Create: `apps/bot/src/interactions/form-modal.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p /data/github/ticket-bot/apps/bot/src/interactions`

- [ ] **Step 2: Create `apps/bot/src/interactions/panel-button.ts`**

```typescript
import {
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	type ButtonInteraction,
} from 'discord.js'
import { and, eq } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { categories, formFields, forms, panelButtons } from '@ticketbot/db'
import {
	checkMaxOpen,
	checkRateLimit,
	createTicket,
	ensureUser,
	getStaffRoleDiscordIds,
} from '../services/ticket.js'
import { resolveGuildId } from '../services/guild.js'
import { writeAuditLog } from '../services/audit.js'
import { ticketWelcomeEmbed } from '../utils/embeds.js'
import { buildTicketChannelOptions } from '../utils/permissions.js'

export async function handlePanelButton(
	db: Database,
	interaction: ButtonInteraction,
): Promise<void> {
	const buttonId = Number(interaction.customId.replace('panel_button_', ''))
	if (Number.isNaN(buttonId)) return

	const button = await db
		.select({ categoryId: panelButtons.categoryId })
		.from(panelButtons)
		.where(eq(panelButtons.id, buttonId))
		.limit(1)

	const btn = button[0]
	if (!btn) {
		await interaction.reply({ content: 'This button is no longer active.', ephemeral: true })
		return
	}

	const category = await db
		.select({
			id: categories.id,
			name: categories.name,
			isEnabled: categories.isEnabled,
			maxOpenPerUser: categories.maxOpenPerUser,
		})
		.from(categories)
		.where(eq(categories.id, btn.categoryId))
		.limit(1)

	const cat = category[0]
	if (!cat || !cat.isEnabled) {
		await interaction.reply({ content: 'This category is currently disabled.', ephemeral: true })
		return
	}

	if (!interaction.guild) return

	const guildId = await resolveGuildId(db, interaction.guild.id)
	if (!guildId) return

	const rateCheck = await checkRateLimit(db, guildId, interaction.user.id)
	if (!rateCheck.allowed) {
		await interaction.reply({
			content: `Please wait ${rateCheck.retryAfterSeconds} seconds before creating another ticket.`,
			ephemeral: true,
		})
		return
	}

	const userId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	const maxCheck = await checkMaxOpen(db, userId, cat.id)
	if (!maxCheck.allowed) {
		await interaction.reply({
			content: `You already have ${maxCheck.current}/${maxCheck.max} open tickets in this category.`,
			ephemeral: true,
		})
		return
	}

	const form = await db
		.select({ id: forms.id })
		.from(forms)
		.where(eq(forms.categoryId, cat.id))
		.limit(1)

	if (form[0]) {
		const fields = await db
			.select({
				id: formFields.id,
				label: formFields.label,
				fieldType: formFields.fieldType,
				placeholder: formFields.placeholder,
				isRequired: formFields.isRequired,
				minLength: formFields.minLength,
				maxLength: formFields.maxLength,
			})
			.from(formFields)
			.where(eq(formFields.formId, form[0].id))
			.orderBy(formFields.position)

		const modal = new ModalBuilder()
			.setCustomId(`ticket_form_${cat.id}`)
			.setTitle(`New Ticket — ${cat.name}`)

		for (const field of fields.slice(0, 5)) {
			const style =
				field.fieldType === 'textarea' ? TextInputStyle.Paragraph : TextInputStyle.Short
			const input = new TextInputBuilder()
				.setCustomId(`field_${field.id}`)
				.setLabel(field.label)
				.setStyle(style)
				.setRequired(field.isRequired)

			if (field.placeholder) input.setPlaceholder(field.placeholder)
			if (field.minLength) input.setMinLength(field.minLength)
			if (field.maxLength) input.setMaxLength(field.maxLength)

			modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
		}

		await interaction.showModal(modal)
		return
	}

	await interaction.deferReply({ ephemeral: true })

	const staffRoleIds = await getStaffRoleDiscordIds(db, cat.id)
	const channelOptions = buildTicketChannelOptions({
		guild: interaction.guild,
		channelName: `ticket-${interaction.user.username}`,
		creatorId: interaction.user.id,
		staffRoleIds,
	})

	const channel = await interaction.guild.channels.create(channelOptions)

	const { ticketId, ticketNumber } = await createTicket(db, {
		guildId,
		categoryId: cat.id,
		channelId: channel.id,
		creatorId: userId,
		creatorDiscordId: interaction.user.id,
	})

	const embed = ticketWelcomeEmbed({
		ticketNumber,
		categoryName: cat.name,
		creatorTag: interaction.user.toString(),
	})
	await channel.send({ embeds: [embed] })

	await interaction.editReply({ content: `Ticket created: ${channel.toString()}` })

	await writeAuditLog(db, {
		guildId,
		ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.created',
		metadata: { categoryId: cat.id, ticketNumber },
	})
}
```

- [ ] **Step 3: Create `apps/bot/src/interactions/form-modal.ts`**

```typescript
import type { ModalSubmitInteraction } from 'discord.js'
import { eq } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { categories, formFields, forms } from '@ticketbot/db'
import {
	createTicket,
	ensureUser,
	getStaffRoleDiscordIds,
} from '../services/ticket.js'
import { resolveGuildId } from '../services/guild.js'
import { writeAuditLog } from '../services/audit.js'
import { ticketWelcomeEmbed } from '../utils/embeds.js'
import { buildTicketChannelOptions } from '../utils/permissions.js'

export async function handleFormModal(
	db: Database,
	interaction: ModalSubmitInteraction,
): Promise<void> {
	const categoryId = Number(interaction.customId.replace('ticket_form_', ''))
	if (Number.isNaN(categoryId)) return

	if (!interaction.guild) return

	await interaction.deferReply({ ephemeral: true })

	const guildId = await resolveGuildId(db, interaction.guild.id)
	if (!guildId) return

	const category = await db
		.select({ id: categories.id, name: categories.name })
		.from(categories)
		.where(eq(categories.id, categoryId))
		.limit(1)

	const cat = category[0]
	if (!cat) return

	const userId = await ensureUser(
		db,
		interaction.user.id,
		interaction.user.username,
		interaction.user.displayName,
		interaction.user.avatarURL() ?? undefined,
	)

	const form = await db
		.select({ id: forms.id })
		.from(forms)
		.where(eq(forms.categoryId, cat.id))
		.limit(1)

	const formResponses: Array<{ fieldId: number; value: string; label: string }> = []

	if (form[0]) {
		const fields = await db
			.select({ id: formFields.id, label: formFields.label })
			.from(formFields)
			.where(eq(formFields.formId, form[0].id))
			.orderBy(formFields.position)

		for (const field of fields) {
			const value = interaction.fields.getTextInputValue(`field_${field.id}`)
			formResponses.push({ fieldId: field.id, value, label: field.label })
		}
	}

	const staffRoleIds = await getStaffRoleDiscordIds(db, cat.id)
	const channelOptions = buildTicketChannelOptions({
		guild: interaction.guild,
		channelName: `ticket-${interaction.user.username}`,
		creatorId: interaction.user.id,
		staffRoleIds,
	})

	const channel = await interaction.guild.channels.create(channelOptions)

	const { ticketId, ticketNumber } = await createTicket(db, {
		guildId,
		categoryId: cat.id,
		channelId: channel.id,
		creatorId: userId,
		creatorDiscordId: interaction.user.id,
		formResponses: formResponses.map((r) => ({ fieldId: r.fieldId, value: r.value })),
	})

	const embed = ticketWelcomeEmbed({
		ticketNumber,
		categoryName: cat.name,
		creatorTag: interaction.user.toString(),
		formResponses: formResponses.map((r) => ({ label: r.label, value: r.value })),
	})
	await channel.send({ embeds: [embed] })

	await interaction.editReply({ content: `Ticket created: ${channel.toString()}` })

	await writeAuditLog(db, {
		guildId,
		ticketId,
		actorDiscordId: interaction.user.id,
		actorType: 'user',
		action: 'ticket.created',
		metadata: { categoryId: cat.id, ticketNumber },
	})
}
```

- [ ] **Step 4: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/interactions/
git commit -m "feat: add panel button and form modal interaction handlers"
```

---

### Task 19: Events — interaction-create (router)

**Files:**
- Create: `apps/bot/src/events/interaction-create.ts`

- [ ] **Step 1: Create `apps/bot/src/events/interaction-create.ts`**

```typescript
import type { Interaction } from 'discord.js'
import type { Database } from '@ticketbot/db'
import { handlePanelButton } from '../interactions/panel-button.js'
import { handleFormModal } from '../interactions/form-modal.js'
import { handleClose } from '../commands/close.js'
import { handleReopen } from '../commands/reopen.js'
import { handleClaim } from '../commands/claim.js'
import { handleUnclaim } from '../commands/unclaim.js'
import { handleTransfer } from '../commands/transfer.js'
import { handlePriority } from '../commands/priority.js'
import { handleStatus } from '../commands/status.js'
import { handleAdd } from '../commands/add.js'
import { handleRemove } from '../commands/remove.js'

const commandHandlers: Record<
	string,
	(db: Database, interaction: any) => Promise<void>
> = {
	close: handleClose,
	reopen: handleReopen,
	claim: handleClaim,
	unclaim: handleUnclaim,
	transfer: handleTransfer,
	priority: handlePriority,
	status: handleStatus,
	add: handleAdd,
	remove: handleRemove,
}

export async function handleInteractionCreate(
	db: Database,
	interaction: Interaction,
): Promise<void> {
	try {
		if (interaction.isButton() && interaction.customId.startsWith('panel_button_')) {
			await handlePanelButton(db, interaction)
			return
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
			await handleFormModal(db, interaction)
			return
		}

		if (interaction.isChatInputCommand()) {
			const handler = commandHandlers[interaction.commandName]
			if (handler) {
				await handler(db, interaction)
			}
			return
		}
	} catch (err) {
		console.error('Interaction handler error:', err)

		if (interaction.isRepliable()) {
			const content = 'An error occurred while processing this interaction.'
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content }).catch(() => {})
			} else {
				await interaction.reply({ content, ephemeral: true }).catch(() => {})
			}
		}
	}
}
```

- [ ] **Step 2: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/events/interaction-create.ts
git commit -m "feat: add interaction router (commands, buttons, modals)"
```

---

### Task 20: Bot — Rewrite index.ts (entrypoint)

**Files:**
- Modify: `apps/bot/src/index.ts`

- [ ] **Step 1: Replace `apps/bot/src/index.ts`**

Read the existing file first. Replace it with:

```typescript
import { Client, GatewayIntentBits } from 'discord.js'
import { createDb } from '@ticketbot/db'
import { handleReady } from './events/ready.js'
import { handleGuildCreate } from './events/guild-create.js'
import { handleGuildDelete } from './events/guild-delete.js'
import { handleGuildMemberAdd } from './events/guild-member-add.js'
import { handleGuildMemberRemove } from './events/guild-member-remove.js'
import { handleRoleCreate } from './events/role-create.js'
import { handleRoleUpdate } from './events/role-update.js'
import { handleRoleDelete } from './events/role-delete.js'
import { handleInteractionCreate } from './events/interaction-create.js'
import { handleMessageCreate } from './events/message-create.js'
import { registerCommandsForAllGuilds, registerCommandsForGuild } from './commands/registry.js'
import { runCleanupJob } from './services/transcript.js'

const db = createDb(process.env.DATABASE_URL ?? '')

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildModeration,
	],
})

client.once('ready', async (c) => {
	handleReady(c)
	await registerCommandsForAllGuilds(c)

	setInterval(async () => {
		try {
			const result = await runCleanupJob(db, client)
			if (result.purged > 0) {
				console.log(`Cleanup: purged ${result.purged} transcripts, deleted ${result.channelsDeleted} channels`)
			}
		} catch (err) {
			console.error('Cleanup job error:', err)
		}
	}, 60 * 60 * 1000)
})

client.on('guildCreate', async (guild) => {
	try {
		await handleGuildCreate(db, guild)
		await registerCommandsForGuild(client as Client<true>, guild.id)
	} catch (err) {
		console.error(`guildCreate error for ${guild.id}:`, err)
	}
})

client.on('guildDelete', (guild) => {
	handleGuildDelete(guild)
})

client.on('guildMemberAdd', async (member) => {
	try {
		await handleGuildMemberAdd(db, member)
	} catch (err) {
		console.error(`guildMemberAdd error:`, err)
	}
})

client.on('guildMemberRemove', async (member) => {
	try {
		await handleGuildMemberRemove(db, member)
	} catch (err) {
		console.error(`guildMemberRemove error:`, err)
	}
})

client.on('roleCreate', async (role) => {
	try {
		await handleRoleCreate(db, role)
	} catch (err) {
		console.error(`roleCreate error:`, err)
	}
})

client.on('roleUpdate', async (oldRole, newRole) => {
	try {
		await handleRoleUpdate(db, oldRole, newRole)
	} catch (err) {
		console.error(`roleUpdate error:`, err)
	}
})

client.on('roleDelete', async (role) => {
	try {
		await handleRoleDelete(db, role)
	} catch (err) {
		console.error(`roleDelete error:`, err)
	}
})

client.on('interactionCreate', async (interaction) => {
	await handleInteractionCreate(db, interaction)
})

client.on('messageCreate', async (message) => {
	try {
		await handleMessageCreate(db, message)
	} catch (err) {
		console.error(`messageCreate error:`, err)
	}
})

client.login(process.env.DISCORD_TOKEN).catch((err) => {
	console.error('Failed to login:', err)
	process.exit(1)
})
```

- [ ] **Step 2: Commit**

```bash
cd /data/github/ticket-bot && git add apps/bot/src/index.ts
git commit -m "feat: rewrite bot entrypoint with all event handlers and cleanup job"
```

---

### Task 21: Type-check, lint, final verification

- [ ] **Step 1: Type-check all packages**

Run: `cd /data/github/ticket-bot/packages/shared && npx tsc --noEmit && cd ../db && npx tsc --noEmit && cd ../auth && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Type-check all apps**

Run: `cd /data/github/ticket-bot/apps/bot && npx tsc --noEmit && cd ../server && npx tsc --noEmit && cd ../dashboard && npx tsc --noEmit`

Expected: No errors. The bot app may have type errors that need fixing — the implementer should resolve them.

- [ ] **Step 3: Lint**

Run: `cd /data/github/ticket-bot && bunx biome check .`

Expected: No errors. Fix any lint/format issues with `bunx biome check --write .`

- [ ] **Step 4: Commit any fixes**

```bash
cd /data/github/ticket-bot && git add -A
git commit -m "fix: resolve type-check and lint issues for Phase 4 bot"
```

Only commit if there were actual fixes. Skip if clean.
