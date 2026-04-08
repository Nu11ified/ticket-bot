export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public data?: Record<string, unknown>,
	) {
		super(message)
		this.name = 'ApiError'
	}
}
