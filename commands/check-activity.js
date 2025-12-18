const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getUser } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('check-activity')
		.setDescription('Check activity details for a user')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('User to check activity for')
				.setRequired(true)
		),
	async execute(interaction) {
		const targetUser = interaction.options.getUser('user');
		const guildId = interaction.guild.id;
		
		const userData = getUser(targetUser.id, guildId);
		
		// Format timestamps
		const formatTimestamp = (timestamp) => {
			if (timestamp === 0) return 'Never/Not tracked';
			const date = new Date(timestamp);
			return `<t:${Math.floor(timestamp / 1000)}:F> (<t:${Math.floor(timestamp / 1000)}:R>)`;
		};
		
		const now = Date.now();
		const daysSinceActivity = userData.last_activity === 0 
			? 'N/A' 
			: Math.floor((now - userData.last_activity) / (24 * 60 * 60 * 1000));
		
		const response = 
			`**Activity Details for ${targetUser.username}**\n\n` +
			`**Last Message:** ${formatTimestamp(userData.last_message)}\n` +
			`**Last Activity:** ${formatTimestamp(userData.last_activity)}\n` +
			`**Days Since Activity:** ${daysSinceActivity}\n\n` +
			`**Current XP:** ${userData.xp.toLocaleString()}\n` +
			`**Current Level:** ${userData.level}\n` +
			`**Voice Time:** ${Math.floor(userData.voice_total_time / (1000 * 60))} minutes`;
		
		await interaction.reply({
			content: response,
			flags: MessageFlags.Ephemeral,
		});
	},
};
