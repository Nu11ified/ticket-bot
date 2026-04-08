import type { Database } from '@ticketbot/db'
import { type ChatInputCommandInteraction, type Interaction, MessageFlags } from 'discord.js'
import { handleAdd } from '../commands/add.js'
import { handleClaim } from '../commands/claim.js'
import { handleClose } from '../commands/close.js'
import { handlePriority } from '../commands/priority.js'
import { handleRemove } from '../commands/remove.js'
import { handleReopen } from '../commands/reopen.js'
import { handleStatus } from '../commands/status.js'
import { handleTransfer } from '../commands/transfer.js'
import { handleUnclaim } from '../commands/unclaim.js'
import { handleFormModal } from '../interactions/form-modal.js'
import { handlePanelButton } from '../interactions/panel-button.js'

const commandHandlers: Record<
	string,
	(db: Database, interaction: ChatInputCommandInteraction) => Promise<void>
> = {
	close: handleClose,
	reopen: handleReopen,
	claim: handleClaim,
	unclaim: handleUnclaim,
	transfer: handleTransfer,
	priority: handlePriority,
	status: handleStatus,
	add: handleAdd,
	remove: handleRemove,
}

export async function handleInteractionCreate(
	db: Database,
	interaction: Interaction,
): Promise<void> {
	try {
		if (interaction.isButton() && interaction.customId.startsWith('panel_button_')) {
			await handlePanelButton(db, interaction)
			return
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
			await handleFormModal(db, interaction)
			return
		}

		if (interaction.isChatInputCommand()) {
			const handler = commandHandlers[interaction.commandName]
			if (handler) {
				await handler(db, interaction)
			}
			return
		}
	} catch (err) {
		console.error('Interaction handler error:', err)

		if (interaction.isRepliable()) {
			const content = 'An error occurred while processing this interaction.'
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content }).catch(() => {})
			} else {
				await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {})
			}
		}
	}
}
