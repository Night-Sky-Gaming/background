const { Events } = require('discord.js');
const {
	getUser,
	setVoiceJoinTime,
	updateVoiceTime,
} = require('../database.js');

module.exports = {
	name: Events.VoiceStateUpdate,
	async execute(oldState, newState) {
		const userId = newState.id;
		const guildId = newState.guild.id;

		// User joined a voice channel
		if (!oldState.channelId && newState.channelId) {
			const now = Date.now();
			setVoiceJoinTime(userId, guildId, now);
			const username = newState.member.user.tag;
			const channelName = newState.channel.name;
			console.log(`[Voice] ${username} joined ${channelName}`);
		}
		// User left a voice channel
		else if (oldState.channelId && !newState.channelId) {
			const userData = getUser(userId, guildId);

			// Only process if they have a join time recorded
			if (userData.voice_join_time > 0) {
				const now = Date.now();
				const timeSpent = now - userData.voice_join_time;

				// Check if user was alone in the channel
				// Count non-bot members in the channel (excluding the user who just left)
				const membersInChannel = oldState.channel.members.filter(
					(member) => !member.user.bot && member.id !== userId,
				).size;
				const wasAlone = membersInChannel === 0;

				const result = updateVoiceTime(userId, guildId, timeSpent, wasAlone);

				const username = oldState.member.user.tag;
				const channelName = oldState.channel.name;
				const timeInMinutes = (timeSpent / (1000 * 60)).toFixed(2);
				
				if (wasAlone) {
					console.log(
						`[Voice] ${username} left ${channelName} after ${timeInMinutes} minutes, gained 0 XP (alone in channel)`,
					);
				} else {
					console.log(
						`[Voice] ${username} left ${channelName} after ${timeInMinutes} minutes, gained ${result.xpGain} XP`,
					);
				}

				// Check if user leveled up
				if (result.newLevel > result.oldLevel) {
					try {
						const member = await newState.guild.members.fetch(userId);
						const channel =
							newState.guild.systemChannel ||
							newState.guild.channels.cache.find(
								(ch) =>
									ch.isTextBased() &&
									ch
										.permissionsFor(newState.guild.members.me)
										.has('SendMessages'),
							);

						if (channel) {
							// Assign '+' role at level 5
							if (result.newLevel === 5) {
								const role = newState.guild.roles.cache.find(
									(r) => r.name === '+',
								);
								if (role) {
									try {
										await member.roles.add(role);
										await channel.send(
											`🎉 Congratulations <@${userId}>! You've reached **Level ${result.newLevel}** from voice chat and earned the **${role.name}** role!`,
										);
									}
									catch (roleError) {
										console.error('Error assigning + role:', roleError);
										await channel.send(
											`🎉 Congratulations <@${userId}>! You've reached **Level ${result.newLevel}** from voice chat! (Unable to assign role)`,
										);
									}
								}
								else {
									console.warn(
										'Role "+" not found in guild:',
										newState.guild.name,
									);
									await channel.send(
										`🎉 Congratulations <@${userId}>! You've reached **Level ${result.newLevel}** from voice chat! (Role "+" not found)`,
									);
								}
							}
							else {
								await channel.send(
									`🎉 Congratulations <@${userId}>! You've reached **Level ${result.newLevel}** from voice chat!`,
								);
							}
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
				`[Voice] ${username} switched from ${oldChannelName} to ${newChannelName}`,
			);
			// Don't reset the timer when switching channels
		}
	},
};
