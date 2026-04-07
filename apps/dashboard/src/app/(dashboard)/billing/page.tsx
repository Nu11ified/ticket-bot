'use client'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssignPremium, useBilling, useUnassignPremium } from '@/hooks/use-billing'
import { useGuilds } from '@/hooks/use-guilds'
import { PREMIUM_PRICE } from '@ticketbot/shared'
import { CreditCard, ExternalLink, Minus, Plus, Server } from 'lucide-react'
import { useState } from 'react'

export default function BillingPage() {
	const { data: billing, isLoading } = useBilling()
	const { data: guilds } = useGuilds()
	const assignPremium = useAssignPremium()
	const unassignPremium = useUnassignPremium()

	const [addOpen, setAddOpen] = useState(false)
	const [removeGuildId, setRemoveGuildId] = useState<number | null>(null)

	if (isLoading) return <Skeleton className="h-96 w-full max-w-2xl mx-auto" />

	const isSubscribed = billing?.subscriptionStatus === 'active'
	const isPastDue = billing?.subscriptionStatus === 'past_due'
	const isCanceled = billing?.subscriptionStatus === 'canceled'

	const assignedGuildIds = new Set(billing?.assignments.map((a) => a.guildId) ?? [])
	const eligibleGuilds =
		guilds?.filter((g) => g.planTier === 'free' && !assignedGuildIds.has(g.id)) ?? []

	return (
		<div className="max-w-2xl mx-auto">
			<PageHeader title="Billing" description="Manage your premium subscription" />

			{(isPastDue || isCanceled) && (
				<div className="glass-panel p-4 mb-6 border-yellow-500/30 bg-yellow-500/5">
					<p className="text-sm text-yellow-400">
						{isPastDue
							? 'Your payment is past due. Please update your payment method.'
							: 'Your subscription has been canceled.'}
					</p>
				</div>
			)}

			{/* Subscription status */}
			<div className="glass-panel p-6 mb-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-medium">Subscription</h3>
						<Badge variant={isSubscribed ? 'default' : 'outline'} className="mt-1">
							{isSubscribed ? 'Active' : (billing?.subscriptionStatus ?? 'None')}
						</Badge>
					</div>
					{isSubscribed || isPastDue || isCanceled ? (
						<a
							href="https://polar.sh/settings/subscriptions"
							target="_blank"
							rel="noopener noreferrer"
						>
							<Button variant="outline" size="sm">
								Manage subscription
								<ExternalLink className="h-3 w-3 ml-2" />
							</Button>
						</a>
					) : (
						<a href="https://polar.sh" target="_blank" rel="noopener noreferrer">
							<Button size="sm">
								<CreditCard className="h-4 w-4 mr-2" />
								Subscribe — ${PREMIUM_PRICE.base / 100}/mo
							</Button>
						</a>
					)}
				</div>
				{isSubscribed && billing && (
					<p className="text-sm text-muted-foreground">
						{billing.quota.used} of {billing.quota.total} premium servers used
						{billing.quota.available > 0 && ` — ${billing.quota.available} available`}
					</p>
				)}
			</div>

			{/* Assigned servers */}
			{isSubscribed && billing && (
				<div className="glass-panel p-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="font-medium">Premium Servers</h3>
						{billing.quota.available > 0 && (
							<Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Add server
							</Button>
						)}
					</div>

					{billing.assignments.length === 0 ? (
						<EmptyState
							icon={Server}
							title="No servers assigned"
							description="Assign premium to a server to unlock higher limits."
							action={
								<Button size="sm" onClick={() => setAddOpen(true)}>
									<Plus className="h-4 w-4 mr-2" />
									Add server
								</Button>
							}
						/>
					) : (
						<div className="space-y-3">
							{billing.assignments.map((assignment) => (
								<div
									key={assignment.id}
									className="flex items-center justify-between p-3 rounded-lg bg-surface-raised"
								>
									<div className="flex items-center gap-3">
										<Avatar className="h-8 w-8">
											<AvatarImage src={assignment.guildIconUrl ?? undefined} />
											<AvatarFallback>{assignment.guildName[0]?.toUpperCase()}</AvatarFallback>
										</Avatar>
										<span className="text-sm font-medium">{assignment.guildName}</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setRemoveGuildId(assignment.guildId)}
									>
										<Minus className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Add server dialog */}
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Premium Server</DialogTitle>
					</DialogHeader>
					{eligibleGuilds.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">
							No eligible servers. All your servers already have premium or you need admin
							permissions.
						</p>
					) : (
						<div className="space-y-2">
							{eligibleGuilds.map((guild) => (
								<button
									key={guild.id}
									type="button"
									className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised w-full hover:bg-glass-50 transition-colors"
									onClick={() => {
										assignPremium.mutate(guild.id, { onSuccess: () => setAddOpen(false) })
									}}
									disabled={assignPremium.isPending}
								>
									<Avatar className="h-8 w-8">
										<AvatarImage src={guild.iconUrl ?? undefined} />
										<AvatarFallback>{guild.name[0]?.toUpperCase()}</AvatarFallback>
									</Avatar>
									<span className="text-sm font-medium">{guild.name}</span>
								</button>
							))}
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Remove confirm */}
			<ConfirmDialog
				open={removeGuildId !== null}
				onOpenChange={() => setRemoveGuildId(null)}
				title="Remove premium"
				description="This server will immediately drop to the free tier. Higher limits and features will be lost."
				confirmLabel="Remove"
				destructive
				loading={unassignPremium.isPending}
				onConfirm={() => {
					if (removeGuildId) {
						unassignPremium.mutate(removeGuildId, { onSuccess: () => setRemoveGuildId(null) })
					}
				}}
			/>
		</div>
	)
}
