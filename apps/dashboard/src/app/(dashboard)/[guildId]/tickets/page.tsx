'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Ticket } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import { CursorPagination } from '@/components/cursor-pagination'
import { EmptyState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PriorityBadge } from '@/components/priority-badge'
import { RequirePermission } from '@/components/require-permission'
import { StatusBadge } from '@/components/status-badge'
import { useTickets } from '@/hooks/use-tickets'
import type { TicketPriority, TicketStatus } from '@ticketbot/shared'

const statusOptions = [
	{ label: 'Open', value: 'open' },
	{ label: 'Pending', value: 'pending' },
	{ label: 'Waiting User', value: 'waiting_user' },
	{ label: 'Waiting Staff', value: 'waiting_staff' },
	{ label: 'Escalated', value: 'escalated' },
	{ label: 'Resolved', value: 'resolved' },
	{ label: 'Closed', value: 'closed' },
]

const priorityOptions = [
	{ label: 'Low', value: 'low' },
	{ label: 'Normal', value: 'normal' },
	{ label: 'High', value: 'high' },
	{ label: 'Urgent', value: 'urgent' },
]

export default function TicketsPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)

	const [filters, setFilters] = useState<Record<string, string | undefined>>({})
	const [cursorStack, setCursorStack] = useState<string[]>([])
	const [currentCursor, setCurrentCursor] = useState<string | undefined>()

	const { data, isLoading } = useTickets(guildId, {
		...filters,
		cursor: currentCursor,
	})

	const columns: Column<NonNullable<typeof data>['data'][number]>[] = [
		{
			key: 'ticketNumber',
			header: '#',
			cell: (row) => <span className="font-mono text-sm">#{row.ticketNumber}</span>,
			className: 'w-20',
		},
		{ key: 'subject', header: 'Subject', cell: (row) => <span className="font-medium">{row.subject}</span> },
		{ key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status as TicketStatus} /> },
		{ key: 'priority', header: 'Priority', cell: (row) => <PriorityBadge priority={row.priority as TicketPriority} /> },
		{ key: 'categoryName', header: 'Category', cell: (row) => row.categoryName ?? '\u2014' },
		{
			key: 'createdAt',
			header: 'Created',
			cell: (row) => new Date(row.createdAt).toLocaleDateString(),
		},
	]

	return (
		<RequirePermission permission="tickets.view">
			<PageHeader title="Tickets" description="View and manage support tickets" />

			<FilterBar
				filters={[
					{ key: 'status', label: 'Status', options: statusOptions },
					{ key: 'priority', label: 'Priority', options: priorityOptions },
				]}
				values={filters}
				onChange={(key, value) => {
					setFilters((prev) => ({ ...prev, [key]: value }))
					setCursorStack([])
					setCurrentCursor(undefined)
				}}
			/>

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={data?.data ?? []}
					isLoading={isLoading}
					onRowClick={(row) => router.push(`/${guildId}/tickets/${row.id}`)}
					emptyState={
						<EmptyState icon={Ticket} title="No tickets" description="No tickets match your filters." />
					}
				/>
			</div>

			{data && (
				<CursorPagination
					hasMore={data.pagination.hasMore}
					hasPrev={cursorStack.length > 0}
					onNext={() => {
						if (data.pagination.cursor) {
							setCursorStack((prev) => [...prev, currentCursor ?? ''])
							setCurrentCursor(data.pagination.cursor)
						}
					}}
					onPrev={() => {
						const prev = cursorStack[cursorStack.length - 1]
						setCursorStack((s) => s.slice(0, -1))
						setCurrentCursor(prev || undefined)
					}}
				/>
			)}
		</RequirePermission>
	)
}
