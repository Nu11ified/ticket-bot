import {
	ApplicationCommandOptionType,
	type Client,
	type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js'

export const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
	{
		name: 'close',
		description: 'Close the current ticket',
		options: [
			{
				name: 'reason',
				description: 'Reason for closing',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
		],
	},
	{
		name: 'reopen',
		description: 'Reopen a closed ticket',
	},
	{
		name: 'claim',
		description: 'Claim the current ticket',
	},
	{
		name: 'unclaim',
		description: 'Unclaim the current ticket',
	},
	{
		name: 'transfer',
		description: 'Transfer the ticket to another staff member',
		options: [
			{
				name: 'user',
				description: 'Staff member to transfer to',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	{
		name: 'priority',
		description: 'Set ticket priority',
		options: [
			{
				name: 'level',
				description: 'Priority level',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{ name: 'Low', value: 'low' },
					{ name: 'Normal', value: 'normal' },
					{ name: 'High', value: 'high' },
					{ name: 'Urgent', value: 'urgent' },
				],
			},
		],
	},
	{
		name: 'status',
		description: 'Set ticket status',
		options: [
			{
				name: 'status',
				description: 'New status',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{ name: 'Open', value: 'open' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Waiting on User', value: 'waiting_user' },
					{ name: 'Waiting on Staff', value: 'waiting_staff' },
					{ name: 'Escalated', value: 'escalated' },
					{ name: 'Resolved', value: 'resolved' },
				],
			},
		],
	},
	{
		name: 'add',
		description: 'Add a user to this ticket',
		options: [
			{
				name: 'user',
				description: 'User to add',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	{
		name: 'remove',
		description: 'Remove a user from this ticket',
		options: [
			{
				name: 'user',
				description: 'User to remove',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
]

export async function registerCommandsForAllGuilds(client: Client<true>): Promise<void> {
	const commandCount = commands.length
	let registered = 0

	for (const guild of client.guilds.cache.values()) {
		try {
			await guild.commands.set(commands)
			registered++
		} catch (err) {
			console.error(`Failed to register commands for guild ${guild.id}:`, err)
		}
	}

	console.log(`Registered ${commandCount} commands in ${registered}/${client.guilds.cache.size} guilds`)
}

export async function registerCommandsForGuild(
	client: Client<true>,
	guildId: string,
): Promise<void> {
	const guild = client.guilds.cache.get(guildId)
	if (!guild) return

	try {
		await guild.commands.set(commands)
	} catch (err) {
		console.error(`Failed to register commands for guild ${guildId}:`, err)
	}
}
