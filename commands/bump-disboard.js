const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

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
				flags: MessageFlags.Ephemeral,
			});
		}

		try {
			// Send a reminder to bump (bots cannot invoke other bots' slash commands)
			await channel.send('🔔 **Bump Reminder**: Please run </bump:947088344167366698> to bump the server!');
			console.log('[BUMP] Manual bump reminder sent');
			
			await interaction.reply({
				content: '✅ Bump reminder sent to bot-dev-commands!',
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			console.error('[BUMP] Error sending bump reminder:', error);
			await interaction.reply({
				content: '❌ Failed to send bump reminder.',
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
