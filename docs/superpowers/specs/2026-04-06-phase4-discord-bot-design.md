# Phase 4: Discord Bot Design

## Overview

Build the Discord bot that powers ticket creation, lifecycle management, guild/role/member sync, transcript generation, and audit logging. The bot talks directly to PostgreSQL via `@ticketbot/db` — no API intermediary. It uses discord.js v15 (dev tag) with a modular event/command/service architecture.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interaction model | Hybrid: panel buttons for users, slash commands for staff | Buttons are natural UX for ticket creation; slash commands give staff fast access |
| Channel mode | Channels only (no threads in Phase 4) | Channels are reliable; threads have permission edge cases, better as a future enhancement |
| Staff actions | Full status management (all 8 statuses) | All defined statuses must be usable from Discord to avoid dead-letter states |
| Guild lifecycle | Upsert + full role/member sync on join | RBAC data ready immediately when admin logs into dashboard |
| Transcript source | DB-sourced from `ticket_messages` | More reliable than Discord API fetch; survives message purges and rate limits |
| Close behavior | Lock channel (remove send permissions), don't delete | Deleting creates ghost states; locked channels allow reopen and serve as read-only archive |
| Channel cleanup | Retention job deletes channels after `transcriptRetentionDays` | Channel and data disappear together, no orphaned records |
| Rate limiting | Cooldown + max open tickets, values from `guild_settings` | Two independent checks: time-based and count-based |
| Config layer | `packages/shared/src/config/plan-defaults.ts` | Single source of truth for tier defaults; no magic numbers in bot code |
| Audit logging | All bot mutations logged | Every bot action writes to `audit_logs` for full traceability |
| DB access | Direct via `@ticketbot/db` | Trusted service, no need for API auth overhead |

## Schema Changes

### Modified: `guild_settings` table (`packages/db/src/schema/guilds.ts`)

| Column | Type | Default | Constraints | Notes |
|--------|------|---------|-------------|-------|
| `transcriptRetentionDays` | integer | 5 | NOT NULL | Free=5, Premium=180. Read by bot for transcript expiry and channel cleanup |
| `ticketCooldownSeconds` | integer | 60 | NOT NULL | Minimum seconds between ticket creates per user per guild |

No other schema changes. Migration regenerated from scratch (pre-production).

## Config Layer (`packages/shared/src/config/plan-defaults.ts`)

