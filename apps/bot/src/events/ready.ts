import type { Client } from 'discord.js'

export function handleReady(client: Client<true>): void {
	console.log(`Bot ready as ${client.user.tag} — serving ${client.guilds.cache.size} guilds`)
}
