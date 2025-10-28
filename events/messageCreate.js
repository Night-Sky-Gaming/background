const { Events } = require('discord.js');
const { getUser, updateUser, calculateLevel } = require('../database.js');

// XP settings
// 1 XP per message
const XP_PER_MESSAGE = 1;

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		// Ignore bots and DMs
		if (message.author.bot || !message.guild) return;

		const userId = message.author.id;
		const guildId = message.guild.id;

		// Get user from database
		const userData = getUser(userId, guildId);

		// Calculate XP gain
		const xpGain = XP_PER_MESSAGE;
		const newXp = userData.xp + xpGain;
		const newLevel = calculateLevel(newXp);
		const oldLevel = userData.level;

		// Update user in database
		const now = Date.now();
		updateUser(userId, guildId, newXp, newLevel, now);

		// Check if user leveled up
		if (newLevel > oldLevel) {
			try {
				// Assign '+' role at level 5
				if (newLevel === 5) {
					const role = message.guild.roles.cache.find((r) => r.name === '+');
					if (role) {
						try {
							const member = await message.guild.members.fetch(userId);
							await member.roles.add(role);
							await message.channel.send(
								`🎉 Congratulations ${message.author}! You've reached **Level ${newLevel}** and earned the **${role.name}** role!`,
							);
						}
						catch (roleError) {
							console.error('Error assigning + role:', roleError);
							await message.channel.send(
								`🎉 Congratulations ${message.author}! You've reached **Level ${newLevel}**! (Unable to assign role)`,
							);
						}
					}
					else {
						console.warn('Role "+" not found in guild:', message.guild.name);
						await message.channel.send(
							`🎉 Congratulations ${message.author}! You've reached **Level ${newLevel}**! (Role "+" not found)`,
						);
					}
				}
				else {
					await message.channel.send(
						`🎉 Congratulations ${message.author}! You've reached **Level ${newLevel}**!`,
					);
				}
			}
			catch (error) {
				console.error('Error sending level up message:', error);
			}
		}
	},
};
