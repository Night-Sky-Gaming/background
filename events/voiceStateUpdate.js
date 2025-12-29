const { Events } = require('discord.js');
const {
	getUser,
	setVoiceJoinTime,
	updateVoiceTime,
	updateLastActivity,
} = require('../database.js');

// Track if users were ever with others during their voice session
// Key: `${guildId}-${userId}`, Value: boolean (true if they were with others at any point)
const wasEverWithOthers = new Map();

module.exports = {
	name: Events.VoiceStateUpdate,
	async execute(oldState, newState) {
		const userId = newState.id;
		const guildId = newState.guild.id;

		// User joined a voice channel
		if (!oldState.channelId && newState.channelId) {
			const now = Date.now();
			setVoiceJoinTime(userId, guildId, now);
			
			// Update last_activity when joining voice
			updateLastActivity(userId, guildId, now);
			
			const username = newState.member.user.tag;
			const channelName = newState.channel.name;
			console.log(`[VOICE] ${username} joined ${channelName}`);

			// Check if there are other non-bot users in the channel
			const otherMembers = newState.channel.members.filter(
				(member) => !member.user.bot && member.id !== userId,
			).size;

			const sessionKey = `${guildId}-${userId}`;
			// Initialize tracking - if others are present, mark as true
			wasEverWithOthers.set(sessionKey, otherMembers > 0);

			// For all other users already in the channel, mark that they are now with others
			if (otherMembers > 0) {
				newState.channel.members.forEach((member) => {
					if (!member.user.bot && member.id !== userId) {
						const otherSessionKey = `${guildId}-${member.id}`;
						wasEverWithOthers.set(otherSessionKey, true);
					}
				});
			}
		}
		// User left a voice channel
		else if (oldState.channelId && !newState.channelId) {
			const userData = getUser(userId, guildId);

			// Only process if they have a join time recorded
			if (userData.voice_join_time > 0) {
				const now = Date.now();
				const timeSpent = now - userData.voice_join_time;

				// Check if user was ever with others during their session
				const sessionKey = `${guildId}-${userId}`;
				const wasWithOthers = wasEverWithOthers.get(sessionKey) || false;
				
				// Clean up the tracking
				wasEverWithOthers.delete(sessionKey);

				const result = updateVoiceTime(userId, guildId, timeSpent, !wasWithOthers);

				const username = oldState.member.user.tag;
				const channelName = oldState.channel.name;
				const timeInMinutes = (timeSpent / (1000 * 60)).toFixed(2);
				
				if (!wasWithOthers) {
					console.log(
						`[VOICE] ${username} left ${channelName} after ${timeInMinutes} minutes, gained 0 XP (alone in channel)`,
					);
				} else {
					console.log(
						`[VOICE] ${username} left ${channelName} after ${timeInMinutes} minutes, gained ${result.xpGain} XP`,
					);
				}

				// Check if user leveled up
				if (result.newLevel > result.oldLevel) {
					try {
						const member = await newState.guild.members.fetch(userId);

						// Assign '+' role at level 3
						if (result.newLevel === 3) {
							const role = newState.guild.roles.cache.find(
								(r) => r.name === '+',
							);
							if (role) {
								try {
									await member.roles.add(role);
									await member.send(
										`🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat and earned the **${role.name}** role in **${newState.guild.name}**!`,
									);
								}
								catch (roleError) {
									console.error('Error assigning + role:', roleError);
									await member.send(
										`🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat in **${newState.guild.name}**! (Unable to assign role)`,
									);
								}
							}
							else {
								console.warn(
									'Role "+" not found in guild:',
									newState.guild.name,
								);
								await member.send(
									`🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat in **${newState.guild.name}**! (Role "+" not found)`,
								);
							}
						}
						else {
							await member.send(
								`🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat in **${newState.guild.name}**!`,
							);
						}
					}
					catch (error) {
						console.error('Error sending voice level up message:', error);
					}
				}
			}
		}
		// User switched voice channels
		else if (
			oldState.channelId &&
			newState.channelId &&
			oldState.channelId !== newState.channelId
		) {
			const username = newState.member.user.tag;
			const oldChannelName = oldState.channel.name;
			const newChannelName = newState.channel.name;
			console.log(
				`[VOICE] ${username} switched from ${oldChannelName} to ${newChannelName}`,
			);
			// Don't reset the timer when switching channels
		}
	},
};
