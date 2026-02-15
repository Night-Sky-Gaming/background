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

		// Create summary messages (split into chunks to avoid Discord's 2000 char limit)
		const header = `**Activity Check Results**\n\n${reductions.length} user(s) had XP reduced due to inactivity:\n\n`;
		const messages = [header];
		let currentMessage = 0;
		
		for (const reduction of reductions) {
			const member = await interaction.guild.members.fetch(reduction.userId).catch(() => null);
			const username = member ? member.user.username : `User ${reduction.userId}`;
			let entry = `• **${username}**: ${reduction.oldXp.toLocaleString()} → ${reduction.newXp.toLocaleString()} XP (-${reduction.xpLost.toLocaleString()})\n`;
			if (reduction.oldLevel !== reduction.newLevel) {
				entry += `  Level ${reduction.oldLevel} → Level ${reduction.newLevel}\n`;
			}
			
			// Check if adding this entry would exceed Discord's 2000 char limit
			if ((messages[currentMessage] + entry).length > 1900) {
				currentMessage++;
				messages[currentMessage] = entry;
			} else {
				messages[currentMessage] += entry;
			}
		}

		// Send to logs channel
		const logsChannelId = '1444466700006461564'; // other-logs channel
		const logsChannel = interaction.client.channels.cache.get(logsChannelId);
		
		if (logsChannel) {
			for (const message of messages) {
				await logsChannel.send(message);
			}
		}

		// DM the admin
		const adminId = '1084918048638652426';
		const admin = await interaction.client.users.fetch(adminId).catch(() => null);
		
		if (admin) {
			try {
				for (const message of messages) {
					await admin.send(message);
				}
			} catch (error) {
				console.error('[ACTIVITY CHECK] Could not DM admin:', error);
			}
		}

		await interaction.editReply({
			content: `✅ Activity check complete. ${reductions.length} user(s) had XP reduced. Details sent to logs channel.`,
		});
	},
};
