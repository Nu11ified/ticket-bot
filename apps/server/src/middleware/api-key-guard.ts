import { ApiError } from '../lib/api-error.js'

export function checkKeyPermission(required: string) {
	// biome-ignore lint/suspicious/noExplicitAny: apiKey is injected by apiKeyPlugin derive
	return ({ apiKey }: any) => {
		if (!apiKey.permissions.includes(required)) {
			throw new ApiError(403, 'FORBIDDEN', `API key lacks required permission: ${required}`)
		}
	}
}
