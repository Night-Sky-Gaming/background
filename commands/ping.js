const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!')
		.setDefaultMemberPermissions(null),
	async execute(interaction) {
		try {
			await interaction.user.send('Pong!');
			await interaction.reply({
				content: 'I\'ve sent you a DM! 💬',
				flags: MessageFlags.Ephemeral,
			});
		}
		catch (error) {
			await interaction.reply({
				content: 'I couldn\'t send you a DM. Please check that you have DMs enabled for this server.',
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
