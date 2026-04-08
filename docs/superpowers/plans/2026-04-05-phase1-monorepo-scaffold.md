# Phase 1: Monorepo Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a Bazel hybrid monorepo with three apps (bot, server, dashboard) and three shared packages (db, shared, auth), fully wired with Docker, TypeScript, and dev tooling.

**Architecture:** Hybrid Bazel monorepo — `rules_ts` for shared packages (`ts_project`), custom Bazel rules wrapping native build tools for apps. pnpm for package management (required by `rules_js`), Bun for runtime. Docker multi-stage builds with layer caching for dev and prod.

**Tech Stack:** Bazel 7.4.1, rules_js v2, rules_ts v3, rules_oci v2, pnpm, Bun 1.x, TypeScript (strict), Biome, Docker, PostgreSQL 16, Next.js 15, ElysiaJS, discord.js v15, Drizzle ORM

**Spec deviation:** The spec listed `bun.lock` + Bun workspaces. `rules_js` requires `pnpm-lock.yaml` via `npm_translate_lock`, so we use pnpm as the package manager and Bun only as the runtime. pnpm-workspace.yaml replaces Bun workspaces. All `bun run` scripts still work — pnpm manages deps, Bun executes.

---

## File Map

### Root config files
- Create: `MODULE.bazel` — bzlmod root declaring rules_js, rules_ts, rules_oci, npm deps
- Create: `WORKSPACE.bazel` — empty file (bzlmod mode)
- Create: `BUILD.bazel` — root build file with workspace aliases
- Create: `.bazelrc` — build flags, CI remote cache config
- Create: `.bazelversion` — pins Bazel 7.4.1
- Create: `.bazelignore` — ignores node_modules, .git, dist
- Create: `package.json` — root workspace scripts (dev, build, test, db commands)
- Create: `pnpm-workspace.yaml` — declares packages/* and apps/* as workspace members
- Create: `.npmrc` — pnpm config (node-linker=hoisted for Bazel compat)
- Create: `tsconfig.base.json` — shared strict TypeScript config
- Create: `biome.json` — linting and formatting rules
- Create: `.env.example` — all env vars documented
- Create: `.gitignore` — bazel-*, node_modules, .next, dist, .env
- Create: `.dockerignore` — same exclusions for Docker context

### Shared packages
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/BUILD.bazel` — ts_project
- Create: `packages/shared/src/index.ts` — barrel export
- Create: `packages/shared/src/types/index.ts` — placeholder shared types
- Create: `packages/shared/src/constants/index.ts` — placeholder constants
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/BUILD.bazel` — ts_project
- Create: `packages/db/drizzle.config.ts` — Drizzle Kit config
- Create: `packages/db/src/index.ts` — barrel export
- Create: `packages/db/src/client.ts` — Drizzle client factory
- Create: `packages/db/src/schema/index.ts` — placeholder schema (one example table)
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/BUILD.bazel` — ts_project
- Create: `packages/auth/src/index.ts` — barrel export
- Create: `packages/auth/src/server.ts` — placeholder server auth setup
- Create: `packages/auth/src/client.ts` — placeholder client auth setup

### Apps
- Create: `apps/bot/package.json`
- Create: `apps/bot/tsconfig.json`
- Create: `apps/bot/BUILD.bazel` — custom bun_bundle
- Create: `apps/bot/src/index.ts` — minimal bot entrypoint (connects + logs ready)
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/BUILD.bazel` — custom bun_bundle
- Create: `apps/server/src/index.ts` — minimal Elysia server (health endpoint + swagger)
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/BUILD.bazel` — custom next_build
- Create: `apps/dashboard/next.config.ts`
- Create: `apps/dashboard/tailwind.config.ts`
- Create: `apps/dashboard/postcss.config.js`
- Create: `apps/dashboard/src/app/layout.tsx` — root layout with glass theme globals
- Create: `apps/dashboard/src/app/page.tsx` — placeholder home page
- Create: `apps/dashboard/src/app/globals.css` — Tailwind directives + glass CSS variables
- Create: `apps/dashboard/src/lib/utils.ts` — cn() utility for shadcn

### Bazel custom rules
- Create: `tools/BUILD.bazel` — empty
- Create: `tools/bun_build.bzl` — bun_bundle rule definition
- Create: `tools/next_build.bzl` — next_build rule definition

### Docker
- Create: `Dockerfile.bot` — multi-stage (base, deps, dev, build, prod)
- Create: `Dockerfile.server` — multi-stage (base, deps, dev, build, prod)
- Create: `Dockerfile.dashboard` — multi-stage (base, deps, dev, build, prod) with Next.js standalone
- Create: `docker-compose.yml` — postgres, bot, server, dashboard, drizzle-studio (dev)
- Create: `docker-compose.prod.yml` — postgres, bot, server, dashboard (prod images)

---

### Task 1: Root Bazel Configuration

**Files:**
- Create: `MODULE.bazel`
- Create: `WORKSPACE.bazel`
- Create: `BUILD.bazel`
- Create: `.bazelrc`
- Create: `.bazelversion`
- Create: `.bazelignore`

- [ ] **Step 1: Create `.bazelversion`**

```
7.4.1
```

- [ ] **Step 2: Create empty `WORKSPACE.bazel`**

```python
# Intentionally empty — using bzlmod (MODULE.bazel) for dependency management.
```

- [ ] **Step 3: Create `.bazelrc`**

```
# Enable bzlmod
build --enable_bzlmod

# TypeScript strict
build --@aspect_rules_ts//ts:skipLibCheck=always

# Convenience
build --symlink_prefix=dist/

# Test output
test --test_output=errors
test --test_verbose_timeout_warnings

# CI config
build:ci --remote_cache=grpcs://your-cache-endpoint
build:ci --google_default_credentials
build:ci --noremote_upload_local_results

# Performance
build --experimental_isolated_extension_usages
startup --host_jvm_args=-Xmx4g
```

- [ ] **Step 4: Create `.bazelignore`**

```
node_modules
.git
dist
.next
.env
```

- [ ] **Step 5: Create `MODULE.bazel`**

```python
module(
    name = "ticketbot",
    version = "0.0.1",
)

bazel_dep(name = "aspect_rules_js", version = "2.3.7")
bazel_dep(name = "aspect_rules_ts", version = "3.5.1")
bazel_dep(name = "aspect_bazel_lib", version = "2.9.4")
bazel_dep(name = "rules_oci", version = "2.2.0")
bazel_dep(name = "bazel_skylib", version = "1.7.1")

# Node.js toolchain
bazel_dep(name = "rules_nodejs", version = "6.3.2")

node = use_extension("@rules_nodejs//nodejs:extensions.bzl", "node")
node.toolchain(node_version = "22.12.0")

# npm dependencies from pnpm lock
npm = use_extension("@aspect_rules_js//npm:extensions.bzl", "npm")
npm.npm_translate_lock(
    name = "npm",
    pnpm_lock = "//:pnpm-lock.yaml",
    verify_node_modules_ignored = "//:.bazelignore",
)
use_repo(npm, "npm")

# TypeScript compiler
rules_ts_ext = use_extension("@aspect_rules_ts//ts:extensions.bzl", "ext")
rules_ts_ext.deps()
use_repo(rules_ts_ext, "npm_typescript")
```

- [ ] **Step 6: Create root `BUILD.bazel`**

```python
load("@aspect_rules_js//js:defs.bzl", "js_library")
load("@npm//:defs.bzl", "npm_link_all_packages")

npm_link_all_packages(name = "node_modules")

exports_files(
    [
        "tsconfig.base.json",
        "package.json",
        "pnpm-lock.yaml",
        ".bazelignore",
    ],
    visibility = ["//visibility:public"],
)
```

- [ ] **Step 7: Verify Bazel parses config**

Run: `bazel --version`
Expected: `bazel 7.4.1` (or install prompt if not present)

Note: Full `bazel build` won't work yet — we haven't created the pnpm-lock.yaml or package targets. This step just verifies the Bazel config files parse without errors.

- [ ] **Step 8: Commit**

```bash
git add MODULE.bazel WORKSPACE.bazel BUILD.bazel .bazelrc .bazelversion .bazelignore
git commit -m "feat: add root Bazel configuration with bzlmod"
```

---

### Task 2: Root Package Configuration

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `.env.example`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 2: Create `.npmrc`**

```ini
node-linker=hoisted
shamefully-hoist=true
strict-peer-dependencies=false
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "@ticketbot/root",
  "private": true,
  "scripts": {
    "dev": "docker compose up",
    "dev:bot": "bun --watch apps/bot/src/index.ts",
    "dev:server": "bun --watch apps/server/src/index.ts",
    "dev:dashboard": "pnpm --filter @ticketbot/dashboard dev",
    "db:generate": "pnpm --filter @ticketbot/db drizzle-kit generate",
    "db:migrate": "pnpm --filter @ticketbot/db drizzle-kit migrate",
    "db:studio": "pnpm --filter @ticketbot/db drizzle-kit studio",
    "build": "bazel build //...",
    "test": "bazel test //...",
    "lint": "bunx biome check .",
    "lint:fix": "bunx biome check --write .",
    "format": "bunx biome format --write ."
  },
  "engines": {
    "node": ">=22"
  },
  "packageManager": "pnpm@9.15.4"
}
```

- [ ] **Step 4: Create `.env.example`**

```env
# Postgres
DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5432/ticketbot

# Discord
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_PERMISSIONS=8

# Better Auth
BETTER_AUTH_SECRET=change-me-to-a-random-string
BETTER_AUTH_URL=http://localhost:3001

# Polar.sh
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=

# Super Admin (comma-separated emails)
SUPER_ADMIN=admin@example.com

# App URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Node
NODE_ENV=development
```

- [ ] **Step 5: Create `.gitignore`**

```
# Bazel
bazel-*
dist/

# Dependencies
node_modules/

# Next.js
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build output
dist/
*.tsbuildinfo

# Drizzle
drizzle/meta/

# Docker volumes
pgdata/
```

- [ ] **Step 6: Create `.dockerignore`**

```
node_modules
.git
.gitignore
bazel-*
dist/
.next
.env
.env.local
*.md
.idea
.vscode
.DS_Store
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml .npmrc .gitignore .dockerignore .env.example
git commit -m "feat: add root package config with pnpm workspaces"
```

---

### Task 3: TypeScript and Biome Configuration

**Files:**
- Create: `tsconfig.base.json`
- Create: `biome.json`

- [ ] **Step 1: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true
  },
  "exclude": ["node_modules", "dist", "bazel-*"]
}
```

- [ ] **Step 2: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "bazel-*",
      ".next",
      "*.gen.ts",
      "pnpm-lock.yaml"
    ]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add tsconfig.base.json biome.json
git commit -m "feat: add TypeScript base config and Biome linting"
```

---

### Task 4: `@ticketbot/shared` Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/BUILD.bazel`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/constants/index.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@ticketbot/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./constants": "./src/constants/index.ts"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/src/types/index.ts`**

```typescript
export type TicketStatus =
  | 'open'
  | 'pending'
  | 'waiting_user'
  | 'waiting_staff'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'archived'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type PlanTier = 'free' | 'premium'
```

- [ ] **Step 4: Create `packages/shared/src/constants/index.ts`**

```typescript
export const TICKET_RATE_LIMIT = {
  maxPerMinute: 1,
  windowMs: 60_000,
} as const

export const TRANSCRIPT_RETENTION = {
  free: 1 * 24 * 60 * 60 * 1000, // 1 day in ms
  premium: Infinity,
} as const

export const PREMIUM_PRICE = {
  base: 800, // $8.00 in cents
  additionalServer: 300, // $3.00 in cents
  includedServers: 3,
} as const
```

- [ ] **Step 5: Create `packages/shared/src/index.ts`**

```typescript
export * from './types/index.js'
export * from './constants/index.js'
```

- [ ] **Step 6: Create `packages/shared/BUILD.bazel`**

```python
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

ts_project(
    name = "shared",
    srcs = glob(["src/**/*.ts"]),
    composite = True,
    declaration = True,
    declaration_map = True,
    source_map = True,
    tsconfig = "tsconfig.json",
    visibility = ["//visibility:public"],
    deps = [
        "//:node_modules",
    ],
)
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/shared/
git commit -m "feat: add @ticketbot/shared package with types and constants"
```

---

### Task 5: `@ticketbot/db` Package

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/BUILD.bazel`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@ticketbot/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.39.0",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0",
    "@ticketbot/shared": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

