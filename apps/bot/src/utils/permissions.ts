import {
	ChannelType,
	OverwriteType,
	PermissionFlagsBits,
	type CategoryChannel,
	type CategoryCreateChannelOptions,
	type Guild,
	type GuildChannelCreateOptions,
	type TextChannel,
} from 'discord.js'

type TicketChannelCreateResult =
	| { mode: 'category'; category: CategoryChannel; options: CategoryCreateChannelOptions }
	| { mode: 'guild'; options: GuildChannelCreateOptions }

export function buildTicketChannelOptions(opts: {
	guild: Guild
	channelName: string
	categoryChannel?: CategoryChannel | null
	creatorId: string
	staffRoleIds: string[]
}): TicketChannelCreateResult {
	const permissionOverwrites = [
		{
			id: opts.guild.roles.everyone.id,
			type: OverwriteType.Role as const,
			deny: [PermissionFlagsBits.ViewChannel],
		},
		{
			id: opts.creatorId,
			type: OverwriteType.Member as const,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
				PermissionFlagsBits.AttachFiles,
			],
		},
		...opts.staffRoleIds.map((roleId) => ({
			id: roleId,
			type: OverwriteType.Role as const,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.ReadMessageHistory,
				PermissionFlagsBits.AttachFiles,
				PermissionFlagsBits.ManageMessages,
			],
		})),
	]

	if (opts.categoryChannel) {
		return {
			mode: 'category',
			category: opts.categoryChannel,
			options: {
				name: opts.channelName,
				type: ChannelType.GuildText,
				permissionOverwrites,
			},
		}
	}

	return {
		mode: 'guild',
		options: {
			name: opts.channelName,
			type: ChannelType.GuildText,
			permissionOverwrites,
		},
	}
}

export async function lockTicketChannel(
	channel: TextChannel,
	creatorId: string,
	staffRoleIds: string[],
): Promise<void> {
	await channel.permissionOverwrites.edit(creatorId, {
		SendMessages: false,
	})

	for (const roleId of staffRoleIds) {
		await channel.permissionOverwrites.edit(roleId, {
			SendMessages: false,
		})
	}
}

export async function unlockTicketChannel(
	channel: TextChannel,
	creatorId: string,
	staffRoleIds: string[],
): Promise<void> {
	await channel.permissionOverwrites.edit(creatorId, {
		SendMessages: true,
	})

	for (const roleId of staffRoleIds) {
		await channel.permissionOverwrites.edit(roleId, {
			SendMessages: true,
		})
	}
}
