# Phase 1: Monorepo Scaffold Design

## Overview

Bootstrap a Bazel monorepo for a multi-tenant Discord ticket bot platform with three apps (bot, API server, dashboard) and three shared packages (db, shared, auth). The scaffold establishes the build system, Docker configuration, TypeScript setup, and developer experience for all subsequent phases.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo tool | Bazel (hybrid) | `rules_ts` for shared packages, custom rules wrapping native tools for apps |
| Bzlmod | Yes | Modern Bazel dependency management, replaces WORKSPACE |
| Runtime | Bun 1.x (`oven/bun:1`) | Fast runtime, native TS support, workspace resolution |
| Package scope | `@ticketbot` | `@ticketbot/db`, `@ticketbot/shared`, `@ticketbot/auth`, etc. |
| Postgres | 16-alpine | Via Docker Compose, Drizzle Studio for GUI |
| Discord.js | v15 | Latest version |
| ElysiaJS | Latest + Eden Treaty + `@elysiajs/swagger` | End-to-end type safety + auto OpenAPI |
| Next.js | 15, App Router | Server components, server actions |
| UI | shadcn/ui + Tailwind + glass customization | Apple glass aesthetic |
| Auth | Better Auth + Discord OAuth2 | With RBAC synced to Discord roles |
| Payments | Polar.sh | Free + Premium ($8/mo, 3 servers, $3/additional) |
| Database ORM | Drizzle | Schema-first, type-safe |
| Transcripts | Postgres JSONB | 1-day free, permanent premium |
| Rate limiting | Postgres-based | No Redis dependency |
| Linting | Biome | Single tool for lint + format |
| Super admin | `/internal/*` route in dashboard | `SUPER_ADMIN` env var email allowlist |

## Spec Deviation: pnpm instead of Bun workspaces

`rules_js` requires `pnpm-lock.yaml` via its `npm_translate_lock` extension. The original design specified Bun workspaces + `bun.lock`, but this is incompatible with Bazel's JS rules. The implementation uses **pnpm as the package manager** (for lock file + workspace resolution) and **Bun as the runtime** (for executing apps). All `bun run`/`bun --watch` scripts still work — pnpm manages deps, Bun executes.

## Repository Structure

```
ticket-bot/
├── MODULE.bazel
├── MODULE.bazel.lock
├── .bazelrc
├── .bazelversion
├── BUILD.bazel
├── WORKSPACE.bazel              # empty (bzlmod mode)
├── package.json                 # Bun workspace root
├── bun.lock
├── tsconfig.base.json
├── biome.json
├── docker-compose.yml           # local dev
├── docker-compose.prod.yml      # prod-like
├── Dockerfile.bot
├── Dockerfile.server
├── Dockerfile.dashboard
├── .env.example
│
├── packages/
│   ├── db/                      # @ticketbot/db
│   │   ├── BUILD.bazel          # ts_project
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── schema/
│   │       ├── migrations/
│   │       └── client.ts
│   │
│   ├── shared/                  # @ticketbot/shared
│   │   ├── BUILD.bazel          # ts_project
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       └── constants/
│   │
│   └── auth/                    # @ticketbot/auth
│       ├── BUILD.bazel          # ts_project
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── client.ts        # browser-side auth client
│           └── server.ts        # server-side auth setup
│
├── apps/
│   ├── bot/                     # @ticketbot/bot
│   │   ├── BUILD.bazel          # custom bun_bundle rule
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── commands/
│   │       ├── events/
│   │       ├── tickets/
│   │       └── utils/
│   │
│   ├── server/                  # @ticketbot/server
│   │   ├── BUILD.bazel          # custom bun_bundle rule
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       ├── middleware/
│   │       └── services/
│   │
│   └── dashboard/               # @ticketbot/dashboard
│       ├── BUILD.bazel          # custom next_build rule
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       └── src/
│           ├── app/
│           ├── components/
│           ├── lib/
│           └── styles/
│
└── tools/
    ├── BUILD.bazel
    ├── bun_build.bzl            # custom rule: wraps bun build for apps
    └── docker.bzl               # custom rule: multi-stage Docker build
```

## Bazel Configuration

### MODULE.bazel

Dependencies declared via bzlmod:

- `rules_js` v2.x — npm dependency management, `js_library`, `js_binary`
- `rules_ts` v3.x — TypeScript compilation for shared packages
- `rules_oci` v2.x — building Docker images from Bazel
- `aspect_bazel_lib` — utility rules

### Build Strategy

| Target | Bazel rule | Behavior |
|--------|-----------|----------|
| `packages/db` | `ts_project` | Type-checks + transpiles, exports JS + `.d.ts`, cached |
| `packages/shared` | `ts_project` | Same |
| `packages/auth` | `ts_project` | Same |
| `apps/bot` | Custom `bun_bundle` | Calls `bun build --target=bun`, declares package deps as Bazel inputs |
| `apps/server` | Custom `bun_bundle` | Same — single-file bundle for Elysia |
| `apps/dashboard` | Custom `next_build` | Calls `next build`, outputs `.next/standalone` |

### Custom Rules

**`tools/bun_build.bzl`** — `bun_bundle` rule:

- Inputs: `srcs`, `deps` (other Bazel targets), `entry_point`
- Action: runs `bun build` in sandboxed environment
- Output: bundled JS file tracked by Bazel for caching
- Invalidates only when source files or declared deps change

**`tools/docker.bzl`** — optional Bazel-driven Docker build (alternative to standalone Dockerfiles).

### .bazelrc

```
build --enable_bzlmod
build --experimental_isolated_extension_usages
build:ci --remote_cache=grpcs://your-cache-endpoint
build:ci --google_default_credentials
test --test_output=errors
```

### .bazelversion

