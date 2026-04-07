# Phase 6: Next.js Dashboard — Design Spec

## Overview

A full-featured admin dashboard for the TicketBot platform. Built with Next.js 15 (App Router), it consumes the Phase 5 Elysia API (`/api/*`) via Eden + TanStack Query. The dashboard provides guild-scoped management of tickets, categories, panels, transcripts, roles, audit logs, and API keys, plus account-level billing with premium quota assignment.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15, App Router, client-side rendering for dashboard pages |
| Data fetching | TanStack Query v5 + Eden treaty (type-safe Elysia client) |
| Forms | React Hook Form + Zod validation |
| Components | shadcn/ui (Radix + CVA) restyled to glass morphism theme |
| Toasts | Sonner |
| Icons | Lucide React |
| Styling | Tailwind CSS v4 (existing glass morphism design tokens) |

## Route Structure

```
app/
├── layout.tsx                          # Root: fonts, QueryClientProvider, Sonner
├── page.tsx                            # Landing page (existing)
├── (auth)/
│   ├── layout.tsx                      # Centered minimal layout
│   └── login/page.tsx                  # "Sign in with Discord" button → Better Auth OAuth flow
├── (dashboard)/
│   ├── layout.tsx                      # Top bar (profile, billing link)
│   ├── guilds/page.tsx                 # Guild selector grid
│   ├── billing/page.tsx                # User billing (quota management)
│   └── [guildId]/
│       ├── layout.tsx                  # Sidebar + guild context + permissions
│       ├── page.tsx                    # Redirect to /tickets
│       ├── settings/page.tsx
│       ├── categories/page.tsx
│       ├── panels/
│       │   ├── page.tsx
│       │   └── [panelId]/page.tsx      # Panel editor (embed builder)
│       ├── tickets/
│       │   ├── page.tsx                # List with filters + cursor pagination
│       │   └── [ticketId]/page.tsx     # Detail with messages
│       ├── transcripts/page.tsx
│       ├── roles/page.tsx
│       ├── audit-logs/page.tsx
│       └── api-keys/page.tsx
```

**Route groups:**
- `(auth)` — minimal centered layout for login page. Better Auth handles OAuth callbacks via its own `/api/auth/*` routes on the Elysia server — no callback page needed in Next.js.
- `(dashboard)` — top bar + sidebar layout for authenticated users

**URL pattern:** `/dashboard/[guildId]/tickets` — guild ID in the path for deep-linkable, bookmarkable URLs.

## Layout & Navigation

### Top Bar

```
[Hamburger (mobile)] [Breadcrumb: Guild > Section]     [Plan badge] [Profile dropdown]
```

- **Plan badge**: "Free" or "Premium" pill, links to `/dashboard/billing`
- **Profile dropdown**: avatar + username, links to billing, "Switch guild", logout
- **Breadcrumb**: updates per page (e.g., "Tickets > #142")

### Sidebar

```
[Guild Icon + Name]           ← clickable → /dashboard/guilds
─────────────────
Setup
  ├── Settings                ← admin.manage_settings
  ├── Categories              ← admin.manage_categories
  └── Panels                  ← admin.manage_panels

Support
  ├── Tickets                 ← tickets.view
  └── Transcripts             ← transcripts.view

Admin
  ├── Roles                   ← admin.manage_roles
  ├── Audit Logs              ← admin.view_audit_logs
  └── API Keys                ← admin.manage_api_keys
```

**Permission gating:**
- Links are hidden (not disabled) if the user lacks the required permission
- Groups with zero visible links are hidden entirely
- Mobile: sidebar collapses to hamburger menu in the top bar

### Page-Level Permission Guard

Every guild-scoped page wraps content in `<RequirePermission permission="...">`. If the user lacks the required permission, a "You don't have permission to view this page" state renders instead. Sidebar hiding is UX convenience — the guard is the actual wall.

The server enforces permissions on every API call regardless.

## Data Flow

