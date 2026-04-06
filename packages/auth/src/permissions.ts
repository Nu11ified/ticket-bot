import type { Database } from '@ticketbot/db'
import { guildMemberRoles, guildMembers, permissions, rolePermissions } from '@ticketbot/db'
import { and, eq, inArray } from 'drizzle-orm'

export async function resolveUserPermissions(
	db: Database,
	userId: string,
	guildId: number,
): Promise<Set<string>> {
	const member = await db
		.select({ id: guildMembers.id })
		.from(guildMembers)
		.where(and(eq(guildMembers.userId, userId), eq(guildMembers.guildId, guildId)))
		.limit(1)

	const firstMember = member[0]
	if (!firstMember) return new Set()

	const memberRoles = await db
		.select({ discordRoleId: guildMemberRoles.discordRoleId })
		.from(guildMemberRoles)
		.where(eq(guildMemberRoles.guildMemberId, firstMember.id))

	if (memberRoles.length === 0) return new Set()

	const roleIds = memberRoles.map((r) => r.discordRoleId)

	const perms = await db
		.select({ key: permissions.key })
		.from(rolePermissions)
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(inArray(rolePermissions.discordRoleId, roleIds))

	return new Set(perms.map((p) => p.key))
}

export async function hasPermission(
	db: Database,
	userId: string,
	guildId: number,
	permissionKey: string,
): Promise<boolean> {
	const perms = await resolveUserPermissions(db, userId, guildId)
	return perms.has(permissionKey)
}
