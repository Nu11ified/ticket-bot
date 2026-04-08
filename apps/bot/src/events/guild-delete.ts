import type { Guild as DiscordGuild } from 'discord.js'

export function handleGuildDelete(guild: DiscordGuild): void {
	console.log(`Left guild: ${guild.name} (${guild.id})`)
}