1. `(dashboard)/layout.tsx` — fetches current user via `GET /api/user/me`, provides `UserContext`. If 401, redirects to login.
2. `[guildId]/layout.tsx` — fetches guild details via `GET /api/guilds/:guildId` and user permissions via `GET /api/guilds/:guildId/permissions` (new endpoint, returns `{ permissions: string[] }`). Provides `GuildContext` + `PermissionContext`.
3. Individual pages use custom query hooks (e.g., `useTickets`, `useCategories`) that call Eden
4. Mutations go through TanStack Query `useMutation` with cache invalidation + sonner toasts
5. `RequirePermission` reads from `PermissionContext` to gate page content

### Caching & Performance

No speculative prefetching. Speed comes from:

- **Route prefetch via `<Link>`** — Next.js automatically prefetches JS bundles for links in the viewport
- **Aggressive caching** — `staleTime: 30_000` (30s fresh), `gcTime: 300_000` (5min in cache). Revisiting a page within 30s serves from cache instantly.
- **Optimistic updates** — Status/priority changes on tickets, enable/disable toggles on categories update the cache immediately. User sees the result before the server responds. Roll back on error.
- **Skeleton loading states** — Every page renders layout structure (table headers, card outlines) immediately while data loads. No blank screens.
- **Targeted invalidation** — Mutations invalidate only affected queries (creating a category doesn't refetch tickets)
- **Small payloads** — Cursor pagination returns max 50 rows. Elysia is same-machine. Fetch time is negligible.
- **Retry with backoff** — TanStack Query retries failed requests 3 times with exponential backoff before showing error state

## Pages

### Guild Selector (`/dashboard/guilds`)

- Grid of guild cards: icon, name, plan badge (free/premium)
- "Refresh from Discord" button calls `POST /api/guilds/refresh`
- Only shows guilds where the user is a member
- Clicking a guild navigates to `/dashboard/[guildId]/tickets`

### Settings (`/[guildId]/settings`)

- **Permission:** `admin.manage_settings`
- Single form with sections:
  - General: locale, timezone
  - Channels: log channel ID, transcript channel ID
  - Tickets: cooldown seconds, auto-close hours, transcript retention days
- One global save button with RHF dirty tracking
- Mutation invalidates guild details cache

### Categories (`/[guildId]/categories`)

- **Permission:** `admin.manage_categories`
- Table: name, emoji, channel mode, max open per user, enabled toggle, position
- Create/edit in a sheet (slide-over panel):
  - Fields: name, description, emoji, channel mode, target channel, max open per user, auto-close hours, position, enabled
  - Role access config: multi-select of guild roles with access type (staff/requester)
- Delete with confirmation dialog
- Optimistic update for enabled toggle

### Panels (`/[guildId]/panels`)

- **Permission:** `admin.manage_panels`
- Table: name, channel, published status, button count
- Panel editor page (`/panels/[panelId]`):
  - Embed builder: title, description, color picker, thumbnail URL, footer text
  - Button list: add/remove/reorder, each linked to a category with label, emoji, style
  - Live preview of the embed as it will appear in Discord
  - Deploy button → `POST .../panels/:panelId/deploy` → success toast

### Tickets (`/[guildId]/tickets`)

- **Permission:** `tickets.view` for reads, `tickets.manage` for actions
- Table: ticket number, subject, status badge, priority badge, assignee, category, created date
- Filters bar: status (multi-select), priority (multi-select), assignee, category
- Cursor-based pagination with Next/Previous buttons
- **Detail page** (`/tickets/[ticketId]`):
  - Header: status, priority, assignee — with action dropdowns to change each
  - Message timeline: chronological list of messages with author avatar, content, timestamp
  - Internal notes distinguished visually (different background)
  - Actions: change status, change priority, assign/reassign — all via mutations with toast feedback
  - Optimistic updates for status/priority changes

### Transcripts (`/[guildId]/transcripts`)

- **Permission:** `transcripts.view`, `transcripts.export` for download
- Table: ticket number, participant count, message count, created date
- Click to view: rendered message list (similar to ticket detail but read-only)
- Export button: dropdown with HTML or JSON download options
- Cursor-based pagination

### Roles (`/[guildId]/roles`)

- **Permission:** `admin.manage_roles`
- Table: role name (with Discord color dot), permission count
- Click row to expand: checkbox grid of all permissions grouped by category
- "Refresh from Discord" button calls role sync endpoint
- Save permissions per role

### Audit Logs (`/[guildId]/audit-logs`)

- **Permission:** `admin.view_audit_logs`
- Table: timestamp, actor (avatar + name), action badge, target description, metadata preview
- Filters: action type (multi-select), actor
- Cursor-based pagination
- Read-only, no mutations

### API Keys (`/[guildId]/api-keys`)

- **Permission:** `admin.manage_api_keys`
- Table: name, prefix (`tk_abc123...`), permissions count, last used, expires, created date
- **Create:** dialog with name input, permission checkboxes (from `API_KEY_PERMISSIONS`), expiry select (never/30/90/365 days). On success, shows the full key once with copy button and "this won't be shown again" warning.
- **Rotate:** confirmation dialog. On success, shows new key once with copy button.
- **Revoke:** confirmation dialog with destructive (red) styling. Hard delete.

### Billing (`/dashboard/billing`)

Account-level page, not guild-scoped.

**Billing model:**
- $8/month base subscription → 3 premium guild slots (from `PREMIUM_PRICE.includedServers`)
- $3/month per additional guild beyond 3 (from `PREMIUM_PRICE.additionalServer`)
- User assigns slots to guilds where they have the admin role
- Guild inherits `PLAN_DEFAULTS.premium` limits from having an attached premium user
- Removing attachment or lapsing subscription → immediate drop to free tier

**State machine:**

| State | Display |
|-------|---------|
| No subscription (`polarCustomerId` null) | "Subscribe" CTA → Polar checkout link |
| Active subscription | Quota display ("2/3 premium servers"), assigned guild list with "Remove" per guild, "Add server" select from eligible guilds (free + user has admin), "Manage subscription" → Polar portal |
| Canceled / past_due | Status warning banner + "Resubscribe" CTA → Polar portal |

**Error handling:**
- `polarCustomerId` null → clean "Subscribe" state, not an error
- Polar API unreachable → show last known subscription data with "Couldn't verify subscription status" warning banner
- Subscription lapsed but guilds still marked premium → server-side webhook/cron handles the downgrade, dashboard reflects current `planTier` state

**New API endpoints required:**
- `GET /api/billing` — subscription status, quota (total/used), list of assigned guilds with names
- `POST /api/billing/assign` — assign premium to a guild. Validates: user has admin in guild, quota available. Updates guild `planTier` to `'premium'`.
- `POST /api/billing/unassign` — remove premium from a guild. Immediate `planTier` drop to `'free'`.

These are user-scoped (session auth), not guild-scoped.

## Shared Patterns

### API Client

Single Eden treaty client in `lib/api.ts`, pointed at the Elysia server URL. Auth cookies forwarded automatically (same-origin requests).

### Query Hooks

```
hooks/
├── use-guilds.ts          # useGuilds(), useGuildDetails(guildId)
├── use-categories.ts      # useCategories(guildId), useCreateCategory(), ...
├── use-tickets.ts         # useTickets(guildId, filters), useTicketDetail(guildId, ticketId), ...
├── use-transcripts.ts     # useTranscripts(guildId), useExportTranscript(), ...
├── use-panels.ts          # usePanels(guildId), useDeployPanel(), ...
├── use-roles.ts           # useRoles(guildId), useUpdatePermissions(), ...
├── use-audit-logs.ts      # useAuditLogs(guildId, filters)
├── use-api-keys.ts        # useApiKeys(guildId), useCreateApiKey(), ...
├── use-billing.ts         # useBilling(), useAssignPremium(), useUnassignPremium()
└── use-user.ts            # useCurrentUser()
```

Each file exports query hooks (read) and mutation hooks (write). Mutation hooks handle:
- Cache invalidation of related queries
- Sonner toast on success/error
- Optimistic updates where applicable (status toggles, priority changes)

### Form Pattern

- Zod schema per form (e.g., `categorySchema`, `settingsSchema`)
- RHF `useForm({ resolver: zodResolver(schema) })`
- shadcn/ui `<Form>` + `<FormField>` components
- Submit handler calls the relevant mutation hook

### Error Handling

- **Global query error handler:** unexpected failures show error toasts via sonner
- **API error parsing:** `{ error, message }` response shape parsed into human-readable toast messages
- **401 handling:** redirect to login page (session expired)
- **Permission denied:** `<RequirePermission>` component shows unauthorized state
- **Network failures:** TanStack Query retries 3x with exponential backoff, then shows error state with retry button

## Component Library

shadcn/ui components installed into `src/components/ui/`, restyled to match the existing glass morphism theme:

**Required components:** Button, Input, Select, Textarea, Dialog, Sheet, Table, Tabs, Badge, Card, Dropdown Menu, Command (for combobox/search), Form, Label, Checkbox, Switch, Separator, Skeleton, Tooltip, Popover, Avatar

**Custom components (built on shadcn primitives):**
- `DataTable` — reusable table with column definitions, sorting indicators, empty state
- `CursorPagination` — Next/Previous buttons with page info, disabled states
- `RequirePermission` — permission gate wrapper reading from PermissionContext
- `FilterBar` — composable filter row with multi-select badges
- `ConfirmDialog` — confirmation dialog with destructive variant for deletes/revokes
- `PageHeader` — consistent page title + description + action buttons layout
- `EmptyState` — icon + message + optional CTA for empty tables/lists
- `StatusBadge` — colored badge for ticket status values
- `PriorityBadge` — colored badge for ticket priority values

## File Map

```
apps/dashboard/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/...
│   └── (dashboard)/...
├── components/
│   ├── ui/                    # shadcn/ui components (restyled)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── top-bar.tsx
│   │   ├── breadcrumb.tsx
│   │   └── mobile-nav.tsx
│   ├── data-table.tsx
│   ├── cursor-pagination.tsx
│   ├── require-permission.tsx
│   ├── filter-bar.tsx
│   ├── confirm-dialog.tsx
│   ├── page-header.tsx
│   ├── empty-state.tsx
│   ├── status-badge.tsx
│   └── priority-badge.tsx
├── hooks/
│   ├── use-guilds.ts
│   ├── use-categories.ts
│   ├── use-tickets.ts
│   ├── use-transcripts.ts
│   ├── use-panels.ts
│   ├── use-roles.ts
│   ├── use-audit-logs.ts
│   ├── use-api-keys.ts
│   ├── use-billing.ts
│   └── use-user.ts
├── lib/
│   ├── api.ts                 # Eden treaty client
│   ├── utils.ts               # cn() utility (existing)
│   └── query-client.ts        # TanStack Query client config
├── providers/
│   ├── query-provider.tsx     # QueryClientProvider wrapper
│   ├── user-provider.tsx      # UserContext
│   ├── guild-provider.tsx     # GuildContext
│   └── permission-provider.tsx # PermissionContext
└── schemas/
    ├── category.ts            # Zod schemas for category forms
    ├── settings.ts
    ├── panel.ts
    ├── api-key.ts
    └── ticket.ts
```

Also modifies:
- `apps/server/src/routes/api/billing.ts` (new) — billing endpoints (GET /api/billing, POST /api/billing/assign, POST /api/billing/unassign)
- `apps/server/src/services/billing.ts` (new) — billing service layer (quota resolution, assign/unassign logic)
- `apps/server/src/routes/api/guilds.ts` (modified) — add `GET /api/guilds/:guildId/permissions` endpoint returning `{ permissions: string[] }` for the authenticated user
- `apps/server/src/index.ts` — mount billing routes
