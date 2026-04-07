export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message)
		this.name = 'ApiError'
	}
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...options?.headers,
		},
	})

	if (res.status === 401) {
		window.location.href = '/login'
		throw new ApiError(401, 'UNAUTHORIZED', 'Session expired')
	}

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: 'UNKNOWN', message: 'Request failed' }))
		throw new ApiError(res.status, body.error, body.message)
	}

	return res.json()
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'POST',
		body: JSON.stringify(body),
	})
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'PUT',
		body: JSON.stringify(body),
	})
}

export function apiDelete<T>(path: string): Promise<T> {
	return apiFetch<T>(path, { method: 'DELETE' })
}
