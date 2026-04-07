'use client'

import { createContext, useContext } from 'react'

export interface GuildInfo {
	id: number
	discordId: string
	name: string
	iconUrl: string | null
	planTier: string
	settings: {
		logChannelId: string | null
		transcriptChannelId: string | null
		locale: string
		timezone: string
		autoCloseHours: number | null
		transcriptRetentionDays: number
		ticketCooldownSeconds: number
	} | null
}

const GuildContext = createContext<GuildInfo | null>(null)

export function GuildProvider({
	guild,
	children,
}: {
	guild: GuildInfo
	children: React.ReactNode
}) {
	return <GuildContext.Provider value={guild}>{children}</GuildContext.Provider>
}

export function useGuild() {
	const guild = useContext(GuildContext)
	if (!guild) throw new Error('useGuild must be used within GuildProvider')
	return guild
}
