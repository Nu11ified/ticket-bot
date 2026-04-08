import { apiFetch, apiPost } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Guild {
	id: number
	discordId: string
	name: string
	iconUrl: string | null
	planTier: string
}

interface GuildDetails {
	id: number
	discordId: string
	name: string
	iconUrl: string | null
	planTier: string
	settings: {
		logChannelId: string | null
		transcriptChannelId: string | null
		locale: string
		timezone: string
		autoCloseHours: number | null
		transcriptRetentionDays: number
		ticketCooldownSeconds: number
	} | null
}

export function useGuilds() {
	return useQuery({
		queryKey: ['guilds'],
		queryFn: () => apiFetch<{ data: Guild[] }>('/api/guilds').then((r) => r.data),
	})
}

export function useGuildDetails(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId],
		queryFn: () => apiFetch<{ data: GuildDetails }>(`/api/guilds/${guildId}`).then((r) => r.data),
		enabled: guildId > 0,
	})
}

export function useGuildPermissions(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'permissions'],
		queryFn: () =>
			apiFetch<{ data: { permissions: string[] } }>(`/api/guilds/${guildId}/permissions`).then(
				(r) => r.data.permissions,
			),
		enabled: guildId > 0,
	})
}

export function useRefreshGuilds() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => apiPost<{ success: boolean }>('/api/guilds/refresh', {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds'] })
			toast.success('Guilds refreshed from Discord')
		},
	})
}
