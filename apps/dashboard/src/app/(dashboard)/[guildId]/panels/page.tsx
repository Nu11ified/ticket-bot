'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LayoutGrid, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { RequirePermission } from '@/components/require-permission'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePanels, useCreatePanel, useDeletePanel, type Panel } from '@/hooks/use-panels'

export default function PanelsPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)

	const { data: panels = [], isLoading } = usePanels(guildId)
	const createPanel = useCreatePanel(guildId)
	const deletePanel = useDeletePanel(guildId)

	const [createOpen, setCreateOpen] = useState(false)
	const [newName, setNewName] = useState('')
	const [deleteTarget, setDeleteTarget] = useState<Panel | null>(null)

	function handleCreate() {
		if (!newName.trim()) return
		createPanel.mutate(
			{ name: newName.trim() },
			{
				onSuccess() {
					setNewName('')
					setCreateOpen(false)
				},
			},
		)
	}

	function handleConfirmDelete() {
		if (!deleteTarget) return
		deletePanel.mutate(deleteTarget.id, {
			onSuccess() {
				setDeleteTarget(null)
			},
		})
	}

	const columns: Column<Panel>[] = [
		{
			key: 'name',
			header: 'Name',
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: 'channelId',
			header: 'Channel',
			cell: (row) => (
				<span className="text-muted-foreground">{row.channelId ?? '--'}</span>
			),
		},
		{
			key: 'isPublished',
			header: 'Status',
			cell: (row) =>
				row.isPublished ? (
					<Badge variant="default">Published</Badge>
				) : (
					<Badge variant="secondary">Draft</Badge>
				),
		},
		{
			key: 'actions',
			header: '',
			className: 'w-12',
			cell: (row) => (
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={(e) => {
						e.stopPropagation()
						setDeleteTarget(row)
					}}
				>
					<Trash2 className="h-4 w-4 text-muted-foreground" />
				</Button>
			),
		},
	]

	return (
		<RequirePermission permission="admin.manage_panels">
			<PageHeader
				title="Panels"
				actions={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Panel
					</Button>
				}
			/>

			<DataTable
				columns={columns}
				data={panels}
				isLoading={isLoading}
				onRowClick={(row) => router.push(`/${guildId}/panels/${row.id}`)}
				emptyState={
					<EmptyState
						icon={LayoutGrid}
						title="No panels"
						description="Create your first panel to set up ticket buttons in your Discord server."
						action={
							<Button onClick={() => setCreateOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								New Panel
							</Button>
						}
					/>
				}
			/>

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New Panel</DialogTitle>
						<DialogDescription>
							Create a new panel for your server.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="panel-name">Name</Label>
						<Input
							id="panel-name"
							placeholder="Support Panel"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault()
									handleCreate()
								}
							}}
						/>
					</div>
					<DialogFooter>
						<Button
							onClick={handleCreate}
							disabled={createPanel.isPending || !newName.trim()}
						>
							{createPanel.isPending ? 'Creating...' : 'Create Panel'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null)
				}}
				title="Delete panel"
				description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
				confirmLabel="Delete"
				destructive
				onConfirm={handleConfirmDelete}
				loading={deletePanel.isPending}
			/>
		</RequirePermission>
	)
}
