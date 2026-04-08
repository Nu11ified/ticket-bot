import type { Database } from '@ticketbot/db'
import { Elysia, t } from 'elysia'
import { assignPremium, getBillingInfo, unassignPremium } from '../../services/billing.js'

export function billingRoutes(db: Database) {
	return new Elysia({ prefix: '/billing' })
		.get(
			'/',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user }: any) => {
				const billing = await getBillingInfo(db, user.id)
				return { data: billing }
			},
			// @ts-expect-error auth macro injected by parent plugin
			{ auth: true },
		)
		.post(
			'/assign',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, body }: any) => {
				const result = await assignPremium(db, user.id, body.guildId)
				return result
			},
			{
				auth: true,
				body: t.Object({
					guildId: t.Integer({ minimum: 1 }),
				}),
			},
		)
		.post(
			'/unassign',
			// biome-ignore lint/suspicious/noExplicitAny: user injected by auth macro
			async ({ user, body }: any) => {
				const result = await unassignPremium(db, user.id, body.guildId)
				return result
			},
			{
				auth: true,
				body: t.Object({
					guildId: t.Integer({ minimum: 1 }),
				}),
			},
		)
}
