const Database = require('better-sqlite3');
const path = require('node:path');

// Create/open database
const db = new Database(path.join(__dirname, 'leveling.db'));

// Create tables if they don't exist
db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		guild_id TEXT NOT NULL,
		xp INTEGER DEFAULT 0,
		level INTEGER DEFAULT 1,
		last_message INTEGER DEFAULT 0,
		voice_join_time INTEGER DEFAULT 0,
		voice_total_time INTEGER DEFAULT 0,
		UNIQUE(user_id, guild_id)
	)
`);

// Migration: Add voice tracking columns if they don't exist
try {
	db.exec(`ALTER TABLE users ADD COLUMN voice_join_time INTEGER DEFAULT 0`);
	console.log('Added voice_join_time column');
} catch (error) {
	// Column already exists, ignore error
}

try {
	db.exec(`ALTER TABLE users ADD COLUMN voice_total_time INTEGER DEFAULT 0`);
	console.log('Added voice_total_time column');
} catch (error) {
	// Column already exists, ignore error
}

// Prepared statements for better performance
const statements = {
	getUser: db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?'),
	createUser: db.prepare('INSERT OR IGNORE INTO users (id, user_id, guild_id, xp, level, last_message, voice_join_time, voice_total_time) VALUES (?, ?, ?, 0, 1, 0, 0, 0)'),
	updateUser: db.prepare('UPDATE users SET xp = ?, level = ?, last_message = ? WHERE user_id = ? AND guild_id = ?'),
	updateVoiceJoinTime: db.prepare('UPDATE users SET voice_join_time = ? WHERE user_id = ? AND guild_id = ?'),
	updateVoiceStats: db.prepare('UPDATE users SET voice_total_time = ?, xp = ?, level = ?, voice_join_time = 0 WHERE user_id = ? AND guild_id = ?'),
	getLeaderboard: db.prepare('SELECT * FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT ?'),
	getUserRank: db.prepare('SELECT COUNT(*) + 1 as rank FROM users WHERE guild_id = ? AND xp > (SELECT xp FROM users WHERE user_id = ? AND guild_id = ?)'),
};

// Helper functions
function getUser(userId, guildId) {
	const uniqueId = `${guildId}-${userId}`;
	statements.createUser.run(uniqueId, userId, guildId);
	return statements.getUser.get(userId, guildId);
}

function updateUser(userId, guildId, xp, level, lastMessage) {
	statements.updateUser.run(xp, level, lastMessage, userId, guildId);
}

function getLeaderboard(guildId, limit = 10) {
	return statements.getLeaderboard.all(guildId, limit);
}

function getUserRank(userId, guildId) {
	const result = statements.getUserRank.get(guildId, userId, guildId);
	return result ? result.rank : null;
}

// Calculate level from XP
function calculateLevel(xp) {
	// Formula: level = floor(0.1 * sqrt(xp))
	// This means: Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 400 XP, Level 10 = 10,000 XP
	return Math.floor(0.1 * Math.sqrt(xp)) + 1;
}

// Calculate XP needed for next level
function xpForNextLevel(currentLevel) {
	// Reverse of calculateLevel formula
	return Math.pow((currentLevel) * 10, 2);
}

// Voice channel tracking functions
function setVoiceJoinTime(userId, guildId, joinTime) {
	statements.updateVoiceJoinTime.run(joinTime, userId, guildId);
}

function updateVoiceTime(userId, guildId, timeSpent, wasAlone = false) {
	const userData = getUser(userId, guildId);
	const newVoiceTotal = userData.voice_total_time + timeSpent;

	// Award 50 XP per hour (timeSpent is in milliseconds)
	// But only if the user wasn't alone in the channel
	const hoursSpent = timeSpent / (1000 * 60 * 60);
	const xpGain = wasAlone ? 0 : Math.floor(hoursSpent * 50);

	const newXp = userData.xp + xpGain;
	const newLevel = calculateLevel(newXp);

	statements.updateVoiceStats.run(newVoiceTotal, newXp, newLevel, userId, guildId);

	return { oldLevel: userData.level, newLevel, xpGain };
}

// Helper function to format voice time from milliseconds
function formatVoiceTime(milliseconds) {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	} else {
		return `${seconds}s`;
	}
}

// Get voice time statistics for a user
function getVoiceTimeStats(userId, guildId) {
	const userData = getUser(userId, guildId);
	return {
		totalMilliseconds: userData.voice_total_time,
		totalSeconds: Math.floor(userData.voice_total_time / 1000),
		totalMinutes: Math.floor(userData.voice_total_time / (1000 * 60)),
		totalHours: userData.voice_total_time / (1000 * 60 * 60),
		formatted: formatVoiceTime(userData.voice_total_time),
	};
}

module.exports = {
	db,
	getUser,
	updateUser,
	getLeaderboard,
	getUserRank,
	calculateLevel,
	xpForNextLevel,
	setVoiceJoinTime,
	updateVoiceTime,
	formatVoiceTime,
	getVoiceTimeStats,
};
