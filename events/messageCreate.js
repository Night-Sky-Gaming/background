const { Events } = require('discord.js');
const { getUser, updateUserWithActivity, calculateLevel } = require('../database.js');

// XP settings
// 1 XP per message
const XP_PER_MESSAGE = 1;
// Cooldown in milliseconds (60 seconds = 60000ms)
const XP_COOLDOWN = 60000;

// Map to track last XP gain timestamp for each user
const xpCooldowns = new Map();

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		// Ignore bots and DMs
		if (message.author.bot || !message.guild) return;

		const userId = message.author.id;
		const guildId = message.guild.id;

		// Check cooldown
		const cooldownKey = `${userId}-${guildId}`;
		const now = Date.now();
		const lastXpTime = xpCooldowns.get(cooldownKey);

		if (lastXpTime && now - lastXpTime < XP_COOLDOWN) {
			// User is still on cooldown, don't award XP
			return;
		}

		// Update cooldown timestamp
		xpCooldowns.set(cooldownKey, now);

		// Get user from database
		const userData = getUser(userId, guildId);

		// Calculate XP gain
		const xpGain = XP_PER_MESSAGE;
		const newXp = userData.xp + xpGain;
		const newLevel = calculateLevel(newXp);
		const oldLevel = userData.level;

	// Update user in database with last_activity timestamp
	updateUserWithActivity(userId, guildId, newXp, newLevel, now, now);

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
						await message.author.send(
							`🎉 Congratulations! You've reached **Level ${newLevel}** and earned the **${role.name}** role in **${message.guild.name}**!`,
						);
					}
					catch (roleError) {
						console.error('Error assigning + role:', roleError);
						await message.author.send(
							`🎉 Congratulations! You've reached **Level ${newLevel}** in **${message.guild.name}**! (Unable to assign role)`,
						);
					}
				}
				else {
					console.warn('Role "+" not found in guild:', message.guild.name);
					await message.author.send(
						`🎉 Congratulations! You've reached **Level ${newLevel}** in **${message.guild.name}**! (Role "+" not found)`,
					);
				}
			}
			else {
				await message.author.send(
					`🎉 Congratulations! You've reached **Level ${newLevel}** in **${message.guild.name}**!`,
				);
			}
		}
		catch (error) {
			console.error('Error sending level up message:', error);
		}
	}
	},
};
