import { apiFetch } from '@/lib/api'
import type { CurrentUser } from '@/providers/user-provider'
import { useQuery } from '@tanstack/react-query'

export function useUser() {
	return useQuery({
		queryKey: ['user', 'me'],
		queryFn: () => apiFetch<{ data: CurrentUser }>('/api/user/me').then((r) => r.data),
	})
}
