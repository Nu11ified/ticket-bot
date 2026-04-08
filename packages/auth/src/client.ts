import { createAuthClient } from 'better-auth/client'

export function createBrowserAuthClient(baseUrl: string) {
	return createAuthClient({
		baseURL: baseUrl,
	})
}

export type AuthClient = ReturnType<typeof createBrowserAuthClient>
