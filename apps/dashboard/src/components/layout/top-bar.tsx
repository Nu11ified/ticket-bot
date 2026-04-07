'use client'

import { CreditCard, LogOut, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/providers/user-provider'

export function TopBar({ planTier }: { planTier?: string }) {
	const user = useCurrentUser()

	return (
		<header className="sticky top-0 z-40 border-b border-glass-100 bg-surface/80 backdrop-blur-lg">
			<div className="flex h-14 items-center justify-between px-4">
				<div className="flex items-center gap-3">
					<Link href="/guilds" className="text-lg font-semibold">
						TicketBot
					</Link>
				</div>
				<div className="flex items-center gap-3">
					{planTier && (
						<Link href="/billing">
							<Badge variant={planTier === 'premium' ? 'default' : 'outline'}>
								{planTier === 'premium' ? 'Premium' : 'Free'}
							</Badge>
						</Link>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" className="h-8 w-8 rounded-full p-0">
									<Avatar className="h-8 w-8">
										<AvatarImage src={user.avatarUrl ?? undefined} />
										<AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
									</Avatar>
								</Button>
							}
						/>
						<DropdownMenuContent align="end" className="w-48">
							<div className="px-2 py-1.5 text-sm font-medium">{user.displayName ?? user.username}</div>
							<DropdownMenuSeparator />
							<DropdownMenuItem render={<Link href="/guilds" />}>
								<RefreshCw className="mr-2 h-4 w-4" />
								Switch guild
							</DropdownMenuItem>
							<DropdownMenuItem render={<Link href="/billing" />}>
								<CreditCard className="mr-2 h-4 w-4" />
								Billing
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								render={<a href={`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/sign-out`} />}
							>
								<LogOut className="mr-2 h-4 w-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	)
}
