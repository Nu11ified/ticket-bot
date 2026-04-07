'use client'

import { RefreshCw, Server } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useGuilds, useRefreshGuilds } from '@/hooks/use-guilds'

export default function GuildsPage() {
	const { data: guilds, isLoading } = useGuilds()
	const refreshGuilds = useRefreshGuilds()

	return (
		<div className="max-w-4xl mx-auto p-6">
			<PageHeader
				title="Your Servers"
				description="Select a server to manage"
				actions={
					<Button
						variant="outline"
						size="sm"
						onClick={() => refreshGuilds.mutate()}
						disabled={refreshGuilds.isPending}
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${refreshGuilds.isPending ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				}
			/>
			{isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))}
				</div>
			) : !guilds?.length ? (
				<EmptyState
					icon={Server}
					title="No servers found"
					description="Add TicketBot to a Discord server to get started."
				/>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{guilds.map((guild) => (
						<Link
							key={guild.id}
							href={`/${guild.id}/tickets`}
							className="glass-panel p-4 flex items-center gap-4 transition-all"
						>
							<Avatar className="h-12 w-12">
								<AvatarImage src={guild.iconUrl ?? undefined} />
								<AvatarFallback>{guild.name[0]?.toUpperCase()}</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<p className="font-medium truncate">{guild.name}</p>
								<Badge variant="outline" className="mt-1 text-xs">
									{guild.planTier === 'premium' ? 'Premium' : 'Free'}
								</Badge>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	)
}
