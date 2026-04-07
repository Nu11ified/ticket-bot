'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { PriorityBadge } from '@/components/priority-badge'
import { RequirePermission } from '@/components/require-permission'
import { StatusBadge } from '@/components/status-badge'
import { useTicketDetail, useUpdateTicketStatus, useUpdateTicketPriority } from '@/hooks/use-tickets'
import { useHasPermission } from '@/providers/permission-provider'
import type { TicketPriority, TicketStatus } from '@ticketbot/shared'
import { cn } from '@/lib/utils'

const STATUSES: TicketStatus[] = ['open', 'pending', 'waiting_user', 'waiting_staff', 'escalated', 'resolved']
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent']

const statusLabels: Record<string, string> = {
	open: 'Open',
	pending: 'Pending',
	waiting_user: 'Waiting User',
	waiting_staff: 'Waiting Staff',
	escalated: 'Escalated',
	resolved: 'Resolved',
}

const priorityLabels: Record<string, string> = {
	low: 'Low',
	normal: 'Normal',
	high: 'High',
	urgent: 'Urgent',
}

export default function TicketDetailPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)
	const ticketId = Number(params.ticketId)
	const canManage = useHasPermission('tickets.manage')

	const { data: ticket, isLoading } = useTicketDetail(guildId, ticketId)
	const updateStatus = useUpdateTicketStatus(guildId)
	const updatePriority = useUpdateTicketPriority(guildId)

	if (isLoading) return <Skeleton className="h-96 w-full" />
	if (!ticket) return null

	return (
		<RequirePermission permission="tickets.view">
			<div className="mb-4">
				<Button variant="ghost" size="sm" onClick={() => router.push(`/${guildId}/tickets`)}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to tickets
				</Button>
			</div>

			<PageHeader title={`#${ticket.ticketNumber} \u2014 ${ticket.subject}`} />

			<div className="flex items-center gap-3 mb-6">
				<StatusBadge status={ticket.status as TicketStatus} />
				<PriorityBadge priority={ticket.priority as TicketPriority} />
				{ticket.categoryName && <Badge variant="outline">{ticket.categoryName}</Badge>}
			</div>

			{canManage && (
				<div className="flex gap-3 mb-6">
					<Select
						value={ticket.status}
						onValueChange={(status) => { if (status) updateStatus.mutate({ ticketId, status }) }}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue>
								{(value: string | null) =>
									value ? (statusLabels[value] ?? value) : 'Status'
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{STATUSES.map((s) => (
								<SelectItem key={s} value={s}>
									{statusLabels[s] ?? s}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={ticket.priority}
						onValueChange={(priority) => { if (priority) updatePriority.mutate({ ticketId, priority }) }}
					>
						<SelectTrigger className="w-[140px]">
							<SelectValue>
								{(value: string | null) =>
									value ? (priorityLabels[value] ?? value) : 'Priority'
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{PRIORITIES.map((p) => (
								<SelectItem key={p} value={p}>
									{priorityLabels[p] ?? p}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="space-y-4">
				{ticket.messages.map((msg) => (
					<div
						key={msg.id}
						className={cn(
							'glass-panel p-4',
							msg.isInternalNote && 'border-yellow-500/30 bg-yellow-500/5',
						)}
					>
						<div className="flex items-center gap-3 mb-2">
							<Avatar className="h-8 w-8">
								<AvatarImage src={msg.user?.avatarUrl ?? undefined} />
								<AvatarFallback>
									{msg.user?.username?.[0]?.toUpperCase() ?? '?'}
								</AvatarFallback>
							</Avatar>
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium">
									{msg.user?.displayName ?? msg.user?.username ?? 'Unknown'}
								</span>
								{msg.isStaff && (
									<Badge variant="outline" className="text-xs">
										Staff
									</Badge>
								)}
								{msg.isInternalNote && (
									<Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
										Internal
									</Badge>
								)}
								<span className="text-xs text-muted-foreground">
									{new Date(msg.createdAt).toLocaleString()}
								</span>
							</div>
						</div>
						<p className="text-sm whitespace-pre-wrap pl-11">{msg.content}</p>
					</div>
				))}
			</div>
		</RequirePermission>
	)
}
