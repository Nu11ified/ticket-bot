import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, apiPost, apiPut } from '@/lib/api'

export interface RolePermission {
	id: number
	key: string
	description: string | null
	category: string
}

export interface Role {
	id: number
	discordRoleId: string
	name: string
	color: number | null
	position: number | null
	permissions: RolePermission[]
}

export function useRoles(guildId: number) {
	return useQuery({
		queryKey: ['guilds', guildId, 'roles'],
		queryFn: () => apiFetch<{ data: Role[] }>(`/api/guilds/${guildId}/roles`).then((r) => r.data),
	})
}

export function useUpdateRolePermissions(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ roleId, permissions }: { roleId: number; permissions: string[] }) =>
			apiPut(`/api/guilds/${guildId}/roles/${roleId}/permissions`, { permissions }),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'roles'] })
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'permissions'] })
			toast.success('Permissions updated')
		},
	})
}

export function useRefreshRoles(guildId: number) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => apiPost(`/api/guilds/${guildId}/roles/refresh`, {}),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'roles'] })
			toast.success('Roles refreshed from Discord')
		},
	})
}
