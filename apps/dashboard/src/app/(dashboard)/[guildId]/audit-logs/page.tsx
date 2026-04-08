'use client'

import { CursorPagination } from '@/components/cursor-pagination'
import { type Column, DataTable } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { Badge } from '@/components/ui/badge'
import { type AuditLog, useAuditLogs } from '@/hooks/use-audit-logs'
import { ScrollText } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const actionOptions = [
	{ label: 'Ticket Created', value: 'ticket.created' },
	{ label: 'Ticket Closed', value: 'ticket.closed' },
	{ label: 'Status Changed', value: 'ticket.status_changed' },
	{ label: 'Settings Updated', value: 'settings.updated' },
	{ label: 'Category Created', value: 'category.created' },
	{ label: 'Panel Deployed', value: 'panel.deployed' },
	{ label: 'API Key Created', value: 'api_key.created' },
	{ label: 'API Key Revoked', value: 'api_key.revoked' },
]

export default function AuditLogsPage() {
	const params = useParams()
	const guildId = Number(params.guildId)

	const [filters, setFilters] = useState<Record<string, string | undefined>>({})
	const [cursorStack, setCursorStack] = useState<string[]>([])
	const [currentCursor, setCurrentCursor] = useState<string | undefined>()

	const { data, isLoading } = useAuditLogs(guildId, { ...filters, cursor: currentCursor })

	const columns: Column<AuditLog>[] = [
		{
			key: 'createdAt',
			header: 'Time',
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{new Date(row.createdAt).toLocaleString()}
				</span>
			),
			className: 'w-44',
		},
		{
			key: 'actor',
			header: 'Actor',
			cell: (row) => (
				<span className="text-sm">
					{row.actorDisplayName ?? row.actorUsername ?? row.actorDiscordId}
				</span>
			),
		},
		{
			key: 'action',
			header: 'Action',
			cell: (row) => (
				<Badge variant="outline" className="font-mono text-xs">
					{row.action}
				</Badge>
			),
		},
		{
			key: 'metadata',
			header: 'Details',
			cell: (row) => (
				<span className="text-xs text-muted-foreground truncate max-w-xs block">
					{JSON.stringify(row.metadata)}
				</span>
			),
		},
	]

	return (
		<RequirePermission permission="admin.view_audit_logs">
			<PageHeader title="Audit Logs" description="Track all actions in this server" />

			<FilterBar
				filters={[{ key: 'action', label: 'Action', options: actionOptions }]}
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
					emptyState={
						<EmptyState
							icon={ScrollText}
							title="No audit logs"
							description="Actions will appear here as they happen."
						/>
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
