import type { Database } from '@ticketbot/db'
import { auditLogs } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { checkPermissions } from '../../middleware/guard.js'
import {
	listRolesWithPermissions,
	refreshGuildRoles,
	updateRolePermissions,
} from '../../services/role.js'

export function roleRoutes(db: Database) {
	return new Elysia({ prefix: '/guilds/:guildId/roles' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				const roles = await listRolesWithPermissions(db, guildId)
				return { data: roles }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_roles']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
		.put(
			'/:roleId/permissions',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params, body, user }: any) => {
				const guildId = Number(params.guildId)
				const roleId = Number(params.roleId)
				const result = await updateRolePermissions(db, guildId, roleId, body.permissions)
				await db.insert(auditLogs).values({
					guildId,
					actorId: user.id,
					actorType: 'user',
					action: 'role.permissions_updated',
					metadata: { roleId, permissions: body.permissions },
				})
				return { data: result }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_roles']),
				params: t.Object({ guildId: t.Numeric(), roleId: t.Numeric() }),
				body: t.Object({
					permissions: t.Array(t.String()),
				}),
			},
		)
		.post(
			'/refresh',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ params }: any) => {
				const guildId = Number(params.guildId)
				await refreshGuildRoles(db, guildId)
				return { success: true }
			},
			{
				auth: true,
				beforeHandle: checkPermissions(db, ['admin.manage_roles']),
				params: t.Object({ guildId: t.Numeric() }),
			},
		)
}
