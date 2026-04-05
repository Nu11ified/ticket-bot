import { betterAuth } from 'better-auth'

export function createAuth(databaseUrl: string, baseUrl: string) {
  return betterAuth({
    database: {
      type: 'postgres',
      url: databaseUrl,
    },
    baseURL: baseUrl,
    socialProviders: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