```typescript
export const PLAN_DEFAULTS = {
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

All consumers import from `@ticketbot/shared`. When a guild is created or changes plan tier, services read `PLAN_DEFAULTS[tier]` to set `guild_settings` values. At runtime, the bot reads from `guild_settings` only — never branches on plan tier.

## Event Handlers

### `ready`

Log bot tag and guild count.

### `guildCreate`

1. Upsert `guilds` row (discordId, name, iconUrl)
2. Upsert `guild_settings` row with defaults from `PLAN_DEFAULTS[guild.planTier]`
3. Fetch all guild roles via Discord API, upsert into `discord_roles`
4. Fetch all guild members via `guild.members.fetch()`, cross-reference Discord IDs with `users.discordId` — for any match, upsert `guild_members`

### `guildDelete`

No-op. Data stays in the database — the guild can re-add the bot later.

### `guildMemberAdd`

Cross-reference the joining member's Discord ID with `users.discordId`. If found, upsert `guild_members` row.

### `guildMemberRemove`

Delete `guild_members` row for that user+guild (if exists).

### `roleCreate`

Insert new row into `discord_roles` for the guild.

### `roleUpdate`

Update `name`, `color`, `position` in `discord_roles`.

### `roleDelete`

Delete from `discord_roles`. Cascades delete `role_permissions` and `guild_member_roles`.

### `interactionCreate`

Route to the appropriate handler:
- Button interaction with panel button custom ID → `panel-button` handler
- Modal submit → `form-modal` handler
- Slash command → command handler

### `messageCreate`

If the message is in a channel matching `tickets.channelId` for a non-closed ticket (any status except `closed` and `archived`):
1. Upsert user into `users` (by discordId)
2. Insert into `ticket_messages` (content, attachments as JSONB, isStaff based on role check, isInternalNote=false)
3. If this is the first staff response, set `tickets.firstResponseAt`

## Ticket Creation Flow

Triggered by panel button click:

1. Identify `panelButton` from interaction custom ID → get `categoryId`
2. Check category is enabled (`isEnabled = true`)
3. **Rate limit check**: Query `rate_limits` for this user+guild with action `ticket.create`. If `lastActionAt + ticketCooldownSeconds > now()`, reject with cooldown message
4. **Max open check**: Count tickets where `creatorId = user.dbId AND categoryId = category AND status NOT IN ('closed', 'archived')`. If count >= `categories.maxOpenPerUser`, reject
5. If category has a form (`forms` table), show Discord modal with form fields. On modal submit, continue to step 6. If no form, continue directly
6. Atomic ticket creation:
   a. Increment `guilds.ticketCounter`
   b. Generate ticket number: `{guild.ticketPrefix}-{paddedCounter}` (e.g., `TICKET-0042`)
   c. Create private channel in guild. Set permissions: deny @everyone view, allow requester view+send, allow staff roles (from `categoryRoleAccess` where `accessType = 'staff'`) view+send
   d. Insert `tickets` row (guildId, categoryId, ticketNumber, channelId, creatorId, status='open')
   e. Insert `ticket_form_responses` rows if form was filled
   f. Upsert `rate_limits` row (update `lastActionAt`)
7. Send welcome embed in ticket channel: ticket number, category, form responses, status buttons
8. Audit log: `ticket.created` with metadata (categoryId, ticketNumber)

## Slash Commands

All commands except `/reopen` require the invoker to be in a ticket channel (resolved via `tickets.channelId`). Permission checks use `categoryRoleAccess` to verify the invoker has staff access to the ticket's category.

### `/close`

**Args:** `reason?` (string, optional)

1. Set ticket status → `closed`, `closedAt` → now, `closedById` → invoker
2. Generate transcript (see Transcript Generation below)
3. Lock channel: remove send message permission for requester and staff roles, keep view permission
4. Post "ticket closed" embed with reason, closer, and transcript link
5. Audit log: `ticket.closed` with metadata (reason, closedById)

### `/reopen`

**Args:** none (runs inside a closed/locked ticket channel)

1. Verify ticket status is `closed`
2. Set status → `open`, clear `closedAt`/`closedById`, increment `reopenedCount`
3. Restore send permissions for requester and staff roles
4. Post "ticket reopened" embed
5. Audit log: `ticket.reopened`

### `/claim`

**Args:** none

1. Set `assignedToId` → invoker
2. Post embed: "{user} claimed this ticket"
3. Audit log: `ticket.claimed`

### `/unclaim`

**Args:** none

1. Verify invoker is current assignee
2. Clear `assignedToId`
3. Post embed: "{user} unclaimed this ticket"
4. Audit log: `ticket.unclaimed`

### `/transfer`

**Args:** `user` (@mention, required)

1. Verify target user has staff access to this category
2. Set `assignedToId` → target user
3. Post embed: "{user} transferred to {target}"
4. Audit log: `ticket.reassigned` with metadata (fromId, toId)

### `/priority`

**Args:** `level` (choice: low, normal, high, urgent)

1. Update `tickets.priority`
2. Post embed: "Priority changed to {level}"
3. Audit log: `ticket.status_changed` with metadata (field: 'priority', old, new)

### `/status`

**Args:** `status` (choice: open, pending, waiting_user, waiting_staff, escalated, resolved)

1. Update `tickets.status`
2. Post embed: "Status changed to {status}"
3. Audit log: `ticket.status_changed` with metadata (field: 'status', old, new)

Note: `closed` and `archived` are not valid choices — use `/close` for closing. `archived` is a future dashboard-only action.

### `/add`

**Args:** `user` (@mention, required)

1. Add channel permission override: allow target user to view + send in the ticket channel
2. Post embed: "{user} added {target} to the ticket"

### `/remove`

**Args:** `user` (@mention, required)

1. Verify target is not the ticket creator (can't remove the requester)
2. Remove channel permission override for target user
3. Post embed: "{user} removed {target} from the ticket"

## Transcript Generation

Called by `/close`:

1. Query all `ticket_messages` for this ticket, ordered by `createdAt` ascending
2. Build `messages` JSONB array:
   ```json
   [{ "userId": "...", "discordId": "...", "username": "...", "content": "...", "timestamp": "...", "isStaff": true, "attachments": [...] }]
   ```
3. Build `participants` JSONB array:
   ```json
   [{ "userId": "...", "discordId": "...", "username": "...", "messageCount": 5, "isStaff": false }]
   ```
4. Build `metadata` JSONB:
   ```json
   { "duration": 3600, "messageCount": 42, "category": "General Support", "priority": "normal", "closedBy": "..." }
   ```
5. Read `guild_settings.transcriptRetentionDays`
6. Insert into `transcripts` with `expiresAt = now() + transcriptRetentionDays`
7. If `guild_settings.transcriptChannelId` is set, post summary embed there (ticket number, participant count, message count, duration, link to dashboard view)

## Cleanup Job

A `setInterval` on bot startup runs every hour:

1. Find transcripts where `expiresAt < now()`
2. For each expired transcript:
   a. Get the associated ticket
   b. If the ticket's channel still exists in Discord, delete the channel
   c. Delete `ticket_messages` for that ticket
   d. Delete the `transcripts` row
3. Log cleanup results (count of transcripts purged, channels deleted)

The audit log entry for cleanup uses `actorType: 'bot'`.

## Audit Logging

Every bot mutation writes to `audit_logs`:

| Field | Source |
|-------|--------|
| `guildId` | From the ticket's guild |
| `ticketId` | The ticket being acted on (null for non-ticket events) |
| `actorId` | User's DB ID (cross-reference `users.discordId`), null if user not in DB |
| `actorDiscordId` | Always populated from the Discord interaction |
| `actorType` | `'user'` for staff commands, `'bot'` for system actions (cleanup) |
| `action` | One of the `AuditAction` enum values |
| `metadata` | JSONB with context (reason, old/new values, etc.) |

Logged actions from bot: `ticket.created`, `ticket.claimed`, `ticket.unclaimed`, `ticket.reassigned`, `ticket.closed`, `ticket.reopened`, `ticket.escalated`, `ticket.status_changed`, `transcript.viewed`, `transcript.exported`

## Command Registration

On bot startup, slash commands are registered per-guild (not globally) for faster updates during development. A utility function:

1. Build slash command definitions (name, description, options) for all 9 commands
2. Use `client.guilds.cache` to iterate all guilds
3. Call `guild.commands.set(commands)` for each guild
4. On `guildCreate`, register commands for the new guild

Global registration can be switched on for production later.

## Gateway Intents

The bot requires these intents:

| Intent | Reason |
|--------|--------|
| `Guilds` | Guild create/delete events, channel management |
| `GuildMembers` | Member add/remove events for `guild_members` sync |
| `GuildMessages` | Message logging in ticket channels |
| `MessageContent` | Read message content for `ticket_messages` |
| `GuildModeration` | Role create/update/delete events |

Note: `GuildMembers` and `MessageContent` are privileged intents that must be enabled in the Discord Developer Portal.

## Scope Boundaries

### In Phase 4

- Schema changes: 2 columns added to `guild_settings`, migration regenerated
- Config layer: `plan-defaults.ts` in shared package
- All 10 event handlers
- All 9 slash commands with full status management
- Panel button → modal → ticket creation flow
- Real-time message logging to `ticket_messages`
- Transcript generation on close (from DB)
- Transcript retention cleanup job (channels + data)
- Rate limiting (cooldown + max open tickets)
- Audit logging for all bot mutations
- Guild/role/member sync events
- Command registration per-guild

### Deferred

| Feature | Phase |
|---------|-------|
| Thread-mode ticket channels | Future enhancement |
| Auto-close after inactivity | Phase 4.5 or dashboard-triggered |
| Log channel posting (beyond transcripts) | Future enhancement |
| Dashboard-triggered bot actions via API | Phase 5 |
| `archived` status management | Phase 6 (dashboard) |
| Global slash command registration | Production switch |

## File Map

### New files

- `packages/shared/src/config/plan-defaults.ts` — Tier default values
- `apps/bot/src/events/ready.ts` — Ready event handler
- `apps/bot/src/events/guild-create.ts` — Guild join: upsert + sync
- `apps/bot/src/events/guild-delete.ts` — Guild leave: no-op
- `apps/bot/src/events/guild-member-add.ts` — Member join: upsert guild_members
- `apps/bot/src/events/guild-member-remove.ts` — Member leave: delete guild_members
- `apps/bot/src/events/role-create.ts` — Role created: insert discord_roles
- `apps/bot/src/events/role-update.ts` — Role updated: update discord_roles
- `apps/bot/src/events/role-delete.ts` — Role deleted: delete discord_roles
- `apps/bot/src/events/interaction-create.ts` — Route interactions to handlers
- `apps/bot/src/events/message-create.ts` — Log messages in ticket channels
- `apps/bot/src/commands/registry.ts` — Slash command definitions + registration
- `apps/bot/src/commands/close.ts` — Close ticket command
- `apps/bot/src/commands/reopen.ts` — Reopen ticket command
- `apps/bot/src/commands/claim.ts` — Claim ticket command
- `apps/bot/src/commands/unclaim.ts` — Unclaim ticket command
- `apps/bot/src/commands/transfer.ts` — Transfer ticket command
- `apps/bot/src/commands/priority.ts` — Set priority command
- `apps/bot/src/commands/status.ts` — Set status command
- `apps/bot/src/commands/add.ts` — Add user to ticket command
- `apps/bot/src/commands/remove.ts` — Remove user from ticket command
- `apps/bot/src/interactions/panel-button.ts` — Panel button click handler
- `apps/bot/src/interactions/form-modal.ts` — Form modal submit handler
- `apps/bot/src/services/ticket.ts` — Ticket CRUD and lifecycle logic
- `apps/bot/src/services/guild.ts` — Guild upsert, role sync, member sync
- `apps/bot/src/services/transcript.ts` — Build, store, and cleanup transcripts
- `apps/bot/src/services/audit.ts` — Write audit log entries
- `apps/bot/src/utils/permissions.ts` — Discord channel permission helpers
- `apps/bot/src/utils/embeds.ts` — Embed builders for tickets, transcripts, status

### Modified files

- `packages/shared/src/config/index.ts` — Re-export plan-defaults (create if not exists)
- `packages/db/src/schema/guilds.ts` — Add 2 columns to guild_settings
- `packages/db/migrations/` — Regenerated
- `apps/bot/src/index.ts` — Rewrite: client setup, event registration, command registration, cleanup job
- `apps/bot/package.json` — Add `@ticketbot/auth` dependency
