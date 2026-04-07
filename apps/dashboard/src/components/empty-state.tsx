import type { LucideIcon } from 'lucide-react'

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: LucideIcon
	title: string
	description: string
	action?: React.ReactNode
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
			<Icon className="h-10 w-10 text-muted-foreground" />
			<h3 className="text-base font-medium">{title}</h3>
			<p className="text-sm text-muted-foreground max-w-sm">{description}</p>
			{action}
		</div>
	)
}
