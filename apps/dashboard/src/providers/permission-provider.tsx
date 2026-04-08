'use client'

import { createContext, useContext } from 'react'

const PermissionContext = createContext<Set<string>>(new Set())

export function PermissionProvider({
	permissions,
	children,
}: {
	permissions: string[]
	children: React.ReactNode
}) {
	const permSet = new Set(permissions)
	return <PermissionContext.Provider value={permSet}>{children}</PermissionContext.Provider>
}

export function usePermissions() {
	return useContext(PermissionContext)
}

export function useHasPermission(permission: string) {
	const perms = useContext(PermissionContext)
	return perms.has(permission)
}
