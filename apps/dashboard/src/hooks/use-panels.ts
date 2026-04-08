import { apiDelete, apiFetch, apiPost, apiPut } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Panel {
	id: number
	name: string
	channelId: string | null
	messageId: string | null
	embedTitle: string | null
	embedDescription: string | null
	embedColor: number | null
	embedThumbnailUrl: string | null
	embedFooterText: string | null
	isPublished: boolean
	createdAt: string
}

interface PanelWithButtons extends Panel {
	buttons: Array<{
		id: number
		categoryId: number
		label: string
		emoji: string | null
		style: string
		position: number
	}>
}

export type { Panel, PanelWithButtons }

export function usePanels(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'panels'],
		queryFn: () => apiFetch<{ data: Panel[] }>(`/api/guilds/${guildId}/panels`).then((r) => r.data),
	})
}

export function usePanelDetail(guildId: number, panelId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'panels', panelId],
		queryFn: () =>
			apiFetch<{ data: PanelWithButtons }>(`/api/guilds/${guildId}/panels/${panelId}`).then(
				(r) => r.data,
			),
		enabled: panelId > 0,
	})
}

export function useCreatePanel(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: { name: string }) =>
			apiPost<{ data: Panel }>(`/api/guilds/${guildId}/panels`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			toast.success('Panel created')
		},
	})
}

export function useUpdatePanel(guildId: number, panelId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: Record<string, unknown>) =>
			apiPut(`/api/guilds/${guildId}/panels/${panelId}`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels', panelId] })
			toast.success('Panel updated')
		},
	})
}

export function useDeletePanel(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (panelId: number) => apiDelete(`/api/guilds/${guildId}/panels/${panelId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			toast.success('Panel deleted')
		},
	})
}

export function useDeployPanel(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (panelId: number) => apiPost(`/api/guilds/${guildId}/panels/${panelId}/deploy`, {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels'] })
			toast.success('Panel deployed to Discord')
		},
	})
}

export function useAddPanelButton(guildId: number, panelId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: { categoryId: number; label: string; emoji?: string; style?: string }) =>
			apiPost(`/api/guilds/${guildId}/panels/${panelId}/buttons`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels', panelId] })
			toast.success('Button added')
		},
	})
}

export function useRemovePanelButton(guildId: number, panelId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (buttonId: number) =>
			apiDelete(`/api/guilds/${guildId}/panels/${panelId}/buttons/${buttonId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'panels', panelId] })
			toast.success('Button removed')
		},
	})
}
