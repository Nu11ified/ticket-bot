import type { Database } from '@ticketbot/db'
import { categories, categoryRoleAccess, discordRoles } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listCategories(db: Database, guildId: number) {
	const rows = await db
		.select()
		.from(categories)
		.where(eq(categories.guildId, guildId))
		.orderBy(categories.position)

	return rows
}

export async function getCategory(db: Database, guildId: number, categoryId: number) {
	const rows = await db
		.select()
		.from(categories)
		.where(and(eq(categories.id, categoryId), eq(categories.guildId, guildId)))
		.limit(1)

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found')
	}

	const roleAccess = await db
		.select({
			id: categoryRoleAccess.id,
			discordRoleId: categoryRoleAccess.discordRoleId,
			accessType: categoryRoleAccess.accessType,
			roleName: discordRoles.name,
			roleColor: discordRoles.color,
		})
		.from(categoryRoleAccess)
		.innerJoin(discordRoles, eq(categoryRoleAccess.discordRoleId, discordRoles.id))
		.where(eq(categoryRoleAccess.categoryId, categoryId))

	return { ...row, roleAccess }
}

export async function createCategory(
	db: Database,
	guildId: number,
	data: {
		name: string
		description?: string
		emoji?: string
		maxOpenPerUser?: number
	},
) {
	const rows = await db
		.insert(categories)
		.values({
			guildId,
			name: data.name,
			description: data.description,
			emoji: data.emoji,
			maxOpenPerUser: data.maxOpenPerUser ?? 1,
		})
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(500, 'CREATE_FAILED', 'Failed to create category')
	}

	return row
}

export async function updateCategory(
	db: Database,
	guildId: number,
	categoryId: number,
	data: {
		name?: string
		description?: string | null
		emoji?: string | null
		maxOpenPerUser?: number
		isEnabled?: boolean
		position?: number
		targetChannelId?: string | null
		autoCloseHours?: number | null
	},
) {
	const rows = await db
		.update(categories)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(categories.id, categoryId), eq(categories.guildId, guildId)))
		.returning()

	const row = rows[0]
	if (!row) {
		throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found')
	}

	return row
}

export async function deleteCategory(db: Database, guildId: number, categoryId: number) {
	const rows = await db
		.delete(categories)
		.where(and(eq(categories.id, categoryId), eq(categories.guildId, guildId)))
		.returning({ id: categories.id })

	if (!rows[0]) {
		throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found')
	}
}
