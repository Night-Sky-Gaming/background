const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bump-disboard')
		.setDescription('Manually trigger a Disboard bump')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
	async execute(interaction) {
		const channelId = '1443734228352110662'; // bot-dev-commands channel
		const channel = interaction.client.channels.cache.get(channelId);

		if (!channel) {
			return interaction.reply({
				content: '❌ Could not find the bot-dev-commands channel.',
				ephemeral: true,
			});
		}

		try {
			// Send the /bump command
			await channel.send('/bump');
			console.log('[BUMP] Manual bump command executed');
			
			await interaction.reply({
				content: '✅ Bump command sent to bot-dev-commands!',
				ephemeral: true,
			});
		} catch (error) {
			console.error('[BUMP] Error sending bump command:', error);
			await interaction.reply({
				content: '❌ Failed to send bump command.',
				ephemeral: true,
			});
		}
	},
};
