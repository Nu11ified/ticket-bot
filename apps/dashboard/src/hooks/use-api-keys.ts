import { apiDelete, apiFetch, apiPost } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface ApiKey {
	id: number
	name: string
	keyPrefix: string
	permissions: string[]
	rateLimitPerMinute: number | null
	lastUsedAt: string | null
	expiresAt: string | null
	createdAt: string
}

interface CreateApiKeyResult {
	id: number
	name: string
	key: string
	keyPrefix: string
	permissions: string[]
}

export function useApiKeys(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'api-keys'],
		queryFn: () =>
			apiFetch<{ data: ApiKey[] }>(`/api/guilds/${guildId}/api-keys`).then((r) => r.data),
	})
}

export function useCreateApiKey(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: { name: string; permissions: string[]; expiresInDays?: 30 | 90 | 365 }) =>
			apiPost<{ data: CreateApiKeyResult }>(`/api/guilds/${guildId}/api-keys`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'api-keys'] })
			toast.success('API key created')
		},
	})
}

export function useRotateApiKey(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (keyId: number) =>
			apiPost<{ data: { key: string } }>(`/api/guilds/${guildId}/api-keys/${keyId}/rotate`, {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'api-keys'] })
			toast.success('API key rotated')
		},
	})
}

export function useRevokeApiKey(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (keyId: number) => apiDelete(`/api/guilds/${guildId}/api-keys/${keyId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'api-keys'] })
			toast.success('API key revoked')
		},
	})
}
