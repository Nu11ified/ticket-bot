import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface AuditLog {
	id: number
	guildId: number
	ticketId: number | null
	actorId: string | null
	actorDiscordId: string
	actorType: string
	action: string
	metadata: Record<string, unknown>
	createdAt: string
	actorUsername: string | null
	actorDisplayName: string | null
}

interface PaginatedResponse<T> {
	data: T[]
	pagination: { cursor: string | null; hasMore: boolean; limit: number }
}

interface AuditLogFilters {
	action?: string
	actorId?: string
	cursor?: string
}

export function useAuditLogs(guildId: number, filters: AuditLogFilters = {}) {
	const params = new URLSearchParams()
	if (filters.action) params.set('action', filters.action)
	if (filters.actorId) params.set('actorId', filters.actorId)
	if (filters.cursor) params.set('cursor', filters.cursor)
	const qs = params.toString()

	return useQuery({
		queryKey: ['guilds', guildId, 'audit-logs', filters],
		queryFn: () =>
			apiFetch<PaginatedResponse<AuditLog>>(
				`/api/guilds/${guildId}/audit-logs${qs ? `?${qs}` : ''}`,
			),
	})
}
