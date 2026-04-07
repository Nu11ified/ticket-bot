'use client'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { RequirePermission } from '@/components/require-permission'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useRefreshRoles, useRoles, useUpdateRolePermissions } from '@/hooks/use-roles'
import { RefreshCw, Shield } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const ALL_PERMISSIONS = [
	{ key: 'tickets.view', label: 'View tickets', category: 'tickets' },
	{ key: 'tickets.manage', label: 'Manage tickets', category: 'tickets' },
	{ key: 'transcripts.view', label: 'View transcripts', category: 'transcripts' },
	{ key: 'transcripts.export', label: 'Export transcripts', category: 'transcripts' },
	{ key: 'admin.manage_settings', label: 'Manage settings', category: 'admin' },
	{ key: 'admin.manage_categories', label: 'Manage categories', category: 'admin' },
	{ key: 'admin.manage_panels', label: 'Manage panels', category: 'admin' },
	{ key: 'admin.manage_roles', label: 'Manage roles', category: 'admin' },
	{ key: 'admin.view_audit_logs', label: 'View audit logs', category: 'admin' },
	{ key: 'admin.manage_api_keys', label: 'Manage API keys', category: 'admin' },
]

const CATEGORIES = ['tickets', 'transcripts', 'admin']

export default function RolesPage() {
	const params = useParams()
	const guildId = Number(params.guildId)
	const { data: roles, isLoading } = useRoles(guildId)
	const updatePermissions = useUpdateRolePermissions(guildId)
	const refreshRoles = useRefreshRoles(guildId)

	const [expandedRole, setExpandedRole] = useState<number | null>(null)

	if (isLoading) return <Skeleton className="h-96 w-full" />

	return (
		<RequirePermission permission="admin.manage_roles">
			<PageHeader
				title="Roles"
				description="Manage role permissions"
				actions={
					<Button
						variant="outline"
						size="sm"
						onClick={() => refreshRoles.mutate()}
						disabled={refreshRoles.isPending}
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${refreshRoles.isPending ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
				}
			/>

			{!roles?.length ? (
				<EmptyState
					icon={Shield}
					title="No roles"
					description="Refresh roles from Discord to get started."
				/>
			) : (
				<div className="space-y-2">
					{roles.map((role) => {
						const isExpanded = expandedRole === role.id
						const rolePermKeys = role.permissions.map((p) => p.key)

						return (
							<div key={role.id} className="glass-panel">
								<button
									type="button"
									className="w-full flex items-center justify-between p-4"
									onClick={() => setExpandedRole(isExpanded ? null : role.id)}
								>
									<div className="flex items-center gap-3">
										<div
											className="w-3 h-3 rounded-full"
											style={{
												backgroundColor: role.color
													? `#${role.color.toString(16).padStart(6, '0')}`
													: '#99aab5',
											}}
										/>
										<span className="font-medium">{role.name}</span>
									</div>
									<span className="text-sm text-muted-foreground">
										{role.permissions.length} permissions
									</span>
								</button>
								{isExpanded && (
									<div className="px-4 pb-4 border-t border-glass-100 pt-4">
										{CATEGORIES.map((cat) => (
											<div key={cat} className="mb-4">
												<p className="text-xs font-medium text-muted-foreground uppercase mb-2">
													{cat}
												</p>
												<div className="space-y-2">
													{ALL_PERMISSIONS.filter((p) => p.category === cat).map((perm) => (
														<label
															key={perm.key}
															className="flex items-center gap-2 cursor-pointer"
														>
															<Checkbox
																checked={rolePermKeys.includes(perm.key)}
																onCheckedChange={(checked) => {
																	const newPerms = checked
																		? [...rolePermKeys, perm.key]
																		: rolePermKeys.filter((k) => k !== perm.key)
																	updatePermissions.mutate({
																		roleId: role.id,
																		permissions: newPerms,
																	})
																}}
															/>
															<span className="text-sm">{perm.label}</span>
														</label>
													))}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}
		</RequirePermission>
	)
}
