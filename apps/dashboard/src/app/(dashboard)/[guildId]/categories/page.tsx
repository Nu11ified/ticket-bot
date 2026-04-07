'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from '@/components/ui/sheet'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { RequirePermission } from '@/components/require-permission'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
	useCategories,
	useCreateCategory,
	useUpdateCategory,
	useDeleteCategory,
	type Category,
} from '@/hooks/use-categories'
import { categorySchema, type CategoryFormData } from '@/schemas/category'

export default function CategoriesPage() {
	const params = useParams()
	const guildId = Number(params.guildId)

	const { data: categories = [], isLoading } = useCategories(guildId)
	const createCategory = useCreateCategory(guildId)
	const updateCategory = useUpdateCategory(guildId)
	const deleteCategory = useDeleteCategory(guildId)

	const [sheetOpen, setSheetOpen] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<CategoryFormData>({
		resolver: standardSchemaResolver(categorySchema),
	})

	function onSubmit(data: CategoryFormData) {
		createCategory.mutate(data, {
			onSuccess() {
				reset()
				setSheetOpen(false)
			},
		})
	}

	function handleToggleEnabled(category: Category) {
		updateCategory.mutate({
			categoryId: category.id,
			isEnabled: !category.isEnabled,
		})
	}

	function handleConfirmDelete() {
		if (!deleteTarget) return
		deleteCategory.mutate(deleteTarget.id, {
			onSuccess() {
				setDeleteTarget(null)
			},
		})
	}

	const columns: Column<Category>[] = [
		{
			key: 'emoji',
			header: 'Emoji',
			className: 'w-16',
			cell: (row) => <span>{row.emoji ?? '--'}</span>,
		},
		{
			key: 'name',
			header: 'Name',
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: 'channelMode',
			header: 'Channel Mode',
			cell: (row) => <span className="capitalize">{row.channelMode}</span>,
		},
		{
			key: 'maxOpenPerUser',
			header: 'Max Open',
			cell: (row) => <span>{row.maxOpenPerUser}</span>,
		},
		{
			key: 'enabled',
			header: 'Enabled',
			cell: (row) => (
				<Switch
					checked={row.isEnabled}
					onCheckedChange={() => handleToggleEnabled(row)}
					size="sm"
				/>
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
		<RequirePermission permission="admin.manage_categories">
			<PageHeader
				title="Categories"
				actions={
					<Button onClick={() => setSheetOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Category
					</Button>
				}
			/>

			<DataTable
				columns={columns}
				data={categories}
				isLoading={isLoading}
				emptyState={
					<EmptyState
						icon={FolderOpen}
						title="No categories"
						description="Create your first category to start organizing tickets."
						action={
							<Button onClick={() => setSheetOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								New Category
							</Button>
						}
					/>
				}
			/>

			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>New Category</SheetTitle>
						<SheetDescription>
							Create a new ticket category for your server.
						</SheetDescription>
					</SheetHeader>
					<form
						onSubmit={handleSubmit(onSubmit)}
						className="flex flex-col gap-4 px-4 flex-1"
					>
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input id="name" placeholder="General Support" {...register('name')} />
							{errors.name && (
								<p className="text-sm text-destructive">{errors.name.message}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="emoji">Emoji</Label>
							<Input id="emoji" placeholder="🎫" {...register('emoji')} />
							{errors.emoji && (
								<p className="text-sm text-destructive">{errors.emoji.message}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								placeholder="Describe what this category is for..."
								{...register('description')}
							/>
							{errors.description && (
								<p className="text-sm text-destructive">{errors.description.message}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="maxOpenPerUser">Max Open Per User</Label>
							<Input
								id="maxOpenPerUser"
								type="number"
								placeholder="1"
								{...register('maxOpenPerUser', { valueAsNumber: true })}
							/>
							<p className="text-sm text-muted-foreground">
								Maximum tickets a user can have open in this category
							</p>
							{errors.maxOpenPerUser && (
								<p className="text-sm text-destructive">{errors.maxOpenPerUser.message}</p>
							)}
						</div>

						<SheetFooter>
							<Button type="submit" disabled={createCategory.isPending}>
								{createCategory.isPending ? 'Creating...' : 'Create Category'}
							</Button>
						</SheetFooter>
					</form>
				</SheetContent>
			</Sheet>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null)
				}}
				title="Delete category"
				description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
				confirmLabel="Delete"
				destructive
				onConfirm={handleConfirmDelete}
				loading={deleteCategory.isPending}
			/>
		</RequirePermission>
	)
}
