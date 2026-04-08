import type { Database } from '@ticketbot/db'
import { tickets, transcripts } from '@ticketbot/db'
import { type SQL, and, eq } from 'drizzle-orm'
import { ApiError } from '../lib/api-error.js'
import {
	type PaginatedResult,
	clampLimit,
	cursorCondition,
	decodeCursor,
	paginateResults,
} from '../lib/cursor.js'

interface TranscriptListFilters {
	cursor?: string
	limit?: number
}

export async function listTranscripts(
	db: Database,
	guildId: number,
	filters: TranscriptListFilters,
): Promise<PaginatedResult<Record<string, unknown>>> {
	const limit = clampLimit(filters.limit)
	const conditions: SQL[] = [eq(transcripts.guildId, guildId)]

	if (filters.cursor) {
		const cursor = decodeCursor(filters.cursor)
		const cond = cursorCondition(transcripts.id, cursor)
		if (cond) conditions.push(cond)
	}

	const rows = await db
		.select({
			id: transcripts.id,
			ticketId: transcripts.ticketId,
			ticketNumber: tickets.ticketNumber,
			messageCount: transcripts.messageCount,
			participants: transcripts.participants,
			metadata: transcripts.metadata,
			expiresAt: transcripts.expiresAt,
			createdAt: transcripts.createdAt,
		})
		.from(transcripts)
		.innerJoin(tickets, eq(transcripts.ticketId, tickets.id))
		.where(and(...conditions))
		.orderBy(transcripts.id)
		.limit(limit + 1)

	return paginateResults(rows, limit)
}

export async function getTranscript(db: Database, guildId: number, transcriptId: number) {
	const rows = await db
		.select()
		.from(transcripts)
		.where(and(eq(transcripts.id, transcriptId), eq(transcripts.guildId, guildId)))
		.limit(1)

	const transcript = rows[0]
	if (!transcript) {
		throw new ApiError(404, 'TRANSCRIPT_NOT_FOUND', 'Transcript not found')
	}

	return transcript
}

export async function exportTranscript(
	db: Database,
	guildId: number,
	transcriptId: number,
	format: 'json' | 'html',
): Promise<{ contentType: string; data: string }> {
	const transcript = await getTranscript(db, guildId, transcriptId)

	if (format === 'json') {
		return {
			contentType: 'application/json',
			data: JSON.stringify({
				ticketId: transcript.ticketId,
				messages: transcript.messages,
				participants: transcript.participants,
				metadata: transcript.metadata,
				createdAt: transcript.createdAt,
			}),
		}
	}

	const messages = Array.isArray(transcript.messages) ? transcript.messages : []
	const messageHtml = messages
		.map((msg: Record<string, unknown>) => {
			const author = String(msg.author ?? 'Unknown')
			const content = String(msg.content ?? '')
			const timestamp = msg.timestamp ? new Date(String(msg.timestamp)).toLocaleString() : ''
			return `<div class="message">
        <div class="meta"><strong>${escapeHtml(author)}</strong> <span class="time">${escapeHtml(timestamp)}</span></div>
        <div class="content">${escapeHtml(content)}</div>
      </div>`
		})
		.join('\n')

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript – Ticket ${transcript.ticketId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #7c3aed; }
    .message { padding: 10px 14px; margin: 6px 0; background: #16213e; border-radius: 8px; }
    .meta { font-size: 0.85em; color: #aaa; margin-bottom: 4px; }
    .meta strong { color: #c4b5fd; }
    .time { margin-left: 8px; font-size: 0.8em; }
    .content { white-space: pre-wrap; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Transcript – Ticket ${transcript.ticketId}</h1>
  <p>Created: ${transcript.createdAt.toISOString()}</p>
  <p>Messages: ${transcript.messageCount}</p>
  ${messageHtml}
</body>
</html>`

	return { contentType: 'text/html', data: html }
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
