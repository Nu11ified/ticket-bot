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
