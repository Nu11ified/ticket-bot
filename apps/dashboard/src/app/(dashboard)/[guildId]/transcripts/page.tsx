'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/data-table'
import { CursorPagination } from '@/components/cursor-pagination'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useTranscripts, type Transcript } from '@/hooks/use-transcripts'
import { useHasPermission } from '@/providers/permission-provider'

export default function TranscriptsPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const canExport = useHasPermission('transcripts.export')

	const [cursorStack, setCursorStack] = useState<string[]>([])
	const [currentCursor, setCurrentCursor] = useState<string | undefined>()

	const { data, isLoading } = useTranscripts(guildId, currentCursor)

	const columns: Column<Transcript>[] = [
		{
			key: 'ticketNumber',
			header: 'Ticket',
			cell: (row) => <span className="font-mono">#{row.ticketNumber}</span>,
		},
		{ key: 'messageCount', header: 'Messages', cell: (row) => row.messageCount },
		{
			key: 'createdAt',
			header: 'Created',
			cell: (row) => new Date(row.createdAt).toLocaleDateString(),
		},
		{
			key: 'actions',
			header: '',
			cell: (row) =>
				canExport ? (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="sm">
									<Download className="h-4 w-4" />
								</Button>
							}
						/>
						<DropdownMenuContent>
							<DropdownMenuItem
								onClick={() =>
									window.open(
										`/api/guilds/${guildId}/transcripts/${row.id}/export?format=html`,
										'_blank',
									)
								}
							>
								Export HTML
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									window.open(
										`/api/guilds/${guildId}/transcripts/${row.id}/export?format=json`,
										'_blank',
									)
								}
							>
								Export JSON
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null,
			className: 'w-10',
		},
	]

	return (
		<RequirePermission permission="transcripts.view">
			<PageHeader title="Transcripts" description="Browse closed ticket transcripts" />

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={data?.data ?? []}
					isLoading={isLoading}
					emptyState={
						<EmptyState
							icon={FileText}
							title="No transcripts"
							description="Transcripts appear when tickets are closed."
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
