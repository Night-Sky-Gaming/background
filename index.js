const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const { getAllUsersInGuild, checkInactivityAndReduce } = require('./database.js');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
	],
});

// Load commands
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFiles = fs
	.readdirSync(foldersPath)
	.filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(foldersPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	}
	else {
		console.log(
			`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
		);
	}
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
	.readdirSync(eventsPath)
	.filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Initialize database
console.log('Database initialized');

// Auto-bump scheduler
function scheduleNextBump() {
	const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
	const randomSeconds = Math.floor(Math.random() * 30) + 1; // Random 1-30 seconds
	const randomMs = randomSeconds * 1000;
	const totalDelay = twoHours + randomMs;
	
	setTimeout(async () => {
		const channelId = '1443734228352110662'; // bot-dev-commands channel
		const channel = client.channels.cache.get(channelId);
		
		if (channel) {
			try {
				// Send reminder to bump (bots cannot invoke other bots' slash commands)
				await channel.send('🔔 **Bump Reminder**: Please run </bump:947088344167366698> to bump the server!');
				console.log(`[AUTO-BUMP] Bump reminder sent (+${randomSeconds}s delay)`);
			} catch (error) {
				console.error('[AUTO-BUMP] Error sending bump reminder:', error);
			}
		} else {
			console.error('[AUTO-BUMP] Could not find bot-dev-commands channel');
		}
		
		// Schedule next bump
		scheduleNextBump();
	}, totalDelay);
	
	const nextBumpTime = new Date(Date.now() + totalDelay);
	console.log(`[AUTO-BUMP] Next bump scheduled for ${nextBumpTime.toLocaleString()} (2h + ${randomSeconds}s)`);
}

// Weekly activity check scheduler
function scheduleWeeklyActivityCheck() {
	const now = new Date();
	const nextSunday = new Date(now);
	
	// Set to next Sunday at midnight UTC
	nextSunday.setUTCDate(now.getUTCDate() + (7 - now.getUTCDay()));
	nextSunday.setUTCHours(0, 0, 0, 0);
	
	// If it's already Sunday after midnight, schedule for next week
	if (nextSunday <= now) {
		nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
	}
	
	const timeUntilCheck = nextSunday - now;
	
	setTimeout(async () => {
		console.log('[ACTIVITY CHECK] Running weekly activity check...');
		
		const guildId = '1430038605518077964'; // Andromeda Gaming guild ID
		const guild = client.guilds.cache.get(guildId);
		
		if (!guild) {
			console.error('[ACTIVITY CHECK] Could not find Andromeda Gaming guild');
			scheduleWeeklyActivityCheck();
			return;
		}
		
		const allUsers = getAllUsersInGuild(guildId);
		const reductions = [];
		
		for (const user of allUsers) {
			const result = checkInactivityAndReduce(user.user_id, guildId);
			
			if (result.reduced) {
				const xpLost = result.oldXp - result.newXp;
				reductions.push({
					userId: user.user_id,
					oldXp: result.oldXp,
					newXp: result.newXp,
					xpLost,
					oldLevel: result.oldLevel,
					newLevel: result.newLevel,
				});
				
				console.log(`[XP REDUCTION] User ${user.user_id}: ${result.oldXp} XP -> ${result.newXp} XP (Lost ${xpLost} XP due to inactivity)`);
			}
		}
		
		if (reductions.length > 0) {
			// Create summary message
			let summary = `**Weekly Activity Check - ${new Date().toLocaleDateString()}**\n\n${reductions.length} user(s) had XP reduced due to inactivity (7+ days):\n\n`;
			
			for (const reduction of reductions) {
				const member = await guild.members.fetch(reduction.userId).catch(() => null);
				const username = member ? member.user.username : `User ${reduction.userId}`;
				summary += `• **${username}**: ${reduction.oldXp.toLocaleString()} → ${reduction.newXp.toLocaleString()} XP (-${reduction.xpLost.toLocaleString()})\n`;
				if (reduction.oldLevel !== reduction.newLevel) {
					summary += `  Level ${reduction.oldLevel} → Level ${reduction.newLevel}\n`;
				}
			}
			
			// Send to logs channel
			const logsChannelId = '1444466700006461564'; // other-logs channel
			const logsChannel = client.channels.cache.get(logsChannelId);
			
			if (logsChannel) {
				await logsChannel.send(summary);
			} else {
				console.error('[ACTIVITY CHECK] Could not find other-logs channel');
			}
			
			// DM the admin
			const adminId = '1084918048638652426';
			const admin = await client.users.fetch(adminId).catch(() => null);
			
			if (admin) {
				try {
					await admin.send(summary);
				} catch (error) {
					console.error('[ACTIVITY CHECK] Could not DM admin:', error);
				}
			}
			
			console.log(`[ACTIVITY CHECK] Weekly check complete. ${reductions.length} user(s) had XP reduced.`);
		} else {
			console.log('[ACTIVITY CHECK] Weekly check complete. No users were inactive.');
		}
		
		// Schedule next week's check
		scheduleWeeklyActivityCheck();
	}, timeUntilCheck);
	
	console.log(`[ACTIVITY CHECK] Next weekly check scheduled for ${nextSunday.toLocaleString()}`);
}

// Start schedulers when bot is ready
client.once('clientReady', () => {
	scheduleNextBump();
	scheduleWeeklyActivityCheck();
});

// Log in to Discord with your client's token
client.login(token);
