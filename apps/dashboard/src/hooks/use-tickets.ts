import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, apiPut } from '@/lib/api'

interface Ticket {
	id: number
	ticketNumber: number
	subject: string
	status: string
	priority: string
	channelId: string | null
	creatorId: string | null
	assignedToId: string | null
	categoryId: number | null
	categoryName: string | null
	createdAt: string
	updatedAt: string
	closedAt: string | null
}

interface TicketDetail extends Ticket {
	messages: Array<{
		id: number
		content: string
		isStaff: boolean
		isInternalNote: boolean
		createdAt: string
		user: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null
	}>
}

interface PaginatedResponse<T> {
	data: T[]
	pagination: { cursor: string | null; hasMore: boolean; limit: number }
}

interface TicketFilters {
	status?: string
	priority?: string
	categoryId?: string
	assignedToId?: string
	cursor?: string
	limit?: number
}

export function useTickets(guildId: number, filters: TicketFilters = {}) {
	const params = new URLSearchParams()
	if (filters.status) params.set('status', filters.status)
	if (filters.priority) params.set('priority', filters.priority)
	if (filters.categoryId) params.set('categoryId', filters.categoryId)
	if (filters.assignedToId) params.set('assignedToId', filters.assignedToId)
	if (filters.cursor) params.set('cursor', filters.cursor)
	if (filters.limit) params.set('limit', String(filters.limit))
	const qs = params.toString()

	return useQuery({
		queryKey: ['guilds', guildId, 'tickets', filters],
		queryFn: () =>
			apiFetch<PaginatedResponse<Ticket>>(`/api/guilds/${guildId}/tickets${qs ? `?${qs}` : ''}`),
	})
}

export function useTicketDetail(guildId: number, ticketId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'tickets', ticketId],
		queryFn: () =>
			apiFetch<{ data: TicketDetail }>(`/api/guilds/${guildId}/tickets/${ticketId}`).then((r) => r.data),
		enabled: ticketId > 0,
	})
}

export function useUpdateTicketStatus(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ ticketId, status }: { ticketId: number; status: string }) =>
			apiPut(`/api/guilds/${guildId}/tickets/${ticketId}/status`, { status }),
		async onMutate({ ticketId, status }) {
			await queryClient.cancelQueries({ queryKey: ['guilds', guildId, 'tickets', ticketId] })
			const previous = queryClient.getQueryData<TicketDetail>(['guilds', guildId, 'tickets', ticketId])
			if (previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], { ...previous, status })
			}
			return { previous }
		},
		onError(_err, { ticketId }, context) {
			if (context?.previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], context.previous)
			}
		},
		onSettled() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'tickets'] })
		},
		onSuccess() {
			toast.success('Status updated')
		},
	})
}

export function useUpdateTicketPriority(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ ticketId, priority }: { ticketId: number; priority: string }) =>
			apiPut(`/api/guilds/${guildId}/tickets/${ticketId}/priority`, { priority }),
		async onMutate({ ticketId, priority }) {
			await queryClient.cancelQueries({ queryKey: ['guilds', guildId, 'tickets', ticketId] })
			const previous = queryClient.getQueryData<TicketDetail>(['guilds', guildId, 'tickets', ticketId])
			if (previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], { ...previous, priority })
			}
			return { previous }
		},
		onError(_err, { ticketId }, context) {
			if (context?.previous) {
				queryClient.setQueryData(['guilds', guildId, 'tickets', ticketId], context.previous)
			}
		},
		onSettled() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'tickets'] })
		},
		onSuccess() {
			toast.success('Priority updated')
		},
	})
}

export function useAssignTicket(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ ticketId, assignedToId }: { ticketId: number; assignedToId: string | null }) =>
			apiPut(`/api/guilds/${guildId}/tickets/${ticketId}/assign`, { assignedToId }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'tickets'] })
			toast.success('Ticket assigned')
		},
	})
}
