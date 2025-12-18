const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getAllUsersInGuild, checkInactivityAndReduce } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('activity-check')
		.setDescription('Manually check for inactive users and reduce XP')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const guildId = interaction.guild.id;
		const allUsers = getAllUsersInGuild(guildId);
		
		const reductions = [];
		
		for (const user of allUsers) {
			const result = checkInactivityAndReduce(user.user_id, guildId);
			
			if (result.reduced) {
				const xpLost = result.oldXp - result.newXp;
				reductions.push({
					userId: user.user_id,
					oldXp: result.oldXp,
					newXp: result.newXp,
					xpLost,
					oldLevel: result.oldLevel,
					newLevel: result.newLevel,
				});
				
				console.log(`[XP REDUCTION] User ${user.user_id}: ${result.oldXp} XP -> ${result.newXp} XP (Lost ${xpLost} XP due to inactivity)`);
			}
		}

		if (reductions.length === 0) {
			return interaction.editReply({
				content: '✅ Activity check complete. No users were inactive for 7+ days.',
			});
		}

		// Create summary message
		let summary = `**Activity Check Results**\n\n${reductions.length} user(s) had XP reduced due to inactivity:\n\n`;
		
		for (const reduction of reductions) {
			const member = await interaction.guild.members.fetch(reduction.userId).catch(() => null);
			const username = member ? member.user.username : `User ${reduction.userId}`;
			summary += `• **${username}**: ${reduction.oldXp.toLocaleString()} → ${reduction.newXp.toLocaleString()} XP (-${reduction.xpLost.toLocaleString()})\n`;
			if (reduction.oldLevel !== reduction.newLevel) {
				summary += `  Level ${reduction.oldLevel} → Level ${reduction.newLevel}\n`;
			}
		}

		// Send to logs channel
		const logsChannelId = '1444466700006461564'; // other-logs channel
		const logsChannel = interaction.client.channels.cache.get(logsChannelId);
		
		if (logsChannel) {
			await logsChannel.send(summary);
		}

		// DM the admin
		const adminId = '1084918048638652426';
		const admin = await interaction.client.users.fetch(adminId).catch(() => null);
		
		if (admin) {
			try {
				await admin.send(summary);
			} catch (error) {
				console.error('[ACTIVITY CHECK] Could not DM admin:', error);
			}
		}

		await interaction.editReply({
			content: `✅ Activity check complete. ${reductions.length} user(s) had XP reduced. Details sent to logs channel.`,
		});
	},
};
