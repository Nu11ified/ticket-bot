'use client'

import { TopBar } from '@/components/layout/top-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'
import { UserProvider } from '@/providers/user-provider'
import { redirect } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { data: user, isLoading, error } = useUser()

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Skeleton className="h-8 w-48" />
			</div>
		)
	}

	if (error || !user) {
		redirect('/login')
	}

	return (
		<UserProvider user={user}>
			<TopBar />
			<main>{children}</main>
		</UserProvider>
	)
}
