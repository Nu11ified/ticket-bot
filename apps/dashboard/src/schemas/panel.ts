import { z } from 'zod'

export const panelSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	embedTitle: z.string().max(256).optional().nullable(),
	embedDescription: z.string().max(4096).optional().nullable(),
	embedColor: z.number().int().min(0).max(16777215).optional().nullable(),
	embedThumbnailUrl: z.string().url().optional().nullable().or(z.literal('')),
	embedFooterText: z.string().max(2048).optional().nullable(),
	channelId: z.string().optional().nullable(),
})

export type PanelFormData = z.infer<typeof panelSchema>
