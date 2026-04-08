import { resolveUserPermissions } from '@ticketbot/auth'
import type { Database } from '@ticketbot/db'
import { guilds, premiumAssignments, users } from '@ticketbot/db'
import { and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'

export async function getBillingInfo(db: Database, userId: string) {
	const userRows = await db
		.select({
			polarCustomerId: users.polarCustomerId,
			subscriptionStatus: users.subscriptionStatus,
			premiumGuildQuota: users.premiumGuildQuota,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	const user = userRows[0]
	if (!user) {
		throw new ApiError(404, 'USER_NOT_FOUND', 'User not found')
	}

	const assignments = await db
		.select({
			id: premiumAssignments.id,
			guildId: premiumAssignments.guildId,
			guildName: guilds.name,
			guildIconUrl: guilds.iconUrl,
			assignedAt: premiumAssignments.assignedAt,
		})
		.from(premiumAssignments)
		.innerJoin(guilds, eq(premiumAssignments.guildId, guilds.id))
		.where(eq(premiumAssignments.userId, userId))

	return {
		subscriptionStatus: user.subscriptionStatus,
		polarCustomerId: user.polarCustomerId,
		quota: {
			total: user.premiumGuildQuota,
			used: assignments.length,
			available: user.premiumGuildQuota - assignments.length,
		},
		assignments,
	}
}

export async function assignPremium(db: Database, userId: string, guildId: number) {
	// Check user has admin permission in guild
	const perms = await resolveUserPermissions(db, userId, guildId)
	if (!perms.has('admin.manage_settings')) {
		throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'You must be an admin in this guild')
	}

	// Check quota
	const userRows = await db
		.select({ premiumGuildQuota: users.premiumGuildQuota })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	const user = userRows[0]
	if (!user) {
		throw new ApiError(404, 'USER_NOT_FOUND', 'User not found')
	}

	const existingCount = await db
		.select({ id: premiumAssignments.id })
		.from(premiumAssignments)
		.where(eq(premiumAssignments.userId, userId))

	if (existingCount.length >= user.premiumGuildQuota) {
		throw new ApiError(400, 'QUOTA_EXCEEDED', 'No premium slots available')
	}

	// Check not already assigned
	const existing = await db
		.select({ id: premiumAssignments.id })
		.from(premiumAssignments)
		.where(and(eq(premiumAssignments.userId, userId), eq(premiumAssignments.guildId, guildId)))
		.limit(1)

	if (existing[0]) {
		throw new ApiError(409, 'ALREADY_ASSIGNED', 'Premium already assigned to this guild')
	}

	// Create assignment and update guild tier
	await db.insert(premiumAssignments).values({ userId, guildId })
	await db
		.update(guilds)
		.set({ planTier: 'premium', updatedAt: new Date() })
		.where(eq(guilds.id, guildId))

	return { success: true }
}

export async function unassignPremium(db: Database, userId: string, guildId: number) {
	const rows = await db
		.delete(premiumAssignments)
		.where(and(eq(premiumAssignments.userId, userId), eq(premiumAssignments.guildId, guildId)))
		.returning()

	if (rows.length === 0) {
		throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND', 'No premium assignment found for this guild')
	}

	// Check if any other user still has premium assigned to this guild
	const otherAssignments = await db
		.select({ id: premiumAssignments.id })
		.from(premiumAssignments)
		.where(eq(premiumAssignments.guildId, guildId))
		.limit(1)

	if (!otherAssignments[0]) {
		await db
			.update(guilds)
			.set({ planTier: 'free', updatedAt: new Date() })
			.where(eq(guilds.id, guildId))
	}

	return { success: true }
}
