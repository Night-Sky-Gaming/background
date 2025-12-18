const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getUser, calculateLevel } = require('../database.js');
const { db } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('restore-xp')
		.setDescription('Restore XP for a user who was incorrectly penalized')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('User to restore XP for')
				.setRequired(true)
		),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		
		const targetUser = interaction.options.getUser('user');
		const guildId = interaction.guild.id;
		
		// Restore single user
		const userData = getUser(targetUser.id, guildId);
		const currentXp = userData.xp;
		const restoredXp = Math.floor(currentXp / 0.85); // Reverse the 15% reduction
		const xpRestored = restoredXp - currentXp;
		const newLevel = calculateLevel(restoredXp);
		
		// Update database
		const stmt = db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?');
		stmt.run(restoredXp, newLevel, targetUser.id, guildId);
		
		console.log(`[XP RESTORE] User ${targetUser.id}: ${currentXp} XP -> ${restoredXp} XP (Restored ${xpRestored} XP)`);
		
		await interaction.editReply(
			`✅ Restored XP for **${targetUser.username}**\n` +
			`${currentXp.toLocaleString()} → ${restoredXp.toLocaleString()} XP (+${xpRestored.toLocaleString()})\n` +
			`Level: ${userData.level} → ${newLevel}`
		);
	},
};
