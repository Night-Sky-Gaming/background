const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUser, getUserRank, xpForNextLevel } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rank')
		.setDescription('Check your or another user\'s level and rank')
		.setDefaultMemberPermissions(null)
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

		// Check for inactivity warning
		const now = Date.now();
		const sevenDays = 7 * 24 * 60 * 60 * 1000;
		const lastActivity = userData.last_activity || 0;
		let inactivityWarning = '';
		
		if (lastActivity === 0) {
			// User has never had their activity tracked
			inactivityWarning = '\n\n*Note: Activity tracking is now enabled. Stay active to avoid XP reduction!*';
		} else if (now - lastActivity >= sevenDays) {
			// User is currently inactive
			inactivityWarning = '\n\n*⚠️ You have been inactive for 7+ days. Your XP may be reduced soon!*';
		} else {
			// Calculate days until potential reduction
			const daysInactive = Math.floor((now - lastActivity) / (24 * 60 * 60 * 1000));
			if (daysInactive >= 5) {
				inactivityWarning = `\n\n*You have been inactive for ${daysInactive} day(s). Send a message to stay active!*`;
			}
		}

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
					value: `${progressBar} ${progressPercent}%\n${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP${inactivityWarning}`,
				},
			)
			.setTimestamp();

		try {
			await interaction.user.send({ embeds: [embed] });
			const isOtherUser = targetUser.id !== interaction.user.id;
			const message = isOtherUser
				? `I've sent ${targetUser.username}'s rank info to your DMs! 📈`
				: 'I\'ve sent your rank info to your DMs! 📈';
			await interaction.reply({
				content: message,
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
