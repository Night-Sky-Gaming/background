const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, getUserRank, xpForNextLevel } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rank')
		.setDescription('Check your or another user\'s level and rank')
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The user to check (leave empty for yourself)')
				.setRequired(false),
		),
	async execute(interaction) {
		const targetUser = interaction.options.getUser('user') || interaction.user;
		const guildId = interaction.guild.id;

		// Get user data
		const userData = getUser(targetUser.id, guildId);
		const rank = getUserRank(targetUser.id, guildId);

		// Calculate progress to next level
		const currentLevel = userData.level;
		const currentXp = userData.xp;
		const xpForCurrent = xpForNextLevel(currentLevel - 1);
		const xpForNext = xpForNextLevel(currentLevel);
		const xpProgress = currentXp - xpForCurrent;
		const xpNeeded = xpForNext - xpForCurrent;
		const progressPercent = Math.floor((xpProgress / xpNeeded) * 100);

		// Create progress bar
		const progressBarLength = 10;
		const filledBars = Math.floor((xpProgress / xpNeeded) * progressBarLength);
		const emptyBars = progressBarLength - filledBars;
		const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

		// Create embed
		const embed = new EmbedBuilder()
			.setColor(0x5865f2)
			.setTitle(`${targetUser.username}'s Rank`)
			.setThumbnail(targetUser.displayAvatarURL())
			.addFields(
				{ name: '📊 Rank', value: `#${rank}`, inline: true },
				{ name: '⭐ Level', value: `${currentLevel}`, inline: true },
				{
					name: '✨ Total XP',
					value: `${currentXp.toLocaleString()}`,
					inline: true,
				},
				{
					name: '📈 Progress to Next Level',
					value: `${progressBar} ${progressPercent}%\n${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`,
				},
			)
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	},
};
