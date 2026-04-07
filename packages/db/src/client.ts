import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as apiKeysSchema from './schema/api-keys.js'
import * as auditSchema from './schema/audit.js'
import * as authSchema from './schema/auth.js'
import * as billingSchema from './schema/billing.js'
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
	...apiKeysSchema,
	...billingSchema,
}

export function createDb(connectionString: string) {
	const client = postgres(connectionString)
	return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDb>
