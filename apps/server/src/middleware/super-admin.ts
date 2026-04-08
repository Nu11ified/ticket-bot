import { Elysia } from 'elysia'

export const superAdminGuard = new Elysia({ name: 'super-admin' }).onBeforeHandle(
	// biome-ignore lint/suspicious/noExplicitAny: user is injected by the auth macro at runtime
	({ user, set }: any) => {
		const superAdminEmails = (process.env.SUPER_ADMIN ?? '')
			.split(',')
			.map((e: string) => e.trim())
			.filter(Boolean)

		if (!user?.email || !superAdminEmails.includes(user.email)) {
			set.status = 403
			return { error: 'Super admin access required' }
		}
	},
)
