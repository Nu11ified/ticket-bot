import { apiFetch, apiPost } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface BillingAssignment {
	id: number
	guildId: number
	guildName: string
	guildIconUrl: string | null
	assignedAt: string
}

interface BillingInfo {
	subscriptionStatus: string
	polarCustomerId: string | null
	quota: {
		total: number
		used: number
		available: number
	}
	assignments: BillingAssignment[]
}

export function useBilling() {
	return useQuery({
		queryKey: ['billing'],
		queryFn: () => apiFetch<{ data: BillingInfo }>('/api/billing').then((r) => r.data),
	})
}

export function useAssignPremium() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (guildId: number) => apiPost('/api/billing/assign', { guildId }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['billing'] })
			queryClient.invalidateQueries({ queryKey: ['guilds'] })
			toast.success('Premium assigned to server')
		},
	})
}

export function useUnassignPremium() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (guildId: number) => apiPost('/api/billing/unassign', { guildId }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['billing'] })
			queryClient.invalidateQueries({ queryKey: ['guilds'] })
			toast.success('Premium removed from server')
		},
	})
}
