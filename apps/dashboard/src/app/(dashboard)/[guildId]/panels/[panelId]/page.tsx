'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { ArrowLeft, Plus, Rocket, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import {
	usePanelDetail,
	useUpdatePanel,
	useDeployPanel,
	useAddPanelButton,
	useRemovePanelButton,
} from '@/hooks/use-panels'
import { useCategories } from '@/hooks/use-categories'
import { panelSchema, type PanelFormData } from '@/schemas/panel'

const BUTTON_STYLES = [
	{ value: 'Primary', label: 'Primary (Blue)' },
	{ value: 'Secondary', label: 'Secondary (Grey)' },
	{ value: 'Success', label: 'Success (Green)' },
	{ value: 'Danger', label: 'Danger (Red)' },
]

const STYLE_COLORS: Record<string, string> = {
	Primary: 'bg-[#5865F2] text-white',
	Secondary: 'bg-[#4F545C] text-white',
	Success: 'bg-[#2D7D46] text-white',
	Danger: 'bg-[#D83C3E] text-white',
}

function numberToHex(n: number | null | undefined): string {
	if (n == null) return '#5865F2'
	return `#${n.toString(16).padStart(6, '0')}`
}

function hexToNumber(hex: string): number | null {
	const cleaned = hex.replace('#', '')
	if (cleaned.length !== 6) return null
	const n = parseInt(cleaned, 16)
	if (Number.isNaN(n)) return null
	return n
}

