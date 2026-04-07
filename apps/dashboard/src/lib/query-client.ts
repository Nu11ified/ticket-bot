import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				gcTime: 300_000,
				retry: 3,
				refetchOnWindowFocus: false,
			},
			mutations: {
				onError(error) {
					if (error instanceof ApiError) {
						toast.error(error.message)
					} else {
						toast.error('Something went wrong')
					}
				},
			},
		},
	})
}
