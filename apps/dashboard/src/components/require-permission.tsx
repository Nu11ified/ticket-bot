'use client'

import { useHasPermission } from '@/providers/permission-provider'
import { ShieldX } from 'lucide-react'

export function RequirePermission({
	permission,
	children,
}: {
	permission: string
	children: React.ReactNode
}) {
	const hasPermission = useHasPermission(permission)

	if (!hasPermission) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
				<ShieldX className="h-12 w-12" />
				<h2 className="text-lg font-medium">Access denied</h2>
				<p className="text-sm">You don&apos;t have permission to view this page.</p>
			</div>
		)
	}

	return <>{children}</>
}
