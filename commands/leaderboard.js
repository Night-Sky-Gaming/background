const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('View the server leaderboard')
		.addIntegerOption(option =>
			option
				.setName('limit')
				.setDescription('Number of users to display (default: 10)')
				.setMinValue(5)
				.setMaxValue(25)
				.setRequired(false)),
	async execute(interaction) {
		const limit = interaction.options.getInteger('limit') || 10;
		const guildId = interaction.guild.id;

		// Get leaderboard
		const leaderboard = getLeaderboard(guildId, limit);

		if (leaderboard.length === 0) {
			await interaction.reply('No users have gained XP yet! Start chatting to earn levels!');
			return;
		}

		// Create leaderboard text
		let description = '';
		for (let i = 0; i < leaderboard.length; i++) {
			const user = leaderboard[i];
			const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;

			// Try to get user from Discord
			let username = `User ${user.user_id}`;
			try {
				const discordUser = await interaction.client.users.fetch(user.user_id);
				username = discordUser.username;
			}
			catch (error) {
				// User might have left the server
			}

			description += `${medal} **${username}** - Level ${user.level} (${user.xp.toLocaleString()} XP)\n`;
		}

		// Create embed
		const embed = new EmbedBuilder()
			.setColor(0xFFD700)
			.setTitle('🏆 Server Leaderboard')
			.setDescription(description)
			.setFooter({ text: `Showing top ${leaderboard.length} users` })
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	},
};
