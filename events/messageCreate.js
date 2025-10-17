const { Events } = require('discord.js');
const { getUser, updateUser, calculateLevel } = require('../database.js');

// XP settings
const XP_PER_MESSAGE = 15; // Base XP per message
const XP_RANDOM_BONUS = 10; // Random bonus 0-10 XP
const XP_COOLDOWN = 60000; // 1 minute cooldown between XP gains (prevents spam)

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		// Ignore bots and DMs
		if (message.author.bot || !message.guild) return;

		const userId = message.author.id;
		const guildId = message.guild.id;

		// Get user from database
		const userData = getUser(userId, guildId);

		// Check cooldown
		const now = Date.now();
		if (now - userData.last_message < XP_COOLDOWN) {
			return; // User is on cooldown
		}

		// Calculate XP gain (random between XP_PER_MESSAGE and XP_PER_MESSAGE + XP_RANDOM_BONUS)
		const xpGain = Math.floor(Math.random() * (XP_RANDOM_BONUS + 1)) + XP_PER_MESSAGE;
		const newXp = userData.xp + xpGain;
		const newLevel = calculateLevel(newXp);
		const oldLevel = userData.level;

		// Update user in database
		updateUser(userId, guildId, newXp, newLevel, now);

		// Check if user leveled up
		if (newLevel > oldLevel) {
			try {
				await message.channel.send(
					`🎉 Congratulations ${message.author}! You've reached **Level ${newLevel}**!`,
				);
			}
			catch (error) {
				console.error('Error sending level up message:', error);
			}
		}
	},
};
