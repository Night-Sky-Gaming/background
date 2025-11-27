const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getUser, updateUser, calculateLevel } = require('../database.js');

const AUTHORIZED_USER_ID = '1084918048638652426';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remove-xp')
		.setDescription('Remove XP from a user (Admin only)')
		.setDefaultMemberPermissions(null)
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The user to remove XP from')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('Amount of XP to remove')
				.setRequired(true)
				.setMinValue(1),
		),
	async execute(interaction) {
		// Check if user is authorized
		if (interaction.user.id !== AUTHORIZED_USER_ID) {
			return interaction.reply({
				content: '❌ You do not have permission to use this command.',
				flags: MessageFlags.Ephemeral,
			});
		}

		const targetUser = interaction.options.getUser('user');
		const amount = interaction.options.getInteger('amount');
		const guildId = interaction.guild.id;

		// Get current user data
		const userData = getUser(targetUser.id, guildId);
		const oldLevel = userData.level;
		const newXp = Math.max(0, userData.xp - amount); // Don't go below 0
		const newLevel = calculateLevel(newXp);

		// Update user data
		updateUser(targetUser.id, guildId, newXp, newLevel, userData.last_message);

		// Create response message
		let responseMessage = `✅ Removed **${amount.toLocaleString()} XP** from ${targetUser.username}!\n`;
		responseMessage += `New XP: **${newXp.toLocaleString()}**`;

		if (newLevel < oldLevel) {
			responseMessage += `\n📉 ${targetUser.username} went from **Level ${oldLevel}** to **Level ${newLevel}**.`;
		}

		await interaction.reply({
			content: responseMessage,
			flags: MessageFlags.Ephemeral,
		});
	},
};