- [ ] **Step 3: Create `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
```

- [ ] **Step 4: Create `packages/db/src/schema/index.ts`**

This is a placeholder schema with one table to verify the pipeline works. Real schema comes in Phase 2.

```typescript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const guilds = pgTable('guilds', {
  id: serial('id').primaryKey(),
  discordId: text('discord_id').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Guild = typeof guilds.$inferSelect
export type NewGuild = typeof guilds.$inferInsert
```

- [ ] **Step 5: Create `packages/db/src/client.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

export function createDb(connectionString: string) {
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDb>
```

- [ ] **Step 6: Create `packages/db/src/index.ts`**

```typescript
export { createDb, type Database } from './client.js'
export * from './schema/index.js'
```

- [ ] **Step 7: Create `packages/db/BUILD.bazel`**

```python
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

ts_project(
    name = "db",
    srcs = glob(["src/**/*.ts"]),
    composite = True,
    declaration = True,
    declaration_map = True,
    source_map = True,
    tsconfig = "tsconfig.json",
    visibility = ["//visibility:public"],
    deps = [
        "//:node_modules",
        "//packages/shared",
    ],
)
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/
git commit -m "feat: add @ticketbot/db package with Drizzle ORM and placeholder schema"
```

---

### Task 6: `@ticketbot/auth` Package

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/BUILD.bazel`
- Create: `packages/auth/src/index.ts`
- Create: `packages/auth/src/server.ts`
- Create: `packages/auth/src/client.ts`

- [ ] **Step 1: Create `packages/auth/package.json`**

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
    "better-auth": "^1.2.0"
  },
  "devDependencies": {
    "@ticketbot/db": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `packages/auth/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" },
    { "path": "../db" }
  ]
}
```

- [ ] **Step 3: Create `packages/auth/src/server.ts`**

Placeholder — real auth config comes in Phase 3.

```typescript
import { betterAuth } from 'better-auth'

