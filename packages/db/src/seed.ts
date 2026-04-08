import { eq } from 'drizzle-orm'
import { createDb } from './client.js'
import { permissions } from './schema/index.js'

const PERMISSION_SEEDS = [
	{ key: 'admin.manage_settings', description: 'Manage guild settings', category: 'admin' },
	{ key: 'admin.manage_categories', description: 'Manage ticket categories', category: 'admin' },
	{ key: 'admin.manage_panels', description: 'Manage ticket panels', category: 'admin' },
	{ key: 'admin.manage_roles', description: 'Manage role permissions', category: 'admin' },
	{ key: 'admin.view_audit_logs', description: 'View audit logs', category: 'admin' },
	{ key: 'admin.manage_api_keys', description: 'Manage API keys', category: 'admin' },
	{ key: 'tickets.view', description: 'View tickets', category: 'tickets' },
	{
		key: 'tickets.manage',
		description: 'Manage ticket status, priority, assignment',
		category: 'tickets',
	},
	{ key: 'transcripts.view', description: 'View transcripts', category: 'transcripts' },
	{ key: 'transcripts.export', description: 'Export transcripts', category: 'transcripts' },
]

async function seed() {
	const db = createDb(process.env.DATABASE_URL ?? '')

	for (const perm of PERMISSION_SEEDS) {
		const existing = await db
			.select({ id: permissions.id })
			.from(permissions)
			.where(eq(permissions.key, perm.key))
			.limit(1)

		if (existing.length === 0) {
			await db.insert(permissions).values(perm)
			console.log(`Seeded permission: ${perm.key}`)
		} else {
			console.log(`Permission already exists: ${perm.key}`)
		}
	}

	console.log('Seed complete')
	process.exit(0)
}

seed().catch((err) => {
	console.error('Seed failed:', err)
	process.exit(1)
})
