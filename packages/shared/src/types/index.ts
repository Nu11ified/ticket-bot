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
