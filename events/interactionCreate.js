const { Events, MessageFlags } = require('discord.js');
const { setNotificationPreference } = require('../database.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// Handle button interactions
		if (interaction.isButton()) {
			const [action, guildId] = interaction.customId.split(':');
			
			if (action === 'disable_notifications') {
				try {
					const userId = interaction.user.id;
					setNotificationPreference(userId, guildId, false);
					
					await interaction.update({
						content: '🔕 Notifications disabled! You will no longer receive level-up messages. To re-enable them, use the `/rank` command.',
						components: [],
					});
					
					console.log(`[NOTIFICATIONS] ${interaction.user.tag} disabled notifications for guild ${guildId}`);
				}
				catch (error) {
					console.error('Error disabling notifications:', error);
					await interaction.reply({
						content: 'There was an error disabling notifications.',
						flags: MessageFlags.Ephemeral,
					});
				}
				return;
			}
			
			if (action === 'enable_notifications') {
				try {
					const userId = interaction.user.id;
					setNotificationPreference(userId, guildId, true);
					
					await interaction.update({
						content: '🔔 Notifications enabled! You will now receive level-up messages.',
						components: [],
					});
					
					console.log(`[NOTIFICATIONS] ${interaction.user.tag} enabled notifications for guild ${guildId}`);
				}
				catch (error) {
					console.error('Error enabling notifications:', error);
					await interaction.reply({
						content: 'There was an error enabling notifications.',
						flags: MessageFlags.Ephemeral,
					});
				}
				return;
			}
		}

		// Handle slash commands
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			}
			catch (error) {
				console.error(`Error executing ${interaction.commandName}`);
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				}
				else {
					await interaction.reply({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		}
	},
};
