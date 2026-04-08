import type { PlanTier } from '../types/index.js'

interface PlanDefaults {
	transcriptRetentionDays: number
	ticketCooldownSeconds: number
	maxOpenTicketsPerUser: number
	apiRateLimitPerMinute: number
}

export const PLAN_DEFAULTS: Record<PlanTier, PlanDefaults> = {
	free: {
		transcriptRetentionDays: 5,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 1,
		apiRateLimitPerMinute: 60,
	},
	premium: {
		transcriptRetentionDays: 180,
		ticketCooldownSeconds: 60,
		maxOpenTicketsPerUser: 5,
		apiRateLimitPerMinute: 300,
	},
} as const
