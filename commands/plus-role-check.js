const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getAllUsersInGuild } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('plus-role-check')
		.setDescription('Check and assign + role to all members who are level 3 or above')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const guildId = interaction.guild.id;
		const allUsers = getAllUsersInGuild(guildId);

		// Filter users who are level 3 or above
		const eligibleUsers = allUsers.filter(user => user.level >= 3);

		if (eligibleUsers.length === 0) {
			return interaction.editReply({
				content: '✅ No users are level 3 or above yet.',
			});
		}

		// Find the + role
		const plusRole = interaction.guild.roles.cache.find(r => r.name === '+');

		if (!plusRole) {
			return interaction.editReply({
				content: '❌ Could not find the "+" role in this server.',
			});
		}

		let usersChecked = 0;
		let rolesAdded = 0;
		let alreadyHadRole = 0;
		let errors = 0;

		await interaction.editReply({
			content: `🔍 Checking ${eligibleUsers.length} eligible users...`,
		});

		for (const user of eligibleUsers) {
			try {
				// Fetch the member from Discord
				const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);

				if (!member) {
					// User is no longer in the server
					console.log(`[PLUS-ROLE-CHECK] User ${user.user_id} (Level ${user.level}) is no longer in the server - skipping`);
					errors++;
					continue;
				}

				usersChecked++;

				// Check if they already have the + role
				if (member.roles.cache.has(plusRole.id)) {
					alreadyHadRole++;
					continue;
				}

				// Add the role
				await member.roles.add(plusRole);
				rolesAdded++;

				// Send them a DM
				try {
					await member.send(
						`🎉 Congratulations! You've been awarded the **${plusRole.name}** role in **${interaction.guild.name}** for reaching **Level ${user.level}**!`
					);
					console.log(`[PLUS-ROLE-CHECK] Added + role to ${member.user.tag} (Level ${user.level}) and sent DM`);
				} catch (dmError) {
					console.log(`[PLUS-ROLE-CHECK] Added + role to ${member.user.tag} (Level ${user.level}) but couldn't send DM`);
				}

			} catch (error) {
				console.error(`[PLUS-ROLE-CHECK] Error processing user ${user.user_id}:`, error);
				errors++;
			}
		}

		// Create summary message
		const summary =
			`✅ **Plus Role Check Complete**\n\n` +
			`👥 Users checked: ${usersChecked}\n` +
			`✅ Already had role: ${alreadyHadRole}\n` +
			`➕ Roles added: ${rolesAdded}\n` +
			`❌ Errors: ${errors}`;

		console.log(`[PLUS-ROLE-CHECK] ${summary.replace(/\*\*/g, '').replace(/\n/g, ' ')}`);

		await interaction.editReply(summary);
	},
};
