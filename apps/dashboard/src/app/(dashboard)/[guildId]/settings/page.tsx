'use client'

import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPut } from '@/lib/api'
import { useGuild } from '@/providers/guild-provider'
import { type SettingsFormData, settingsSchema } from '@/schemas/settings'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

export default function SettingsPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const guild = useGuild()
	const queryClient = useQueryClient()

	const {
		register,
		handleSubmit,
		formState: { errors, isDirty },
	} = useForm<SettingsFormData>({
		resolver: standardSchemaResolver(settingsSchema),
		defaultValues: {
			locale: guild.settings?.locale ?? 'en',
			timezone: guild.settings?.timezone ?? 'UTC',
			logChannelId: guild.settings?.logChannelId ?? null,
			transcriptChannelId: guild.settings?.transcriptChannelId ?? null,
			ticketCooldownSeconds: guild.settings?.ticketCooldownSeconds ?? 60,
			autoCloseHours: guild.settings?.autoCloseHours ?? null,
			transcriptRetentionDays: guild.settings?.transcriptRetentionDays ?? 5,
		},
	})

	const updateSettings = useMutation({
		mutationFn: (data: SettingsFormData) => apiPut(`/api/guilds/${guildId}/settings`, data),
		onSuccess() {
			queryClient.invalidateQueries({ queryKey: ['guilds', guildId] })
			toast.success('Settings saved')
		},
	})

	return (
		<RequirePermission permission="admin.manage_settings">
			<PageHeader title="Settings" description="Configure your server settings" />
			<form
				onSubmit={handleSubmit((data) => updateSettings.mutate(data))}
				className="space-y-8 max-w-2xl"
			>
				<div className="glass-panel p-6 space-y-4">
					<h3 className="text-sm font-medium">General</h3>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="locale">Locale</Label>
							<Input id="locale" placeholder="en" {...register('locale')} />
							{errors.locale && <p className="text-sm text-destructive">{errors.locale.message}</p>}
						</div>
						<div className="space-y-2">
							<Label htmlFor="timezone">Timezone</Label>
							<Input id="timezone" placeholder="UTC" {...register('timezone')} />
							{errors.timezone && (
								<p className="text-sm text-destructive">{errors.timezone.message}</p>
							)}
						</div>
					</div>
				</div>

				<div className="glass-panel p-6 space-y-4">
					<h3 className="text-sm font-medium">Channels</h3>
					<div className="space-y-2">
						<Label htmlFor="logChannelId">Log Channel ID</Label>
						<Input id="logChannelId" placeholder="Channel ID" {...register('logChannelId')} />
						<p className="text-sm text-muted-foreground">Channel for ticket log messages</p>
						{errors.logChannelId && (
							<p className="text-sm text-destructive">{errors.logChannelId.message}</p>
						)}
					</div>
					<div className="space-y-2">
						<Label htmlFor="transcriptChannelId">Transcript Channel ID</Label>
						<Input
							id="transcriptChannelId"
							placeholder="Channel ID"
							{...register('transcriptChannelId')}
						/>
						{errors.transcriptChannelId && (
							<p className="text-sm text-destructive">{errors.transcriptChannelId.message}</p>
						)}
					</div>
				</div>

				<div className="glass-panel p-6 space-y-4">
					<h3 className="text-sm font-medium">Tickets</h3>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="ticketCooldownSeconds">Cooldown (seconds)</Label>
							<Input
								id="ticketCooldownSeconds"
								type="number"
								{...register('ticketCooldownSeconds', { valueAsNumber: true })}
							/>
							{errors.ticketCooldownSeconds && (
								<p className="text-sm text-destructive">{errors.ticketCooldownSeconds.message}</p>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="autoCloseHours">Auto-close (hours)</Label>
							<Input
								id="autoCloseHours"
								type="number"
								{...register('autoCloseHours', {
									setValueAs: (v: string) => (v === '' ? null : Number(v)),
								})}
								defaultValue={guild.settings?.autoCloseHours ?? ''}
							/>
							{errors.autoCloseHours && (
								<p className="text-sm text-destructive">{errors.autoCloseHours.message}</p>
							)}
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="transcriptRetentionDays">Transcript retention (days)</Label>
						<Input
							id="transcriptRetentionDays"
							type="number"
							{...register('transcriptRetentionDays', { valueAsNumber: true })}
						/>
						{errors.transcriptRetentionDays && (
							<p className="text-sm text-destructive">{errors.transcriptRetentionDays.message}</p>
						)}
					</div>
				</div>

				<Button type="submit" disabled={updateSettings.isPending || !isDirty}>
					<Save className="h-4 w-4 mr-2" />
					{updateSettings.isPending ? 'Saving...' : 'Save settings'}
				</Button>
			</form>
		</RequirePermission>
	)
}
