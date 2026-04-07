'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Copy, Key, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, type Column } from '@/components/data-table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useRotateApiKey, type ApiKey } from '@/hooks/use-api-keys'
import { apiKeySchema, type ApiKeyFormData } from '@/schemas/api-key'
import { API_KEY_PERMISSIONS } from '@ticketbot/shared'

const expiryOptions: Record<string, string> = {
	never: 'Never',
	'30': '30 days',
	'90': '90 days',
	'365': '1 year',
}

export default function ApiKeysPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const { data: keys, isLoading } = useApiKeys(guildId)
	const createKey = useCreateApiKey(guildId)
	const revokeKey = useRevokeApiKey(guildId)
	const rotateKey = useRotateApiKey(guildId)

	const [createOpen, setCreateOpen] = useState(false)
	const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
	const [revokeId, setRevokeId] = useState<number | null>(null)
	const [rotateId, setRotateId] = useState<number | null>(null)

	const form = useForm<ApiKeyFormData>({
		resolver: standardSchemaResolver(apiKeySchema),
		defaultValues: { name: '', permissions: [] },
	})

	const permissions = form.watch('permissions')
	const expiresInDays = form.watch('expiresInDays')

	const columns: Column<ApiKey>[] = [
		{ key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
		{
			key: 'keyPrefix',
			header: 'Key',
			cell: (row) => <code className="text-xs">{row.keyPrefix}...</code>,
		},
		{
			key: 'permissions',
			header: 'Permissions',
			cell: (row) => <span className="text-sm">{row.permissions.length}</span>,
		},
		{
			key: 'lastUsedAt',
			header: 'Last Used',
			cell: (row) =>
				row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleDateString() : 'Never',
		},
		{
			key: 'expiresAt',
			header: 'Expires',
			cell: (row) =>
				row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : 'Never',
		},
		{
			key: 'actions',
			header: '',
			cell: (row) => (
				<div className="flex gap-1">
					<Button variant="ghost" size="sm" onClick={() => setRotateId(row.id)}>
						<RotateCw className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="sm" onClick={() => setRevokeId(row.id)}>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</div>
			),
			className: 'w-24',
		},
	]

	return (
		<RequirePermission permission="admin.manage_api_keys">
			<PageHeader
				title="API Keys"
				description="Manage API keys for external integrations"
				actions={
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Key
					</Button>
				}
			/>

			<div className="glass-panel">
				<DataTable
					columns={columns}
					data={keys ?? []}
					isLoading={isLoading}
					emptyState={
						<EmptyState icon={Key} title="No API keys" description="Create an API key for external access." />
					}
				/>
			</div>

			{/* Create dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create API Key</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={form.handleSubmit((data) => {
							createKey.mutate(data, {
								onSuccess(res) {
									setNewKeyValue(res.data.key)
									setCreateOpen(false)
									form.reset()
								},
							})
						})}
						className="space-y-4"
					>
						<div className="space-y-2">
							<Label htmlFor="api-key-name">Name</Label>
							<Input id="api-key-name" {...form.register('name')} placeholder="My integration" />
							{form.formState.errors.name && (
								<p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label>Permissions</Label>
							<div className="space-y-2">
								{API_KEY_PERMISSIONS.map((perm) => (
									<label key={perm} className="flex items-center gap-2 cursor-pointer">
										<Checkbox
											checked={permissions.includes(perm)}
											onCheckedChange={(checked) => {
												const newPerms = checked
													? [...permissions, perm]
													: permissions.filter((p) => p !== perm)
												form.setValue('permissions', newPerms, { shouldValidate: true })
											}}
										/>
										<span className="text-sm font-mono">{perm}</span>
									</label>
								))}
							</div>
							{form.formState.errors.permissions && (
								<p className="text-sm text-destructive">{form.formState.errors.permissions.message}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label>Expiry</Label>
							<Select
								value={expiresInDays ? String(expiresInDays) : 'never'}
								onValueChange={(v) =>
									form.setValue('expiresInDays', v === 'never' ? undefined : (Number(v) as 30 | 90 | 365), { shouldValidate: true })
								}
							>
								<SelectTrigger>
									<SelectValue>
										{(value: string | null) => value ? (expiryOptions[value] ?? value) : 'Never'}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="never">Never</SelectItem>
									<SelectItem value="30">30 days</SelectItem>
									<SelectItem value="90">90 days</SelectItem>
									<SelectItem value="365">1 year</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<Button type="submit" disabled={createKey.isPending} className="w-full">
							{createKey.isPending ? 'Creating...' : 'Create Key'}
						</Button>
					</form>
				</DialogContent>
			</Dialog>

			{/* Key reveal dialog */}
			<Dialog open={newKeyValue !== null} onOpenChange={() => setNewKeyValue(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>API Key Created</DialogTitle>
						<DialogDescription>
							Copy this key now. It won&apos;t be shown again.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2 p-3 bg-surface-raised rounded-lg">
						<code className="text-sm flex-1 break-all">{newKeyValue}</code>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								navigator.clipboard.writeText(newKeyValue ?? '')
								toast.success('Copied to clipboard')
							}}
						>
							<Copy className="h-4 w-4" />
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Revoke confirm */}
			<ConfirmDialog
				open={revokeId !== null}
				onOpenChange={() => setRevokeId(null)}
				title="Revoke API key"
				description="This will permanently delete this key. Any integrations using it will stop working immediately."
				confirmLabel="Revoke"
				destructive
				loading={revokeKey.isPending}
				onConfirm={() => {
					if (revokeId) revokeKey.mutate(revokeId, { onSuccess: () => setRevokeId(null) })
				}}
			/>

			{/* Rotate confirm */}
			<ConfirmDialog
				open={rotateId !== null}
				onOpenChange={() => setRotateId(null)}
				title="Rotate API key"
				description="This will generate a new key. The old key will stop working immediately."
				confirmLabel="Rotate"
				loading={rotateKey.isPending}
				onConfirm={() => {
					if (rotateId) {
						rotateKey.mutate(rotateId, {
							onSuccess(res) {
								setRotateId(null)
								setNewKeyValue(res.data.key)
							},
						})
					}
				}}
			/>
		</RequirePermission>
	)
}
