'use client'

import {
	FileText,
	Key,
	LayoutGrid,
	Monitor,
	ScrollText,
	Settings,
	Shield,
	Ticket,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useGuild } from '@/providers/guild-provider'
import { useHasPermission } from '@/providers/permission-provider'

interface NavItem {
	label: string
	href: string
	icon: React.ElementType
	permission: string
}

interface NavGroup {
	label: string
	items: NavItem[]
}

const navGroups: NavGroup[] = [
	{
		label: 'Setup',
		items: [
			{ label: 'Settings', href: '/settings', icon: Settings, permission: 'admin.manage_settings' },
			{
				label: 'Categories',
				href: '/categories',
				icon: LayoutGrid,
				permission: 'admin.manage_categories',
			},
			{ label: 'Panels', href: '/panels', icon: Monitor, permission: 'admin.manage_panels' },
		],
	},
	{
		label: 'Support',
		items: [
			{ label: 'Tickets', href: '/tickets', icon: Ticket, permission: 'tickets.view' },
			{ label: 'Transcripts', href: '/transcripts', icon: FileText, permission: 'transcripts.view' },
		],
	},
	{
		label: 'Admin',
		items: [
			{ label: 'Roles', href: '/roles', icon: Shield, permission: 'admin.manage_roles' },
			{
				label: 'Audit Logs',
				href: '/audit-logs',
				icon: ScrollText,
				permission: 'admin.view_audit_logs',
			},
			{ label: 'API Keys', href: '/api-keys', icon: Key, permission: 'admin.manage_api_keys' },
		],
	},
]

export function Sidebar({ guildId }: { guildId: number }) {
	const guild = useGuild()
	const pathname = usePathname()

	return (
		<aside className="w-64 border-r border-glass-100 bg-surface h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
			<div className="p-4">
				<Link href="/guilds" className="flex items-center gap-3 mb-6">
					<Avatar className="h-10 w-10">
						<AvatarImage src={guild.iconUrl ?? undefined} />
						<AvatarFallback>{guild.name[0]?.toUpperCase()}</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<p className="font-medium text-sm truncate">{guild.name}</p>
						<p className="text-xs text-muted-foreground">Switch server</p>
					</div>
				</Link>

				<nav className="space-y-6">
					{navGroups.map((group) => (
						<SidebarGroup key={group.label} group={group} guildId={guildId} pathname={pathname} />
					))}
				</nav>
			</div>
		</aside>
	)
}

function SidebarGroup({
	group,
	guildId,
	pathname,
}: {
	group: NavGroup
	guildId: number
	pathname: string
}) {
	return (
		<div>
			<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
				{group.label}
			</p>
			<div className="space-y-1">
				{group.items.map((item) => (
					<SidebarItem key={item.href} item={item} guildId={guildId} pathname={pathname} />
				))}
			</div>
		</div>
	)
}

function SidebarItem({
	item,
	guildId,
	pathname,
}: {
	item: NavItem
	guildId: number
	pathname: string
}) {
	const hasPermission = useHasPermission(item.permission)
	if (!hasPermission) return null

	const href = `/${guildId}${item.href}`
	const isActive = pathname === href || pathname.startsWith(`${href}/`)
	return (
		<Link
			href={href}
			className={cn(
				'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
				isActive
					? 'bg-accent/20 text-accent-foreground'
					: 'text-muted-foreground hover:bg-glass-50 hover:text-foreground',
			)}
		>
			<item.icon className="h-4 w-4" />
			{item.label}
		</Link>
	)
}
