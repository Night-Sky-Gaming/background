const { Events } = require('discord.js');

const REGION_ROLES = {
	'🇪🇺': 'Europe',
	'🇺🇸': 'North America',
	'🇧🇷': 'South America',
	'🌍': 'Africa',
	'🦘': 'Oceania',
};

const REGION_CHANNEL_ID = '1468303150690734314';

module.exports = {
	name: Events.MessageReactionAdd,
	async execute(reaction, user) {
		// Ignore bot reactions
		if (user.bot) return;

		// When a reaction is received, check if the structure is partial
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (error) {
				console.error('[REGION ROLES] Error fetching reaction:', error);
				return;
			}
		}

		// Check if reaction is in the region roles channel
		if (reaction.message.channel.id !== REGION_CHANNEL_ID) return;

		// Check if the emoji is one of our region emojis
		const emoji = reaction.emoji.name;
		const roleName = REGION_ROLES[emoji];

		if (!roleName) return;

		try {
			const member = await reaction.message.guild.members.fetch(user.id);
			const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);

			if (!role) {
				console.error(`[REGION ROLES] Role "${roleName}" not found in guild`);
				return;
			}

			// Add the role
			await member.roles.add(role);
			console.log(`[REGION ROLES] Added role "${roleName}" to ${user.tag}`);

			// Send a DM confirmation (optional)
			try {
				await user.send(`✅ You've been given the **${roleName}** role in Andromeda Gaming!`);
			} catch (error) {
				// User might have DMs disabled, that's okay
				console.log(`[REGION ROLES] Could not DM ${user.tag}`);
			}
		} catch (error) {
			console.error('[REGION ROLES] Error adding role:', error);
		}
	},
};
