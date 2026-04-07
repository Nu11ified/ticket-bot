import { apiFetch } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

export interface Transcript {
	id: number
	ticketId: number
	ticketNumber: number
	messageCount: number
	participants: unknown
	metadata: unknown
	expiresAt: string | null
	createdAt: string
}

interface PaginatedResponse<T> {
	data: T[]
	pagination: { cursor: string | null; hasMore: boolean; limit: number }
}

export function useTranscripts(guildId: number, cursor?: string) {
	const params = new URLSearchParams()
	if (cursor) params.set('cursor', cursor)
	const qs = params.toString()

	return useQuery({
		queryKey: ['guilds', guildId, 'transcripts', { cursor }],
		queryFn: () =>
			apiFetch<PaginatedResponse<Transcript>>(
				`/api/guilds/${guildId}/transcripts${qs ? `?${qs}` : ''}`,
			),
	})
}

export function useExportTranscript(
	guildId: number,
	transcriptId: number,
	format: 'json' | 'html',
) {
	return {
		download() {
			window.open(
				`/api/guilds/${guildId}/transcripts/${transcriptId}/export?format=${format}`,
				'_blank',
			)
		},
	}
}
