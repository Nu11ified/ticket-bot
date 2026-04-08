import { z } from 'zod'

export const categorySchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	description: z.string().max(500).optional(),
	emoji: z.string().max(10).optional(),
	maxOpenPerUser: z.number().int().min(1).max(50).optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>
