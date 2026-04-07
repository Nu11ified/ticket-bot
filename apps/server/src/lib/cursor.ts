import { type SQL, gt, lt } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { ApiError } from './api-error.js'

interface CursorData {
	id: number
	dir: 'next' | 'prev'
}

export function encodeCursor(id: number, dir: 'next' | 'prev' = 'next'): string {
	return Buffer.from(JSON.stringify({ id, dir })).toString('base64url')
}

export function decodeCursor(raw: string): CursorData {
	try {
		const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString())
		if (
			typeof parsed.id !== 'number' ||
			!Number.isInteger(parsed.id) ||
			parsed.id < 1 ||
			(parsed.dir !== 'next' && parsed.dir !== 'prev')
		) {
			throw new Error()
		}
		return { id: parsed.id, dir: parsed.dir }
	} catch {
		throw new ApiError(400, 'INVALID_CURSOR', 'Invalid cursor')
	}
}

export function cursorCondition(idColumn: PgColumn, cursor: CursorData | null): SQL | undefined {
	if (!cursor) return undefined
	return cursor.dir === 'next' ? gt(idColumn, cursor.id) : lt(idColumn, cursor.id)
}

export function clampLimit(input: number | undefined, defaultLimit = 50, maxLimit = 100): number {
	const limit = input ?? defaultLimit
	return Math.min(Math.max(1, limit), maxLimit)
}

export interface PaginatedResult<T> {
	data: T[]
	pagination: {
		cursor: string | null
		hasMore: boolean
		limit: number
	}
}

export function paginateResults<T extends { id: number }>(
	rows: T[],
	limit: number,
): PaginatedResult<T> {
	const hasMore = rows.length > limit
	const data = hasMore ? rows.slice(0, limit) : rows
	const lastItem = data[data.length - 1]
	return {
		data,
		pagination: {
			cursor: lastItem ? encodeCursor(lastItem.id) : null,
			hasMore,
			limit,
		},
	}
}
