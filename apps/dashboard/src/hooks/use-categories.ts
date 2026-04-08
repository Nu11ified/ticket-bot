import { apiDelete, apiFetch, apiPost, apiPut } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface Category {
	id: number
	name: string
	description: string | null
	emoji: string | null
	channelMode: string
	targetChannelId: string | null
	maxOpenPerUser: number
	autoCloseHours: number | null
	position: number
	isEnabled: boolean
}

export function useCategories(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'categories'],
		queryFn: () =>
			apiFetch<{ data: Category[] }>(`/api/guilds/${guildId}/categories`).then((r) => r.data),
	})
}

export function useCreateCategory(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (data: {
			name: string
			description?: string
			emoji?: string
			maxOpenPerUser?: number
		}) => apiPost(`/api/guilds/${guildId}/categories`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'categories'] })
			toast.success('Category created')
		},
	})
}

export function useUpdateCategory(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ categoryId, ...data }: { categoryId: number } & Record<string, unknown>) =>
			apiPut(`/api/guilds/${guildId}/categories/${categoryId}`, data),
		async onMutate({ categoryId, ...data }) {
			await queryClient.cancelQueries({ queryKey: ['guilds', guildId, 'categories'] })
			const previous = queryClient.getQueryData<Category[]>(['guilds', guildId, 'categories'])
			if (previous) {
				queryClient.setQueryData(
					['guilds', guildId, 'categories'],
					previous.map((c) => (c.id === categoryId ? { ...c, ...data } : c)),
				)
			}
			return { previous }
		},
		onError(_err, _vars, context) {
			if (context?.previous) {
				queryClient.setQueryData(['guilds', guildId, 'categories'], context.previous)
			}
		},
		onSettled() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'categories'] })
		},
		onSuccess() {
			toast.success('Category updated')
		},
	})
}

export function useDeleteCategory(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (categoryId: number) =>
			apiDelete(`/api/guilds/${guildId}/categories/${categoryId}`),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'categories'] })
			toast.success('Category deleted')
		},
	})
}