```
7.4.1
```

## Docker Configuration

### Local Development — `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: ticketbot
      POSTGRES_USER: ticketbot
      POSTGRES_PASSWORD: ticketbot
    volumes:
      - pgdata:/var/lib/postgresql/data

  bot:
    build: { context: ., dockerfile: Dockerfile.bot, target: dev }
    volumes:
      - ./apps/bot/src:/app/apps/bot/src
      - ./packages:/app/packages
    depends_on: [postgres]
    env_file: .env

  server:
    build: { context: ., dockerfile: Dockerfile.server, target: dev }
    ports: ["3001:3001"]
    volumes:
      - ./apps/server/src:/app/apps/server/src
      - ./packages:/app/packages
    depends_on: [postgres]
    env_file: .env

  dashboard:
    build: { context: ., dockerfile: Dockerfile.dashboard, target: dev }
    ports: ["3000:3000"]
    volumes:
      - ./apps/dashboard/src:/app/apps/dashboard/src
      - ./packages:/app/packages
    depends_on: [server]
    env_file: .env

  drizzle-studio:
    build: { context: ., dockerfile: Dockerfile.server, target: dev }
    command: bunx drizzle-kit studio --port 4983 --host 0.0.0.0
    ports: ["4983:4983"]
    depends_on: [postgres]
    env_file: .env

volumes:
  pgdata:
```

### Production — `docker-compose.prod.yml`

Same postgres service with proper credentials from env. Bot, server, dashboard use `target: prod` build stage. No volume mounts, no Drizzle Studio. Health checks on server and dashboard.

### Dockerfile Pattern (all three apps follow this)

```dockerfile
# ---- base ----
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ---- deps (cached layer) ----
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/auth/package.json packages/auth/
COPY apps/<app>/package.json apps/<app>/
RUN bun install --frozen-lockfile

# ---- dev (hot reload) ----
FROM deps AS dev
COPY packages/ packages/
COPY apps/<app>/ apps/<app>/
CMD ["bun", "--watch", "apps/<app>/src/index.ts"]

# ---- build ----
FROM deps AS build
COPY packages/ packages/
COPY apps/<app>/ apps/<app>/
RUN bun build apps/<app>/src/index.ts --target=bun --outdir=dist

# ---- prod (minimal) ----
FROM oven/bun:1-alpine AS prod
WORKDIR /app
COPY --from=build /app/dist/ ./
CMD ["bun", "index.js"]
```

Dashboard Dockerfile differs: build stage runs `next build`, prod stage copies `.next/standalone` and uses `bun server.js`.

### Caching Optimizations

- `package.json` files copied before source — `bun install` layer only invalidates on dependency changes
- Multi-stage separates dev (source mounts, hot reload) from prod (minimal bundle only)
- Prod images contain only built artifacts — no `node_modules`, no source code

## TypeScript Configuration

### `tsconfig.base.json`

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
    "noUnusedParameters": true
  }
}
```

### Per-package configs

- **`packages/*`**: extends base, adds `"composite": true` (required for `ts_project` in Bazel, enables project references)
- **`apps/bot`**: extends base, targets Bun types, references `packages/db`, `packages/shared`
- **`apps/server`**: extends base, references all three packages
- **`apps/dashboard`**: extends base, adds `"jsx": "preserve"`, Next.js types, path aliases (`@/` -> `./src/`)

### Cross-Package Resolution

- **Dev mode**: Bun workspaces resolve `@ticketbot/*` imports directly from source
- **Bazel build**: declared `deps` on Bazel targets (`//packages/db`, etc.) provide the compiled output

## Workspace Configuration

### Root `package.json`

```json
{
  "name": "@ticketbot/root",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "docker compose up",
    "dev:bot": "bun --watch apps/bot/src/index.ts",
    "dev:server": "bun --watch apps/server/src/index.ts",
    "dev:dashboard": "bun --filter @ticketbot/dashboard dev",
    "db:generate": "bun --filter @ticketbot/db drizzle-kit generate",
    "db:migrate": "bun --filter @ticketbot/db drizzle-kit migrate",
    "db:studio": "bun --filter @ticketbot/db drizzle-kit studio",
    "build": "bazel build //...",
    "test": "bazel test //...",
    "lint": "bazel test //...:lint"
  }
}
```

## Environment

### `.env.example`

```env
# Postgres
DATABASE_URL=postgresql://ticketbot:ticketbot@localhost:5432/ticketbot

# Discord
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_PERMISSIONS=8

# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3001

# Polar.sh
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=

# Super Admin
SUPER_ADMIN=admin@example.com

# App URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Linting & Formatting

Single tool: **Biome** — handles both linting and formatting, faster than ESLint + Prettier. Configured via `biome.json` at root. Bazel test targets run lint checks in CI.

## Dev Workflow

### With Docker (recommended)

1. `cp .env.example .env` — fill in Discord token + secrets
2. `docker compose up` — starts postgres, all 3 apps with hot reload, Drizzle Studio
3. `bun db:generate` — generate migrations from schema changes
4. `bun db:migrate` — apply migrations

### Without Docker

1. Run postgres locally or `docker compose up postgres`
2. Run apps individually: `bun dev:bot`, `bun dev:server`, `bun dev:dashboard`

### CI/Build

1. `bazel build //...` — full cached build
2. `bazel test //...` — all tests including lint

## Phase Dependency

This scaffold is the foundation for all subsequent phases:

- **Phase 2 (Database schema)** builds on `packages/db`
- **Phase 3 (Auth & RBAC)** builds on `packages/auth`
- **Phase 4 (Discord bot)** builds on `apps/bot`
- **Phase 5 (Elysia API)** builds on `apps/server`
- **Phase 6 (Dashboard)** builds on `apps/dashboard`
