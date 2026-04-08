import type { Database } from '@ticketbot/db'
import type { Message } from 'discord.js'
import {
	ensureUser,
	getStaffRoleDiscordIds,
	logMessage,
	resolveTicketByChannelId,
	setFirstResponseAt,
} from '../services/ticket.js'

export async function handleMessageCreate(db: Database, message: Message): Promise<void> {
	if (message.author.bot) return
	if (!message.guild) return

	const ticket = await resolveTicketByChannelId(db, message.channel.id)
	if (!ticket) return
	if (ticket.status === 'closed' || ticket.status === 'archived') return

	const userId = await ensureUser(
		db,
		message.author.id,
		message.author.username,
		message.author.displayName,
		message.author.avatarURL() ?? undefined,
	)

	const staffRoleIds = await getStaffRoleDiscordIds(db, ticket.categoryId)
	const member = message.member
	const isStaff = member ? staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) : false

	const attachments = [...message.attachments.values()].map((a) => ({
		id: a.id,
		url: a.url,
		name: a.name,
		size: a.size,
		contentType: a.contentType,
	}))

	await logMessage(db, {
		ticketId: ticket.ticketId,
		userId,
		discordMessageId: message.id,
		content: message.content,
		isStaff,
		attachments,
	})

	if (isStaff) {
		await setFirstResponseAt(db, ticket.ticketId)
	}
}
