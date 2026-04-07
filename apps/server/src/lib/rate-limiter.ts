interface RateLimitEntry {
	timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000
const CLEANUP_INTERVAL_MS = 5 * 60_000
const STALE_THRESHOLD_MS = 10 * 60_000

export function checkRateLimit(
	key: string,
	limit: number,
): { allowed: boolean; remaining: number; resetAt: number; retryAfter: number } {
	const now = Date.now()
	const windowStart = now - WINDOW_MS

	let entry = store.get(key)
	if (!entry) {
		entry = { timestamps: [] }
		store.set(key, entry)
	}

	entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

	if (entry.timestamps.length >= limit) {
		const oldestInWindow = entry.timestamps[0] ?? now
		const resetAt = oldestInWindow + WINDOW_MS
		const retryAfter = Math.ceil((resetAt - now) / 1000)
		return {
			allowed: false,
			remaining: 0,
			resetAt: Math.ceil(resetAt / 1000),
			retryAfter,
		}
	}

	entry.timestamps.push(now)
	return {
		allowed: true,
		remaining: limit - entry.timestamps.length,
		resetAt: Math.ceil((now + WINDOW_MS) / 1000),
		retryAfter: 0,
	}
}

export function startRateLimitCleanup(): NodeJS.Timeout {
	return setInterval(() => {
		const now = Date.now()
		for (const [key, entry] of store) {
			const newest = entry.timestamps[entry.timestamps.length - 1] ?? 0
			if (now - newest > STALE_THRESHOLD_MS) {
				store.delete(key)
			}
		}
	}, CLEANUP_INTERVAL_MS)
}
