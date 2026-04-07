import { z } from 'zod'

export const settingsSchema = z.object({
	locale: z.string().min(1),
	timezone: z.string().min(1),
	logChannelId: z.string().nullable(),
	transcriptChannelId: z.string().nullable(),
	ticketCooldownSeconds: z.number().int().min(0).max(3600),
	autoCloseHours: z.number().int().min(1).nullable(),
	transcriptRetentionDays: z.number().int().min(1).max(365),
})

export type SettingsFormData = z.infer<typeof settingsSchema>
