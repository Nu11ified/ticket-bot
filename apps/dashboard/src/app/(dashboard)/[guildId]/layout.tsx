'use client'

import { useParams, redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { useGuildDetails, useGuildPermissions } from '@/hooks/use-guilds'
import { GuildProvider } from '@/providers/guild-provider'
import { PermissionProvider } from '@/providers/permission-provider'

export default function GuildLayout({ children }: { children: React.ReactNode }) {
	const params = useParams()
	const guildId = Number(params.guildId)

	const { data: guild, isLoading: guildLoading, error: guildError } = useGuildDetails(guildId)
	const { data: permissions, isLoading: permsLoading } = useGuildPermissions(guildId)

	if (guildLoading || permsLoading) {
		return (
			<div className="flex h-[calc(100vh-3.5rem)]">
				<div className="w-64 border-r border-glass-100 p-4 hidden lg:block">
					<Skeleton className="h-10 w-full mb-6" />
					<div className="space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-8 w-full" />
						))}
					</div>
				</div>
				<div className="flex-1 p-6">
					<Skeleton className="h-8 w-48 mb-4" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		)
	}

	if (guildError || !guild) {
		redirect('/guilds')
	}

	return (
		<GuildProvider guild={guild}>
			<PermissionProvider permissions={permissions ?? []}>
				<div className="flex h-[calc(100vh-3.5rem)]">
					<div className="hidden lg:block">
						<Sidebar guildId={guildId} />
					</div>
					<div className="flex-1 overflow-y-auto">
						<div className="lg:hidden border-b border-glass-100 px-4 py-2">
							<MobileNav guildId={guildId} />
						</div>
						<div className="p-6">{children}</div>
					</div>
				</div>
			</PermissionProvider>
		</GuildProvider>
	)
}
