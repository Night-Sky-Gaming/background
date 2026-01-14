const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
	getUser,
	setVoiceJoinTime,
	updateVoiceTime,
	updateLastActivity,
	getNotificationPreference,
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

			// Check if anyone is left alone in the old channel after this user leaves
			const remainingMembers = oldState.channel.members.filter(
				(member) => !member.user.bot,
			);
			
			// If exactly one person is left, they are now alone
			if (remainingMembers.size === 1) {
				const aloneUser = remainingMembers.first();
				const aloneSessionKey = `${guildId}-${aloneUser.id}`;
				const aloneUserData = getUser(aloneUser.id, guildId);
				
				// If they were with others and have a join time, award XP for the time with others
				if (wasEverWithOthers.get(aloneSessionKey) && aloneUserData.voice_join_time > 0) {
					const now = Date.now();
					const timeWithOthers = now - aloneUserData.voice_join_time;
					
					// Award XP for the time they were with others
					const result = updateVoiceTime(aloneUser.id, guildId, timeWithOthers, false);
					
					// Reset their join time to now (so alone time isn't counted)
					setVoiceJoinTime(aloneUser.id, guildId, now);
					
					const timeInMinutes = (timeWithOthers / (1000 * 60)).toFixed(2);
					console.log(`[VOICE] ${aloneUser.user.tag} is now alone in ${oldState.channel.name}, awarded ${result.xpGain} XP for ${timeInMinutes} minutes with others`);
				}
				
				// Mark them as alone going forward
				wasEverWithOthers.set(aloneSessionKey, false);
			}

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
					// Check if user wants notifications
					const notificationsEnabled = getNotificationPreference(userId, guildId);
					if (!notificationsEnabled) {
						console.log(`[VOICE LEVELUP] ${username} leveled up but has notifications disabled`);
					} else {
						try {
							const member = await newState.guild.members.fetch(userId);

							// Create button to disable notifications
							const disableButton = new ButtonBuilder()
								.setCustomId(`disable_notifications:${guildId}`)
								.setLabel('Disable Notifications')
								.setStyle(ButtonStyle.Secondary)
								.setEmoji('🔕');

							const row = new ActionRowBuilder().addComponents(disableButton);

							// Assign '+' role at level 3
							if (result.newLevel === 3) {
								const role = newState.guild.roles.cache.find(
									(r) => r.name === '+',
								);
								if (role) {
									try {
										await member.roles.add(role);
										await member.send({
											content: `🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat and earned the **${role.name}** role in **${newState.guild.name}**!`,
											components: [row],
										});
									}
									catch (roleError) {
										console.error('Error assigning + role:', roleError);
										await member.send({
											content: `🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat in **${newState.guild.name}**! (Unable to assign role)`,
											components: [row],
										});
									}
								}
								else {
									console.warn(
										'Role "+" not found in guild:',
										newState.guild.name,
									);
									await member.send({
										content: `🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat in **${newState.guild.name}**! (Role "+" not found)`,
										components: [row],
									});
								}
							}
							else {
								await member.send({
									content: `🎉 Congratulations! You've reached **Level ${result.newLevel}** from voice chat in **${newState.guild.name}**!`,
									components: [row],
								});
							}
						}
						catch (error) {
							console.error('Error sending voice level up message:', error);
						}
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
