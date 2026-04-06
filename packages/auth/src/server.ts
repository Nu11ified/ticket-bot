import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Database } from '@ticketbot/db'
import { accounts, sessions, users, verifications } from '@ticketbot/db'

export function createAuth(db: Database) {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: {
				user: users,
				session: sessions,
				account: accounts,
				verification: verifications,
			},
		}),
		secret: process.env.BETTER_AUTH_SECRET,
		baseURL: process.env.BETTER_AUTH_URL,
		user: {
			modelName: 'users',
			fields: {
				name: 'username',
				image: 'avatar_url',
			},
			additionalFields: {
				discordId: {
					type: 'string',
					required: false,
					input: false,
				},
				displayName: {
					type: 'string',
					required: false,
					input: false,
				},
				isSuperAdmin: {
					type: 'boolean',
					required: false,
					defaultValue: false,
					input: false,
				},
			},
		},
		socialProviders: {
			discord: {
				clientId: process.env.DISCORD_CLIENT_ID ?? '',
				clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
				scope: ['identify', 'email', 'guilds'],
				mapProfileToUser: (profile) => ({
					discordId: profile.id,
					displayName: profile.global_name ?? profile.username,
				}),
			},
		},
	})
}

export type Auth = ReturnType<typeof createAuth>
