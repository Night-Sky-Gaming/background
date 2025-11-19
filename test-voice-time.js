const { formatVoiceTime, getVoiceTimeStats, db } = require('./database.js');

console.log('=== Voice Time Conversion Test ===\n');

// Test the formatting function
const testValues = [
	{ ms: 1303842, expected: '21m 43s' },
	{ ms: 2496, expected: '2s' },
	{ ms: 3600000, expected: '1h 0m' },
	{ ms: 3661000, expected: '1h 1m' },
];

console.log('Testing formatVoiceTime function:');
testValues.forEach(({ ms, expected }) => {
	const formatted = formatVoiceTime(ms);
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(ms / (1000 * 60));
	const hours = (ms / (1000 * 60 * 60)).toFixed(2);
	console.log(`  ${ms}ms = ${formatted} (${seconds}s / ${minutes}min / ${hours}h)`);
});

console.log('\n=== Actual Database Values ===\n');

// Get actual users from database
const users = db.prepare('SELECT user_id, voice_total_time, xp, level FROM users WHERE voice_total_time > 0 ORDER BY voice_total_time DESC LIMIT 5').all();

if (users.length === 0) {
	console.log('No users with voice time found in database.');
} else {
	users.forEach((user, index) => {
		console.log(`User ${index + 1}:`);
		console.log(`  User ID: ${user.user_id}`);
		console.log(`  Raw value in DB: ${user.voice_total_time}`);
		console.log(`  As seconds: ${Math.floor(user.voice_total_time / 1000)}s`);
		console.log(`  As minutes: ${Math.floor(user.voice_total_time / (1000 * 60))}min`);
		console.log(`  As hours: ${(user.voice_total_time / (1000 * 60 * 60)).toFixed(2)}h`);
		console.log(`  Formatted: ${formatVoiceTime(user.voice_total_time)}`);
		console.log(`  Level: ${user.level}, XP: ${user.xp}`);
		console.log('');
	});
}

console.log('=== Fix for Web Interface ===\n');
console.log('The database stores voice_total_time in MILLISECONDS.');
console.log('To convert to hours for display:');
console.log('  hours = voice_total_time / (1000 * 60 * 60)');
console.log('  OR use: hours = voice_total_time / 3600000');
console.log('\nTo convert to minutes:');
console.log('  minutes = voice_total_time / (1000 * 60)');
console.log('  OR use: minutes = voice_total_time / 60000');
console.log('\nExample with 1303842ms:');
console.log('  WRONG: 1303842 / 3600 = 362 hours ❌');
console.log('  RIGHT: 1303842 / 3600000 = 0.36 hours (21.7 minutes) ✅');
