const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const { updateLastActivity, getUser } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('backfill-activity')
		.setDescription('Scan all channels and update last_activity for all users')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addIntegerOption(option =>
			option
				.setName('days')
				.setDescription('How many days back to scan (default: 30, max: 90)')
				.setRequired(false)
				.setMinValue(1)
				.setMaxValue(90)
		),
	async execute(interaction) {
		const daysToScan = interaction.options.getInteger('days') || 30;
		
		// Create confirmation buttons
		const confirmButton = new ButtonBuilder()
			.setCustomId('confirm_backfill')
			.setLabel('Confirm')
			.setStyle(ButtonStyle.Danger);
		
		const cancelButton = new ButtonBuilder()
			.setCustomId('cancel_backfill')
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);
		
		const row = new ActionRowBuilder()
			.addComponents(cancelButton, confirmButton);
		
		// Send confirmation message
		const confirmMessage = await interaction.reply({
			content: 
				`⚠️ **Backfill Activity Warning**\n\n` +
				`This will scan **all text channels** going back **${daysToScan} days**.\n\n` +
				`• This may take **several minutes** to complete\n` +
				`• The bot may be rate-limited by Discord\n` +
				`• This should only be run **once** after the update\n\n` +
				`Are you sure you want to continue?`,
			components: [row],
			flags: MessageFlags.Ephemeral,
			fetchReply: true,
		});
		
		// Wait for button interaction
		try {
			const confirmation = await confirmMessage.awaitMessageComponent({
				componentType: ComponentType.Button,
				time: 60000, // 60 second timeout
			});
			
			if (confirmation.customId === 'cancel_backfill') {
				await confirmation.update({
					content: '❌ Backfill cancelled.',
					components: [],
				});
				return;
			}
			
			// User confirmed, proceed with backfill
			await confirmation.update({
				content: `🔍 Starting to scan channels... This may take several minutes.\nScanning up to ${daysToScan} days back.`,
				components: [],
			});
			
		} catch (error) {
			// Timeout - no response
			await interaction.editReply({
				content: '❌ Confirmation timeout - backfill cancelled.',
				components: [],
			});
			return;
		}
		const guildId = '1430038605518077964'; // Andromeda Gaming guild ID
		const guild = interaction.client.guilds.cache.get(guildId);
		
		if (!guild) {
			return interaction.editReply({
				content: '❌ Could not find Andromeda Gaming guild.',
				components: [],
			});
		}
		
		const cutoffTime = Date.now() - (daysToScan * 24 * 60 * 60 * 1000);
		const userLastMessages = new Map(); // userId -> timestamp
		
		let channelsScanned = 0;
		let messagesScanned = 0;
		let usersFound = 0;
		
		try {
			// Fetch all channels
			const channels = await guild.channels.fetch();
			const textChannels = channels.filter(channel => 
				channel.isTextBased() && !channel.isVoiceBased() && !channel.isThread()
			);
			
			console.log(`[BACKFILL] Starting scan of ${textChannels.size} text channels, going back ${daysToScan} days`);
			
			for (const [channelId, channel] of textChannels) {
				try {
					// Skip if bot doesn't have permission to read
					if (!channel.permissionsFor(guild.members.me).has('ViewChannel') ||
					    !channel.permissionsFor(guild.members.me).has('ReadMessageHistory')) {
						console.log(`[BACKFILL] Skipping ${channel.name} - no permission`);
						continue;
					}
					
					let lastMessageId = null;
					let channelMessagesScanned = 0;
					let reachedCutoff = false;
					
					// Fetch messages in batches of 100 (Discord API limit)
					while (!reachedCutoff) {
						const options = { limit: 100 };
						if (lastMessageId) {
							options.before = lastMessageId;
						}
						
						// This will automatically handle rate limits
						const messages = await channel.messages.fetch(options);
						
						if (messages.size === 0) break;
						
						for (const [msgId, msg] of messages) {
							// Stop if we've gone past our cutoff date
							if (msg.createdTimestamp < cutoffTime) {
								reachedCutoff = true;
								break;
							}
							
							// Skip bot messages
							if (msg.author.bot) continue;
							
							const userId = msg.author.id;
							const existingTimestamp = userLastMessages.get(userId);
							
							// Keep the most recent message timestamp for each user
							if (!existingTimestamp || msg.createdTimestamp > existingTimestamp) {
								userLastMessages.set(userId, msg.createdTimestamp);
							}
							
							channelMessagesScanned++;
							messagesScanned++;
						}
						
						lastMessageId = messages.last()?.id;
						
						// If we got fewer than 100 messages, we've reached the end
						if (messages.size < 100) break;
					}
					
					channelsScanned++;
					console.log(`[BACKFILL] Scanned #${channel.name}: ${channelMessagesScanned} messages`);
					
					// Update progress every 10 channels
					if (channelsScanned % 10 === 0) {
						await interaction.editReply(
							`🔍 Progress: ${channelsScanned}/${textChannels.size} channels scanned\n` +
							`📨 Messages scanned: ${messagesScanned.toLocaleString()}\n` +
							`👥 Users found: ${userLastMessages.size}`
						);
					}
					
				} catch (error) {
					console.error(`[BACKFILL] Error scanning channel ${channel.name}:`, error);
					// Continue with next channel
				}
			}
			
			// Update database with all the collected timestamps
			console.log(`[BACKFILL] Updating database for ${userLastMessages.size} users...`);
			
			for (const [userId, timestamp] of userLastMessages) {
				try {
					// Ensure user exists in database
					getUser(userId, guildId);
					// Update their last_activity
					updateLastActivity(userId, guildId, timestamp);
					usersFound++;
				} catch (error) {
					console.error(`[BACKFILL] Error updating user ${userId}:`, error);
				}
			}
			
			const summary = 
				`✅ **Backfill Complete!**\n\n` +
				`📂 Channels scanned: ${channelsScanned}\n` +
				`📨 Messages scanned: ${messagesScanned.toLocaleString()}\n` +
				`👥 Users updated: ${usersFound}\n` +
				`📅 Scanned back: ${daysToScan} days`;
			
			console.log(`[BACKFILL] ${summary.replace(/\*\*/g, '').replace(/\n/g, ' ')}`);
			
			await interaction.editReply(summary);
			
		} catch (error) {
			console.error('[BACKFILL] Fatal error during backfill:', error);
			await interaction.editReply(`❌ Error during backfill: ${error.message}`);
		}
	},
};