export function createAuth(databaseUrl: string, baseUrl: string) {
  return betterAuth({
    database: {
      type: 'postgres',
      url: databaseUrl,
    },
    baseURL: baseUrl,
    socialProviders: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
```

- [ ] **Step 4: Create `packages/auth/src/client.ts`**

```typescript
import { createAuthClient } from 'better-auth/client'

export function createBrowserAuthClient(baseUrl: string) {
  return createAuthClient({
    baseURL: baseUrl,
  })
}

export type AuthClient = ReturnType<typeof createBrowserAuthClient>
```

- [ ] **Step 5: Create `packages/auth/src/index.ts`**

```typescript
export { createAuth, type Auth } from './server.js'
export { createBrowserAuthClient, type AuthClient } from './client.js'
```

- [ ] **Step 6: Create `packages/auth/BUILD.bazel`**

```python
load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

ts_project(
    name = "auth",
    srcs = glob(["src/**/*.ts"]),
    composite = True,
    declaration = True,
    declaration_map = True,
    source_map = True,
    tsconfig = "tsconfig.json",
    visibility = ["//visibility:public"],
    deps = [
        "//:node_modules",
        "//packages/shared",
        "//packages/db",
    ],
)
```

- [ ] **Step 7: Commit**

```bash
git add packages/auth/
git commit -m "feat: add @ticketbot/auth package with Better Auth placeholder"
```

---

### Task 7: `@ticketbot/bot` App Scaffold

**Files:**
- Create: `apps/bot/package.json`
- Create: `apps/bot/tsconfig.json`
- Create: `apps/bot/BUILD.bazel`
- Create: `apps/bot/src/index.ts`

- [ ] **Step 1: Create `apps/bot/package.json`**

```json
{
  "name": "@ticketbot/bot",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --target=bun --outdir=dist",
    "start": "bun dist/index.js"
  },
  "dependencies": {
    "discord.js": "^15.0.0",
    "@ticketbot/db": "workspace:*",
    "@ticketbot/shared": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `apps/bot/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["bun-types"]
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/shared" },
    { "path": "../../packages/db" }
  ]
}
```

- [ ] **Step 3: Create `apps/bot/src/index.ts`**

Minimal entrypoint that connects to Discord and logs ready. Real bot logic comes in Phase 4.

```typescript
import { Client, GatewayIntentBits } from 'discord.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once('ready', (c) => {
  console.log(`Bot ready as ${c.user.tag} — serving ${c.guilds.cache.size} guilds`)
})

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('Failed to login:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Create `apps/bot/BUILD.bazel`**

```python
load("//tools:bun_build.bzl", "bun_bundle")

bun_bundle(
    name = "bot",
    entry_point = "src/index.ts",
    srcs = glob(["src/**/*.ts"]),
    deps = [
        "//:node_modules",
        "//packages/shared",
        "//packages/db",
    ],
)
```

- [ ] **Step 5: Commit**

```bash
git add apps/bot/
git commit -m "feat: add @ticketbot/bot app scaffold with discord.js v15"
```

---

### Task 8: `@ticketbot/server` App Scaffold

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/BUILD.bazel`
- Create: `apps/server/src/index.ts`

- [ ] **Step 1: Create `apps/server/package.json`**

```json
{
  "name": "@ticketbot/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --target=bun --outdir=dist",
    "start": "bun dist/index.js"
  },
  "dependencies": {
    "elysia": "^1.3.0",
    "@elysiajs/swagger": "^1.3.0",
    "@elysiajs/cors": "^1.3.0",
    "@ticketbot/db": "workspace:*",
    "@ticketbot/shared": "workspace:*",
    "@ticketbot/auth": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["bun-types"]
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/shared" },
    { "path": "../../packages/db" },
    { "path": "../../packages/auth" }
  ]
}
```

- [ ] **Step 3: Create `apps/server/src/index.ts`**

Minimal Elysia server with health check and Swagger. Real routes come in Phase 5.

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'

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
  .use(cors())
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(3001)

console.log(`Server running at http://localhost:${app.server?.port}`)

export type App = typeof app
```

- [ ] **Step 4: Create `apps/server/BUILD.bazel`**

```python
load("//tools:bun_build.bzl", "bun_bundle")

bun_bundle(
    name = "server",
    entry_point = "src/index.ts",
    srcs = glob(["src/**/*.ts"]),
    deps = [
        "//:node_modules",
        "//packages/shared",
        "//packages/db",
        "//packages/auth",
    ],
)
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/
git commit -m "feat: add @ticketbot/server app scaffold with Elysia + Swagger"
```

---

### Task 9: `@ticketbot/dashboard` App Scaffold

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/BUILD.bazel`
- Create: `apps/dashboard/next.config.ts`
- Create: `apps/dashboard/tailwind.config.ts`
- Create: `apps/dashboard/postcss.config.js`
- Create: `apps/dashboard/src/app/globals.css`
- Create: `apps/dashboard/src/app/layout.tsx`
- Create: `apps/dashboard/src/app/page.tsx`
- Create: `apps/dashboard/src/lib/utils.ts`

- [ ] **Step 1: Create `apps/dashboard/package.json`**

```json
{
  "name": "@ticketbot/dashboard",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "biome check src/"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@elysiajs/eden": "^1.3.0",
    "@ticketbot/shared": "workspace:*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "lucide-react": "^0.474.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.5.0"
  }
}
```

- [ ] **Step 2: Create `apps/dashboard/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "jsx": "preserve",
    "declaration": false,
    "declarationMap": false,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/dashboard/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@ticketbot/shared'],
}

export default nextConfig
```

- [ ] **Step 4: Create `apps/dashboard/postcss.config.js`**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 5: Create `apps/dashboard/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          50: 'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
          300: 'rgba(255, 255, 255, 0.3)',
        },
        surface: {
          DEFAULT: 'rgba(15, 15, 20, 1)',
          raised: 'rgba(25, 25, 35, 1)',
          overlay: 'rgba(30, 30, 45, 0.8)',
        },
        accent: {
          DEFAULT: 'rgba(99, 102, 241, 1)',
          glow: 'rgba(99, 102, 241, 0.3)',
        },
      },
      backdropBlur: {
        glass: '20px',
      },
      borderRadius: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        glow: '0 0 20px rgba(99, 102, 241, 0.3)',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 6: Create `apps/dashboard/src/app/globals.css`**

```css
@import 'tailwindcss';

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

body {
  background: var(--color-surface);
  color: rgba(255, 255, 255, 0.9);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
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

- [ ] **Step 7: Create `apps/dashboard/src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 8: Create `apps/dashboard/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TicketBot Dashboard',
  description: 'Manage your Discord ticket bot',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 9: Create `apps/dashboard/src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="glass-panel p-12 text-center max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">TicketBot</h1>
        <p className="text-glass-300 text-sm mb-6">
          Discord ticket management, reimagined.
        </p>
        <button type="button" className="glass-button">
          Sign in with Discord
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 10: Create `apps/dashboard/BUILD.bazel`**

```python
load("//tools:next_build.bzl", "next_build")

next_build(
    name = "dashboard",
    srcs = glob(["src/**/*.ts", "src/**/*.tsx", "src/**/*.css"]) + [
        "next.config.ts",
        "tailwind.config.ts",
        "postcss.config.js",
        "tsconfig.json",
        "package.json",
    ],
    deps = [
        "//:node_modules",
        "//packages/shared",
    ],
)
```

- [ ] **Step 11: Commit**

```bash
git add apps/dashboard/
git commit -m "feat: add @ticketbot/dashboard app scaffold with Next.js 15 + glass UI"
```

---

### Task 10: Custom Bazel Rules

**Files:**
- Create: `tools/BUILD.bazel`
- Create: `tools/bun_build.bzl`
- Create: `tools/next_build.bzl`

- [ ] **Step 1: Create `tools/BUILD.bazel`**

```python
# Empty — this package holds .bzl rule definitions only.
```

- [ ] **Step 2: Create `tools/bun_build.bzl`**

```python
"""Custom Bazel rule to bundle TypeScript apps using Bun."""

def _bun_bundle_impl(ctx):
    out = ctx.actions.declare_file(ctx.attr.name + "/index.js")

    inputs = depset(
        direct = ctx.files.srcs,
        transitive = [dep[DefaultInfo].files for dep in ctx.attr.deps],
    )

    ctx.actions.run_shell(
        inputs = inputs,
        outputs = [out],
        command = """
            set -euo pipefail
            cd {workspace}
            bun build {entry} --target=bun --outfile={out} --minify
        """.format(
            workspace = ctx.label.workspace_root or ".",
            entry = ctx.file.entry_point.path,
            out = out.path,
        ),
        mnemonic = "BunBundle",
        progress_message = "Bundling %s with Bun" % ctx.label,
        use_default_shell_env = True,
    )

    return [DefaultInfo(
        files = depset([out]),
        runfiles = ctx.runfiles(files = [out]),
    )]

bun_bundle = rule(
    implementation = _bun_bundle_impl,
    attrs = {
        "entry_point": attr.label(
            allow_single_file = [".ts", ".js"],
            mandatory = True,
        ),
        "srcs": attr.label_list(
            allow_files = [".ts", ".js", ".json"],
        ),
        "deps": attr.label_list(),
    },
)
```

- [ ] **Step 3: Create `tools/next_build.bzl`**

```python
"""Custom Bazel rule to build Next.js apps."""

def _next_build_impl(ctx):
    out_dir = ctx.actions.declare_directory(ctx.attr.name + "_next_out")

    inputs = depset(
        direct = ctx.files.srcs,
        transitive = [dep[DefaultInfo].files for dep in ctx.attr.deps],
    )

    ctx.actions.run_shell(
        inputs = inputs,
        outputs = [out_dir],
        command = """
            set -euo pipefail
            cd {package_dir}
            NODE_ENV=production npx next build
            cp -r .next/standalone/* {out}/ 2>/dev/null || true
            cp -r .next/static {out}/.next/static 2>/dev/null || true
            cp -r public {out}/public 2>/dev/null || true
        """.format(
            package_dir = ctx.label.package,
            out = out_dir.path,
        ),
        mnemonic = "NextBuild",
        progress_message = "Building Next.js app %s" % ctx.label,
        use_default_shell_env = True,
    )

    return [DefaultInfo(
        files = depset([out_dir]),
        runfiles = ctx.runfiles(files = [out_dir]),
    )]

next_build = rule(
    implementation = _next_build_impl,
    attrs = {
        "srcs": attr.label_list(
            allow_files = True,
        ),
        "deps": attr.label_list(),
    },
)
```

- [ ] **Step 4: Commit**

```bash
git add tools/
git commit -m "feat: add custom Bazel rules for Bun bundling and Next.js builds"
```

---

### Task 11: Dockerfiles

**Files:**
- Create: `Dockerfile.bot`
- Create: `Dockerfile.server`
- Create: `Dockerfile.dashboard`

- [ ] **Step 1: Create `Dockerfile.bot`**

```dockerfile
# ---- base ----
FROM oven/bun:1-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/auth/package.json packages/auth/
COPY apps/bot/package.json apps/bot/
RUN bun install --frozen-lockfile

# ---- dev ----
FROM deps AS dev
COPY packages/ packages/
COPY apps/bot/ apps/bot/
CMD ["bun", "--watch", "apps/bot/src/index.ts"]

# ---- build ----
FROM deps AS build
COPY packages/ packages/
COPY apps/bot/ apps/bot/
RUN bun build apps/bot/src/index.ts --target=bun --outdir=dist --minify

# ---- prod ----
FROM oven/bun:1-alpine AS prod
WORKDIR /app
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
COPY --from=build /app/dist/ ./
CMD ["bun", "index.js"]
```

- [ ] **Step 2: Create `Dockerfile.server`**

```dockerfile
# ---- base ----
FROM oven/bun:1-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/auth/package.json packages/auth/
COPY apps/server/package.json apps/server/
RUN bun install --frozen-lockfile

# ---- dev ----
FROM deps AS dev
COPY packages/ packages/
COPY apps/server/ apps/server/
EXPOSE 3001
CMD ["bun", "--watch", "apps/server/src/index.ts"]

# ---- build ----
FROM deps AS build
COPY packages/ packages/
COPY apps/server/ apps/server/
RUN bun build apps/server/src/index.ts --target=bun --outdir=dist --minify

# ---- prod ----
FROM oven/bun:1-alpine AS prod
WORKDIR /app
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
COPY --from=build /app/dist/ ./
EXPOSE 3001
CMD ["bun", "index.js"]
```

- [ ] **Step 3: Create `Dockerfile.dashboard`**

```dockerfile
# ---- base ----
FROM oven/bun:1-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/dashboard/package.json apps/dashboard/
RUN bun install --frozen-lockfile

# ---- dev ----
FROM deps AS dev
COPY packages/ packages/
COPY apps/dashboard/ apps/dashboard/
EXPOSE 3000
CMD ["bunx", "next", "dev", "--port", "3000"]

# ---- build ----
FROM deps AS build
COPY packages/ packages/
COPY apps/dashboard/ apps/dashboard/
ENV NEXT_TELEMETRY_DISABLED=1
RUN bunx next build

# ---- prod ----
FROM oven/bun:1-alpine AS prod
WORKDIR /app
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./.next/static
COPY --from=build /app/apps/dashboard/public ./public
EXPOSE 3000
CMD ["bun", "server.js"]
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile.bot Dockerfile.server Dockerfile.dashboard
git commit -m "feat: add multi-stage Dockerfiles for bot, server, and dashboard"
```

---

### Task 12: Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ticketbot
      POSTGRES_USER: ticketbot
      POSTGRES_PASSWORD: ticketbot
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ticketbot"]
      interval: 5s
      timeout: 5s
      retries: 5

  bot:
    build:
      context: .
      dockerfile: Dockerfile.bot
      target: dev
    volumes:
      - ./apps/bot/src:/app/apps/bot/src
      - ./packages:/app/packages
    depends_on:
      postgres:
        condition: service_healthy
    env_file: .env
    restart: unless-stopped

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
      target: dev
    ports:
      - "3001:3001"
    volumes:
      - ./apps/server/src:/app/apps/server/src
      - ./packages:/app/packages
    depends_on:
      postgres:
        condition: service_healthy
    env_file: .env
    restart: unless-stopped

  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
      target: dev
    ports:
      - "3000:3000"
    volumes:
      - ./apps/dashboard/src:/app/apps/dashboard/src
      - ./packages:/app/packages
    depends_on:
      - server
    env_file: .env
    restart: unless-stopped

  drizzle-studio:
    build:
      context: .
      dockerfile: Dockerfile.server
      target: dev
    command: ["bunx", "drizzle-kit", "studio", "--port", "4983", "--host", "0.0.0.0"]
    ports:
      - "4983:4983"
    depends_on:
      postgres:
        condition: service_healthy
    env_file: .env

volumes:
  pgdata:
```

- [ ] **Step 2: Create `docker-compose.prod.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-ticketbot}
      POSTGRES_USER: ${POSTGRES_USER:-ticketbot}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-ticketbot}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  bot:
    build:
      context: .
      dockerfile: Dockerfile.bot
      target: prod
    depends_on:
      postgres:
        condition: service_healthy
    env_file: .env
    restart: always

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
      target: prod
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    env_file: .env
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3

  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
      target: prod
    ports:
      - "3000:3000"
    depends_on:
      - server
    env_file: .env
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  pgdata:
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.prod.yml
git commit -m "feat: add Docker Compose for local dev and production"
```

---

### Task 13: Install Dependencies and Generate Lock File

**Files:**
- Modify: `pnpm-lock.yaml` (generated)

- [ ] **Step 1: Install pnpm if not present**

Run: `npm install -g pnpm@9.15.4`
Expected: pnpm installed globally

- [ ] **Step 2: Install all workspace dependencies**

Run: `pnpm install`
Expected: `pnpm-lock.yaml` generated, all packages resolved, `node_modules` created

- [ ] **Step 3: Verify workspace packages are linked**

Run: `pnpm ls --filter @ticketbot/server --depth 0`
Expected: Shows `@ticketbot/db`, `@ticketbot/shared`, `@ticketbot/auth` as linked workspace deps

- [ ] **Step 4: Commit lock file**

```bash
git add pnpm-lock.yaml
git commit -m "chore: generate pnpm lockfile"
```

---

### Task 14: Verify TypeScript Compiles Across All Packages

- [ ] **Step 1: Type-check shared package**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Type-check db package**

Run: `cd packages/db && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Type-check auth package**

Run: `cd packages/auth && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Type-check bot app**

Run: `cd apps/bot && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Type-check server app**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Type-check dashboard app**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: No errors (may need `next-env.d.ts` — run `npx next build` first if types are missing)

- [ ] **Step 7: Run Biome lint**

Run: `bunx biome check .`
Expected: No errors (fix any formatting issues with `bunx biome check --write .`)

- [ ] **Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript and lint errors across workspace"
```

---

### Task 15: Verify Docker Compose Dev Stack

- [ ] **Step 1: Copy env file**

Run: `cp .env.example .env`

Then edit `.env` to set a dummy `DISCORD_TOKEN` (bot won't actually connect, but the container should start). For local testing without Discord, you can comment out the bot service.

- [ ] **Step 2: Build and start postgres only**

Run: `docker compose up postgres -d`
Expected: Postgres container starts, healthcheck passes

- [ ] **Step 3: Run migrations**

Run: `DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5432/ticketbot pnpm --filter @ticketbot/db drizzle-kit generate`

Then: `DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5432/ticketbot pnpm --filter @ticketbot/db drizzle-kit migrate`

Expected: Migration files generated in `packages/db/migrations/`, applied to postgres

- [ ] **Step 4: Start server**

Run: `docker compose up server -d`
Expected: Server container starts, `http://localhost:3001/health` returns `{"status":"ok","timestamp":"..."}`

- [ ] **Step 5: Verify Swagger docs**

Run: `curl http://localhost:3001/swagger/json`
Expected: OpenAPI JSON spec returned with `/health` endpoint documented

- [ ] **Step 6: Start dashboard**

Run: `docker compose up dashboard -d`
Expected: Dashboard container starts, `http://localhost:3000` shows the glass-styled landing page

- [ ] **Step 7: Verify Drizzle Studio**

Run: `docker compose up drizzle-studio -d`
Expected: Drizzle Studio accessible at `http://localhost:4983`, shows the `guilds` table

- [ ] **Step 8: Tear down**

Run: `docker compose down`
Expected: All containers stopped and removed

- [ ] **Step 9: Commit any Docker/config fixes**

```bash
git add -A
git commit -m "fix: Docker compose stack verified and working"
```

---

### Task 16: Final Verification and Cleanup

- [ ] **Step 1: Verify full `docker compose up` works**

Run: `docker compose up --build`
Expected: All services start (postgres, server, dashboard, drizzle-studio). Bot will fail to connect without a real Discord token — that's expected.

- [ ] **Step 2: Verify Biome formatting is clean**

Run: `bunx biome check --write .`
Expected: All files formatted, no remaining issues

- [ ] **Step 3: Verify git status is clean**

Run: `git status`
Expected: Clean working tree, or only expected untracked files

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 monorepo scaffold complete

- Bazel hybrid monorepo with bzlmod (rules_js, rules_ts, rules_oci)
- Three shared packages: @ticketbot/shared, @ticketbot/db, @ticketbot/auth
- Three apps: @ticketbot/bot (discord.js v15), @ticketbot/server (Elysia), @ticketbot/dashboard (Next.js 15)
- Custom Bazel rules: bun_bundle, next_build
- Multi-stage Dockerfiles with layer caching
- Docker Compose for local dev and production
- TypeScript strict mode, Biome linting, glass UI theme"
```