export default function PanelEditorPage() {
	const params = useParams()
	const router = useRouter()
	const guildId = Number(params.guildId)
	const panelId = Number(params.panelId)

	const { data: panel, isLoading } = usePanelDetail(guildId, panelId)
	const { data: categories = [] } = useCategories(guildId)
	const updatePanel = useUpdatePanel(guildId, panelId)
	const deployPanel = useDeployPanel(guildId)
	const addButton = useAddPanelButton(guildId, panelId)
	const removeButton = useRemovePanelButton(guildId, panelId)

	const [addButtonOpen, setAddButtonOpen] = useState(false)
	const [newButtonCategoryId, setNewButtonCategoryId] = useState<string>('')
	const [newButtonLabel, setNewButtonLabel] = useState('')
	const [newButtonEmoji, setNewButtonEmoji] = useState('')
	const [newButtonStyle, setNewButtonStyle] = useState('Primary')

	const [colorHex, setColorHex] = useState('#5865F2')

	const {
		register,
		handleSubmit,
		reset,
		watch,
		setValue,
		formState: { errors, isDirty },
	} = useForm<PanelFormData>({
		resolver: standardSchemaResolver(panelSchema),
	})

	useEffect(() => {
		if (panel) {
			reset({
				name: panel.name,
				embedTitle: panel.embedTitle ?? '',
				embedDescription: panel.embedDescription ?? '',
				embedColor: panel.embedColor,
				embedThumbnailUrl: panel.embedThumbnailUrl ?? '',
				embedFooterText: panel.embedFooterText ?? '',
				channelId: panel.channelId ?? '',
			})
			setColorHex(numberToHex(panel.embedColor))
		}
	}, [panel, reset])

	const watchedTitle = watch('embedTitle')
	const watchedDescription = watch('embedDescription')
	const watchedFooter = watch('embedFooterText')

	function onSubmit(data: PanelFormData) {
		updatePanel.mutate({
			...data,
			embedColor: hexToNumber(colorHex),
			embedTitle: data.embedTitle || null,
			embedDescription: data.embedDescription || null,
			embedThumbnailUrl: data.embedThumbnailUrl || null,
			embedFooterText: data.embedFooterText || null,
			channelId: data.channelId || null,
		})
	}

	function handleAddButton() {
		if (!newButtonCategoryId || !newButtonLabel.trim()) return
		addButton.mutate(
			{
				categoryId: Number(newButtonCategoryId),
				label: newButtonLabel.trim(),
				emoji: newButtonEmoji.trim() || undefined,
				style: newButtonStyle,
			},
			{
				onSuccess() {
					setNewButtonCategoryId('')
					setNewButtonLabel('')
					setNewButtonEmoji('')
					setNewButtonStyle('Primary')
					setAddButtonOpen(false)
				},
			},
		)
	}

	function handleDeploy() {
		deployPanel.mutate(panelId)
	}

	if (isLoading) {
		return (
			<RequirePermission permission="admin.manage_panels">
				<div className="space-y-4">
					<div className="h-8 w-48 bg-muted animate-pulse rounded" />
					<div className="h-64 bg-muted animate-pulse rounded" />
				</div>
			</RequirePermission>
		)
	}

	if (!panel) {
		return (
			<RequirePermission permission="admin.manage_panels">
				<div className="text-center py-16 text-muted-foreground">
					Panel not found
				</div>
			</RequirePermission>
		)
	}

	return (
		<RequirePermission permission="admin.manage_panels">
			<div className="mb-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => router.push(`/${guildId}/panels`)}
				>
					<ArrowLeft className="h-4 w-4 mr-1" />
					Back to panels
				</Button>
			</div>

			<PageHeader
				title={panel.name}
				actions={
					<Button onClick={handleDeploy} disabled={deployPanel.isPending}>
						<Rocket className="h-4 w-4 mr-2" />
						{deployPanel.isPending ? 'Deploying...' : 'Deploy'}
					</Button>
				}
			/>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Left column: Form */}
				<div className="space-y-6">
					<form
						onSubmit={handleSubmit(onSubmit)}
						className="space-y-6"
					>
						{/* Panel settings */}
						<div className="glass-panel p-6 space-y-4">
							<h3 className="text-sm font-medium">Panel Settings</h3>
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input id="name" placeholder="Support Panel" {...register('name')} />
								{errors.name && (
									<p className="text-sm text-destructive">{errors.name.message}</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="channelId">Channel ID</Label>
								<Input
									id="channelId"
									placeholder="Channel ID to send panel to"
									{...register('channelId')}
								/>
								<p className="text-sm text-muted-foreground">
									The Discord channel where this panel will be sent
								</p>
								{errors.channelId && (
									<p className="text-sm text-destructive">{errors.channelId.message}</p>
								)}
							</div>
						</div>

						{/* Embed settings */}
						<div className="glass-panel p-6 space-y-4">
							<h3 className="text-sm font-medium">Embed</h3>
							<div className="space-y-2">
								<Label htmlFor="embedTitle">Title</Label>
								<Input
									id="embedTitle"
									placeholder="Embed title"
									{...register('embedTitle')}
								/>
								{errors.embedTitle && (
									<p className="text-sm text-destructive">{errors.embedTitle.message}</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="embedDescription">Description</Label>
								<Textarea
									id="embedDescription"
									placeholder="Embed description..."
									{...register('embedDescription')}
								/>
								{errors.embedDescription && (
									<p className="text-sm text-destructive">{errors.embedDescription.message}</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="embedColor">Color</Label>
								<div className="flex items-center gap-3">
									<input
										type="color"
										id="embedColor"
										value={colorHex}
										onChange={(e) => {
											setColorHex(e.target.value)
											setValue('embedColor', hexToNumber(e.target.value), { shouldDirty: true })
										}}
										className="h-8 w-12 cursor-pointer rounded border border-input bg-transparent"
									/>
									<Input
										value={colorHex}
										onChange={(e) => {
											setColorHex(e.target.value)
											setValue('embedColor', hexToNumber(e.target.value), { shouldDirty: true })
										}}
										className="w-28"
										placeholder="#5865F2"
									/>
								</div>
								{errors.embedColor && (
									<p className="text-sm text-destructive">{errors.embedColor.message}</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="embedFooterText">Footer</Label>
								<Input
									id="embedFooterText"
									placeholder="Footer text"
									{...register('embedFooterText')}
								/>
								{errors.embedFooterText && (
									<p className="text-sm text-destructive">{errors.embedFooterText.message}</p>
								)}
							</div>
						</div>

						<Button type="submit" disabled={updatePanel.isPending || !isDirty}>
							<Save className="h-4 w-4 mr-2" />
							{updatePanel.isPending ? 'Saving...' : 'Save changes'}
						</Button>
					</form>

					{/* Buttons section (outside form to avoid nested forms) */}
					<div className="glass-panel p-6 space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-medium">Buttons</h3>
							<Button size="sm" onClick={() => setAddButtonOpen(true)}>
								<Plus className="h-4 w-4 mr-1" />
								Add
							</Button>
						</div>
						{panel.buttons.length === 0 ? (
							<p className="text-sm text-muted-foreground py-4 text-center">
								No buttons yet. Add a button to link a category to this panel.
							</p>
						) : (
							<div className="space-y-2">
								{panel.buttons.map((btn) => {
									const category = categories.find((c) => c.id === btn.categoryId)
									return (
										<div
											key={btn.id}
											className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
										>
											<div className="flex items-center gap-2">
												{btn.emoji && <span>{btn.emoji}</span>}
												<span className="text-sm font-medium">{btn.label}</span>
												<span className="text-xs text-muted-foreground">
													{category?.name ?? `Category #${btn.categoryId}`}
												</span>
												<span className="text-xs text-muted-foreground capitalize">
													({btn.style})
												</span>
											</div>
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={() => removeButton.mutate(btn.id)}
											>
												<X className="h-4 w-4 text-muted-foreground" />
											</Button>
										</div>
									)
								})}
							</div>
						)}
					</div>
				</div>

				{/* Right column: Preview */}
				<div className="space-y-4">
					<h3 className="text-sm font-medium">Preview</h3>
					{/* Discord embed preview */}
					<div className="rounded-lg bg-[#2B2D31] p-4">
						<div
							className="rounded border-l-4 bg-[#2F3136] p-4"
							style={{ borderLeftColor: colorHex }}
						>
							{(watchedTitle) && (
								<div className="font-semibold text-white text-sm mb-1">
									{watchedTitle}
								</div>
							)}
							{(watchedDescription) && (
								<div className="text-[#DCDDDE] text-sm whitespace-pre-wrap">
									{watchedDescription}
								</div>
							)}
							{!watchedTitle && !watchedDescription && (
								<div className="text-[#72767D] text-sm italic">
									Empty embed -- fill in the title and description above
								</div>
							)}
							{(watchedFooter) && (
								<div className="mt-3 pt-2 border-t border-[#3F4147] text-xs text-[#72767D]">
									{watchedFooter}
								</div>
							)}
						</div>

						{/* Button preview */}
						{panel.buttons.length > 0 && (
							<div className="flex flex-wrap gap-2 mt-2">
								{panel.buttons.map((btn) => (
									<span
										key={btn.id}
										className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium ${
											STYLE_COLORS[btn.style] ?? STYLE_COLORS.Primary
										}`}
									>
										{btn.emoji && <span>{btn.emoji}</span>}
										{btn.label}
									</span>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Add button dialog */}
			<Dialog open={addButtonOpen} onOpenChange={setAddButtonOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Button</DialogTitle>
						<DialogDescription>
							Link a category to a button on this panel.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>Category</Label>
							<Select
								value={newButtonCategoryId}
								onValueChange={(v) => setNewButtonCategoryId(v ?? '')}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select a category" />
								</SelectTrigger>
								<SelectContent>
									{categories.map((cat) => (
										<SelectItem key={cat.id} value={String(cat.id)}>
											{cat.emoji && `${cat.emoji} `}{cat.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="btn-label">Label</Label>
							<Input
								id="btn-label"
								placeholder="Open Ticket"
								value={newButtonLabel}
								onChange={(e) => setNewButtonLabel(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="btn-emoji">Emoji (optional)</Label>
							<Input
								id="btn-emoji"
								placeholder="🎫"
								value={newButtonEmoji}
								onChange={(e) => setNewButtonEmoji(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Style</Label>
							<Select value={newButtonStyle} onValueChange={(v) => setNewButtonStyle(v ?? 'Primary')}>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BUTTON_STYLES.map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button
							onClick={handleAddButton}
							disabled={addButton.isPending || !newButtonCategoryId || !newButtonLabel.trim()}
						>
							{addButton.isPending ? 'Adding...' : 'Add Button'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</RequirePermission>
	)
}
