import { eq } from 'drizzle-orm'
import { createDb } from './client.js'
import { permissions } from './schema/users.js'

const PERMISSIONS_SEED = [
	{ key: 'tickets.create', description: 'Create new tickets', category: 'tickets' },
	{ key: 'tickets.claim', description: 'Claim tickets', category: 'tickets' },
	{ key: 'tickets.close', description: 'Close tickets', category: 'tickets' },
	{ key: 'tickets.reopen', description: 'Reopen closed tickets', category: 'tickets' },
	{ key: 'tickets.assign', description: 'Assign tickets to staff', category: 'tickets' },
	{ key: 'tickets.escalate', description: 'Escalate ticket priority', category: 'tickets' },
	{ key: 'tickets.move', description: 'Move tickets between categories', category: 'tickets' },
	{ key: 'tickets.delete', description: 'Delete tickets permanently', category: 'tickets' },
	{ key: 'tickets.view_all', description: 'View all tickets in guild', category: 'tickets' },
	{
		key: 'tickets.add_internal_note',
		description: 'Add staff-only internal notes',
		category: 'tickets',
	},
	{ key: 'transcripts.view', description: 'View ticket transcripts', category: 'transcripts' },
	{ key: 'transcripts.export', description: 'Export ticket transcripts', category: 'transcripts' },
	{ key: 'panels.create', description: 'Create ticket panels', category: 'panels' },
	{ key: 'panels.edit', description: 'Edit ticket panels', category: 'panels' },
	{ key: 'panels.delete', description: 'Delete ticket panels', category: 'panels' },
	{ key: 'panels.publish', description: 'Publish panels to Discord', category: 'panels' },
	{ key: 'categories.create', description: 'Create ticket categories', category: 'categories' },
	{ key: 'categories.edit', description: 'Edit ticket categories', category: 'categories' },
	{ key: 'categories.delete', description: 'Delete ticket categories', category: 'categories' },
	{ key: 'forms.create', description: 'Create intake forms', category: 'forms' },
	{ key: 'forms.edit', description: 'Edit intake forms', category: 'forms' },
	{ key: 'forms.delete', description: 'Delete intake forms', category: 'forms' },
	{
		key: 'admin.manage_roles',
		description: 'Manage role permission mappings',
		category: 'admin',
	},
	{ key: 'admin.manage_settings', description: 'Manage guild settings', category: 'admin' },
	{ key: 'admin.view_audit_log', description: 'View audit log', category: 'admin' },
	{ key: 'admin.manage_members', description: 'Manage staff members', category: 'admin' },
] as const

async function seed() {
	const databaseUrl = process.env.DATABASE_URL
	if (!databaseUrl) {
		console.error('DATABASE_URL is required')
		process.exit(1)
	}

	const db = createDb(databaseUrl)

	console.log('Seeding permissions...')

	for (const perm of PERMISSIONS_SEED) {
		const existing = await db
			.select()
			.from(permissions)
			.where(eq(permissions.key, perm.key))
			.limit(1)

		if (existing.length === 0) {
			await db.insert(permissions).values(perm)
			console.log(`  + ${perm.key}`)
		} else {
			console.log(`  = ${perm.key} (exists)`)
		}
	}

	console.log('Done. Seeded permissions table.')
	process.exit(0)
}

seed().catch((err) => {
	console.error('Seed failed:', err)
	process.exit(1)
})
