import { z } from 'zod'

export const apiKeySchema = z.object({
	name: z.string().min(1, 'Name is required').max(100),
	permissions: z.array(z.string()).min(1, 'Select at least one permission'),
	expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).optional(),
})

export type ApiKeyFormData = z.infer<typeof apiKeySchema>
