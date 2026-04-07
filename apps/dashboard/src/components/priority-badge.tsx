import { Badge } from '@/components/ui/badge'
import type { TicketPriority } from '@ticketbot/shared'

const priorityColors: Record<TicketPriority, string> = {
	low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
	normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
	high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
	urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const priorityLabels: Record<TicketPriority, string> = {
	low: 'Low',
	normal: 'Normal',
	high: 'High',
	urgent: 'Urgent',
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
	return (
		<Badge variant="outline" className={priorityColors[priority]}>
			{priorityLabels[priority]}
		</Badge>
	)
}
