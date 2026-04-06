import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as guildsSchema from './schema/guilds.js'
import * as usersSchema from './schema/users.js'
import * as categoriesSchema from './schema/categories.js'
import * as panelsSchema from './schema/panels.js'
import * as ticketsSchema from './schema/tickets.js'
import * as auditSchema from './schema/audit.js'
import * as rateLimitsSchema from './schema/rate-limits.js'

const schema = {
	...guildsSchema,
	...usersSchema,
	...categoriesSchema,
	...panelsSchema,
	...ticketsSchema,
	...auditSchema,
	...rateLimitsSchema,
}

export function createDb(connectionString: string) {
	const client = postgres(connectionString)
	return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDb>
