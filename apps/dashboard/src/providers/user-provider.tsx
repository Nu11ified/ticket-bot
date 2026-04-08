'use client'

import { createContext, useContext } from 'react'

export interface CurrentUser {
	id: string
	username: string
	displayName: string | null
	avatarUrl: string | null
	email: string | null
}

const UserContext = createContext<CurrentUser | null>(null)

export function UserProvider({
	user,
	children,
}: {
	user: CurrentUser
	children: React.ReactNode
}) {
	return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useCurrentUser() {
	const user = useContext(UserContext)
	if (!user) throw new Error('useCurrentUser must be used within UserProvider')
	return user
}
