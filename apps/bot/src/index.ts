import { Client, GatewayIntentBits } from 'discord.js'
import { createDb } from '@ticketbot/db'
import { handleReady } from './events/ready.js'
import { handleGuildCreate } from './events/guild-create.js'
import { handleGuildDelete } from './events/guild-delete.js'
import { handleGuildMemberAdd } from './events/guild-member-add.js'
import { handleGuildMemberRemove } from './events/guild-member-remove.js'
import { handleRoleCreate } from './events/role-create.js'
import { handleRoleUpdate } from './events/role-update.js'
import { handleRoleDelete } from './events/role-delete.js'
import { handleInteractionCreate } from './events/interaction-create.js'
import { handleMessageCreate } from './events/message-create.js'
import { registerCommandsForAllGuilds, registerCommandsForGuild } from './commands/registry.js'
import { runCleanupJob } from './services/transcript.js'

const db = createDb(process.env.DATABASE_URL ?? '')

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildModeration,
	],
})

client.once('ready', async (c) => {
	handleReady(c)
	await registerCommandsForAllGuilds(c)

	setInterval(async () => {
		try {
			const result = await runCleanupJob(db, client)
			if (result.purged > 0) {
				console.log(`Cleanup: purged ${result.purged} transcripts, deleted ${result.channelsDeleted} channels`)
			}
		} catch (err) {
			console.error('Cleanup job error:', err)
		}
	}, 60 * 60 * 1000)
})

client.on('guildCreate', async (guild) => {
	try {
		await handleGuildCreate(db, guild)
		await registerCommandsForGuild(client as Client<true>, guild.id)
	} catch (err) {
		console.error(`guildCreate error for ${guild.id}:`, err)
	}
})

client.on('guildDelete', (guild) => {
	handleGuildDelete(guild)
})

client.on('guildMemberAdd', async (member) => {
	try {
		await handleGuildMemberAdd(db, member)
	} catch (err) {
		console.error('guildMemberAdd error:', err)
	}
})

client.on('guildMemberRemove', async (member) => {
	try {
		await handleGuildMemberRemove(db, member)
	} catch (err) {
		console.error('guildMemberRemove error:', err)
	}
})

client.on('roleCreate', async (role) => {
	try {
		await handleRoleCreate(db, role)
	} catch (err) {
		console.error('roleCreate error:', err)
	}
})

client.on('roleUpdate', async (oldRole, newRole) => {
	try {
		await handleRoleUpdate(db, oldRole, newRole)
	} catch (err) {
		console.error('roleUpdate error:', err)
	}
})

client.on('roleDelete', async (role) => {
	try {
		await handleRoleDelete(db, role)
	} catch (err) {
		console.error('roleDelete error:', err)
	}
})

client.on('interactionCreate', async (interaction) => {
	await handleInteractionCreate(db, interaction)
})

client.on('messageCreate', async (message) => {
	try {
		await handleMessageCreate(db, message)
	} catch (err) {
		console.error('messageCreate error:', err)
	}
})

client.login(process.env.DISCORD_TOKEN).catch((err) => {
	console.error('Failed to login:', err)
	process.exit(1)
})
