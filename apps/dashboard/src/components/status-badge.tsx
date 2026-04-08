import { Badge } from '@/components/ui/badge'
import type { TicketStatus } from '@ticketbot/shared'

const statusColors: Record<TicketStatus, string> = {
	open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
	pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
	waiting_user: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
	waiting_staff: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
	escalated: 'bg-red-500/20 text-red-400 border-red-500/30',
	resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
	closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
	archived: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
}

const statusLabels: Record<TicketStatus, string> = {
	open: 'Open',
	pending: 'Pending',
	waiting_user: 'Waiting User',
	waiting_staff: 'Waiting Staff',
	escalated: 'Escalated',
	resolved: 'Resolved',
	closed: 'Closed',
	archived: 'Archived',
}

export function StatusBadge({ status }: { status: TicketStatus }) {
	return (
		<Badge variant="outline" className={statusColors[status]}>
			{statusLabels[status]}
		</Badge>
	)
}
