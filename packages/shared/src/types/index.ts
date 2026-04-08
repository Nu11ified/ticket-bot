export type TicketStatus =
	| 'open'
	| 'pending'
	| 'waiting_user'
	| 'waiting_staff'
	| 'escalated'
	| 'resolved'
	| 'closed'
	| 'archived'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type PlanTier = 'free' | 'premium'

export type SubscriptionStatus = 'none' | 'active' | 'canceled' | 'past_due'

export type ChannelMode = 'channel' | 'thread'

export type CategoryAccessType = 'staff' | 'requester'

export type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger'

export type FormFieldType = 'text' | 'textarea' | 'select' | 'number'

export type AuditActorType = 'user' | 'system' | 'bot'

export type RateLimitAction = 'ticket.create'

export type ApiKeyPermission =
	| 'guild.read'
	| 'tickets.read'
	| 'tickets.update'
	| 'transcripts.read'
	| 'categories.read'
	| 'audit_logs.read'

export const API_KEY_PERMISSIONS: ApiKeyPermission[] = [
	'guild.read',
	'tickets.read',
	'tickets.update',
	'transcripts.read',
	'categories.read',
	'audit_logs.read',
]

export type AuditAction =
	| 'ticket.created'
	| 'ticket.claimed'
	| 'ticket.unclaimed'
	| 'ticket.reassigned'
	| 'ticket.closed'
	| 'ticket.reopened'
	| 'ticket.escalated'
	| 'ticket.status_changed'
	| 'ticket.moved'
	| 'panel.created'
	| 'panel.published'
	| 'panel.updated'
	| 'settings.updated'
	| 'role.permissions_updated'
	| 'transcript.viewed'
	| 'transcript.exported'
	| 'api_key.created'
	| 'api_key.revoked'
	| 'api_key.rotated'
	| 'category.created'
	| 'category.updated'
	| 'category.deleted'
	| 'panel.deleted'
	| 'panel.deployed'
