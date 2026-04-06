import { eq } from 'drizzle-orm'
import type { Database } from '@ticketbot/db'
import { auditLogs, users } from '@ticketbot/db'
import type { AuditAction, AuditActorType } from '@ticketbot/shared'

interface AuditEntry {
	guildId: number
	ticketId?: number | null
	actorDiscordId: string
	actorType: AuditActorType
	action: AuditAction
	metadata?: Record<string, unknown>
}

export async function writeAuditLog(db: Database, entry: AuditEntry): Promise<void> {
	let actorId: string | null = null

	if (entry.actorType === 'user') {
		const user = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.discordId, entry.actorDiscordId))
			.limit(1)

		const firstUser = user[0]
		if (firstUser) {
			actorId = firstUser.id
		}
	}

	await db.insert(auditLogs).values({
		guildId: entry.guildId,
		ticketId: entry.ticketId ?? null,
		actorId,
		actorDiscordId: entry.actorDiscordId,
		actorType: entry.actorType,
		action: entry.action,
		metadata: entry.metadata ?? {},
	})
}
