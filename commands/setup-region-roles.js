const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const REGION_ROLES = {
	'🇪🇺': 'Europe',
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
					'🇺🇸 - North America\n' +
					'🇧🇷 - South America\n' +
					'🌍 - Africa\n' +
					'🦘 - Oceania\n\n' +
					'*Remove your reaction to remove the role.*'
				)
				.setFooter({ text: 'Select your region to connect with nearby members!' });

			// Send the message
			const message = await channel.send({ embeds: [embed] });

			// Add reactions
			for (const emoji of Object.keys(REGION_ROLES)) {
				await message.react(emoji);
			}

			await interaction.editReply(`✅ Region role message posted in <#${REGION_CHANNEL_ID}>!`);
			console.log('[REGION ROLES] Setup message posted successfully');
		} catch (error) {
			console.error('[REGION ROLES] Error setting up region roles:', error);
			await interaction.editReply('❌ An error occurred while setting up region roles.');
		}
	},
};
