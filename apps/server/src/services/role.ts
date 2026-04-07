import { syncGuildRoles } from '@ticketbot/auth'
import type { Database } from '@ticketbot/db'
import { discordRoles, guilds, permissions, rolePermissions } from '@ticketbot/db'
import { and, eq, inArray } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function listRolesWithPermissions(db: Database, guildId: number) {
	const roles = await db
		.select()
		.from(discordRoles)
		.where(eq(discordRoles.guildId, guildId))
		.orderBy(discordRoles.position)

	if (roles.length === 0) {
		return []
	}

	const roleIds = roles.map((r) => r.id)

	const rolePerms = await db
		.select({
			discordRoleId: rolePermissions.discordRoleId,
			permissionId: permissions.id,
			key: permissions.key,
			description: permissions.description,
			category: permissions.category,
		})
		.from(rolePermissions)
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(inArray(rolePermissions.discordRoleId, roleIds))

	const permsByRoleId = new Map<
		number,
		Array<{ id: number; key: string; description: string | null; category: string }>
	>()
	for (const rp of rolePerms) {
		const arr = permsByRoleId.get(rp.discordRoleId) ?? []
		arr.push({
			id: rp.permissionId,
			key: rp.key,
			description: rp.description,
			category: rp.category,
		})
		permsByRoleId.set(rp.discordRoleId, arr)
	}

	return roles.map((role) => ({
		...role,
		permissions: permsByRoleId.get(role.id) ?? [],
	}))
}

export async function updateRolePermissions(
	db: Database,
	guildId: number,
	roleId: number,
	permissionKeys: string[],
) {
	const roleRows = await db
		.select({ id: discordRoles.id })
		.from(discordRoles)
		.where(and(eq(discordRoles.id, roleId), eq(discordRoles.guildId, guildId)))
		.limit(1)

	if (!roleRows[0]) {
		throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found in this guild')
	}

	if (permissionKeys.length === 0) {
		await db.delete(rolePermissions).where(eq(rolePermissions.discordRoleId, roleId))
		return []
	}

	const permRows = await db
		.select({ id: permissions.id, key: permissions.key })
		.from(permissions)
		.where(inArray(permissions.key, permissionKeys))

	const foundKeys = new Set(permRows.map((p) => p.key))
	const unknownKeys = permissionKeys.filter((k) => !foundKeys.has(k))
	if (unknownKeys.length > 0) {
		throw new ApiError(400, 'INVALID_PERMISSIONS', `Unknown permissions: ${unknownKeys.join(', ')}`)
	}

	await db.delete(rolePermissions).where(eq(rolePermissions.discordRoleId, roleId))

	const newRows = permRows.map((p) => ({
		discordRoleId: roleId,
		permissionId: p.id,
	}))

	await db.insert(rolePermissions).values(newRows)

	return permRows
}

export async function refreshGuildRoles(db: Database, guildId: number) {
	const guildRows = await db
		.select({ discordId: guilds.discordId })
		.from(guilds)
		.where(eq(guilds.id, guildId))
		.limit(1)

	const guild = guildRows[0]
	if (!guild) {
		throw new ApiError(404, 'GUILD_NOT_FOUND', 'Guild not found')
	}

	await syncGuildRoles(db, guildId, guild.discordId)
}
