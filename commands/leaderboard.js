	const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getLeaderboard } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('View the server leaderboard')
		.setDefaultMemberPermissions(null)
		.addIntegerOption((option) =>
			option
				.setName('limit')
				.setDescription('Number of users to display (default: 10)')
				.setMinValue(5)
				.setMaxValue(25)
				.setRequired(false),
		),
	async execute(interaction) {
		const limit = interaction.options.getInteger('limit') || 10;
		const guildId = interaction.guild.id;

		// Get leaderboard
		const leaderboard = getLeaderboard(guildId, limit);

		if (leaderboard.length === 0) {
			await interaction.reply({
				content: 'No users have gained XP yet! Start chatting to earn levels!',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		// Create leaderboard text
		let description = '';
		for (let i = 0; i < leaderboard.length; i++) {
			const user = leaderboard[i];
			const medal =
				i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;

			// Try to get user from Discord
			let username = `User ${user.user_id}`;
			try {
				const discordUser = await interaction.client.users.fetch(user.user_id);
				username = discordUser.username;
			}
			catch {
				// User might have left the server
			}

			description += `${medal} **${username}** - Level ${user.level} (${user.xp.toLocaleString()} XP)\n`;
		}

		// Create embed
		const embed = new EmbedBuilder()
			.setColor(0xffd700)
			.setTitle('🏆 Server Leaderboard')
			.setDescription(description)
			.setFooter({ text: `Showing top ${leaderboard.length} users` })
			.setTimestamp();

		try {
			await interaction.user.send({ embeds: [embed] });
			await interaction.reply({
				content: 'I\'ve sent the leaderboard to your DMs! 📊',
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
