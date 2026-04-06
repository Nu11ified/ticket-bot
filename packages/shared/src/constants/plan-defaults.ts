import type { PlanTier } from '../types/index.js'

interface PlanDefaults {
	transcriptRetentionDays: number
	ticketCooldownSeconds: number
	maxOpenTicketsPerUser: number
}

export const PLAN_DEFAULTS: Record<PlanTier, PlanDefaults> = {
	free: {
		transcriptRetentionDays: 5,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 1,
	},
	premium: {
		transcriptRetentionDays: 180,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 5,
	},
} as const
