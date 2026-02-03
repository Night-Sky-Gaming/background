const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const REGION_ROLES = {
	'🇪🇺': 'Europe',
	'🌏': 'Asia',
	'🇺🇸': 'North America',
	'🇧🇷': 'South America',
	'🌍': 'Africa',
	'🦘': 'Oceania',
};

const REGION_CHANNEL_ID = '1468303150690734314';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup-region-roles')
		.setDescription('Posts the region role selection message')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction) {
		// Defer the reply since this might take a moment
		await interaction.deferReply({ ephemeral: true });

		try {
			const channel = interaction.guild.channels.cache.get(REGION_CHANNEL_ID);

			if (!channel) {
				return interaction.editReply('❌ Could not find the specified channel!');
			}

			// Create embed
			const embed = new EmbedBuilder()
				.setColor('#5865F2')
				.setTitle('🗺️ Region Roles')
				.setDescription(
					'React to this message to get your region role!\n\n' +
					'🇪🇺 - Europe\n' +
					'🌏 - Asia\n' +
					'🇺🇸 - North America\n' +
					'🇧🇷 - South America\n' +
					'🌍 - Africa\n' +
					'🦘 - Oceania\n\n' +
					'*Remove your reaction to remove the role.*'
				)
				.setFooter({ text: 'Select your region to connect with nearby members!' });

			// Try to find existing region role message
			let existingMessage = null;
			const messages = await channel.messages.fetch({ limit: 100 });
			
			for (const msg of messages.values()) {
				if (msg.author.id === interaction.client.user.id && 
					msg.embeds.length > 0 && 
					msg.embeds[0].title === '🗺️ Region Roles') {
					existingMessage = msg;
					break;
				}
			}

			let message;
			if (existingMessage) {
				// Edit the existing message
				message = await existingMessage.edit({ embeds: [embed] });
				await interaction.editReply(`✅ Region role message updated in <#${REGION_CHANNEL_ID}>!`);
				console.log('[REGION ROLES] Setup message updated successfully');
			} else {
				// Send a new message if none exists
				message = await channel.send({ embeds: [embed] });
				await interaction.editReply(`✅ Region role message posted in <#${REGION_CHANNEL_ID}>!`);
				console.log('[REGION ROLES] Setup message posted successfully');
			}

			// Add any missing reactions
			for (const emoji of Object.keys(REGION_ROLES)) {
				const existingReaction = message.reactions.cache.get(emoji);
				if (!existingReaction || !existingReaction.me) {
					await message.react(emoji);
				}
			}
		} catch (error) {
			console.error('[REGION ROLES] Error setting up region roles:', error);
			await interaction.editReply('❌ An error occurred while setting up region roles.');
		}
	},
};
