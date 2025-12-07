/**
 * Database Connection Test Script
 * Run this to verify MongoDB is working before starting the server
 */

// Load environment variables FIRST
require('dotenv').config();

// Add mongoose connection options
const mongoose = require('mongoose');
const User = require('./models/User');
const GameHistory = require('./models/GameHistory');

async function testDatabase() {
  console.log('\n🧪 Testing Database Connection...\n');

  try {
    // Step 1: Connect to database
    console.log('Step 1: Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected Successfully!');
    console.log(`📦 Database: ${mongoose.connection.name}`);

    // Step 2: Test User model
    console.log('\nStep 2: Testing User Model...');
    const testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'TestPassword123', // Will be hashed automatically
      profile: {
        displayName: 'Test User',
        bio: 'This is a test user'
      }
    });

    console.log('✓ User model created successfully');
    console.log('  Username:', testUser.username);
    console.log('  Email:', testUser.email);

    // Step 3: Test password hashing (don't save, just validate)
    console.log('\nStep 3: Testing Password Hashing...');
    const testPassword = testUser.passwordHash;
    await testUser.save();
    console.log('✓ Password hashed successfully');
    console.log('  Original password length:', testPassword.length);
    console.log('  Hashed password length:', testUser.passwordHash.length);

    // Step 4: Test password comparison
    console.log('\nStep 4: Testing Password Verification...');
    const isMatch = await testUser.comparePassword('TestPassword123');
    const isWrong = await testUser.comparePassword('WrongPassword');
    console.log('✓ Correct password match:', isMatch);
    console.log('✓ Wrong password rejected:', !isWrong);

    // Step 5: Clean up test data
    console.log('\nStep 5: Cleaning up test data...');
    await User.deleteOne({ username: 'testuser' });
    console.log('✓ Test user deleted');

    // Step 6: Test GameHistory model
    console.log('\nStep 6: Testing GameHistory Model...');
    const testGame = new GameHistory({
      roomCode: '123456',
      gameMode: 'solo',
      difficulty: 'level3',
      passageLength: 'medium',
      passage: 'The quick brown fox jumps over the lazy dog',
      startTime: new Date(),
      endTime: new Date(),
      duration: 60000,
      players: [{
        username: 'testplayer',
        finalWPM: 50,
        finalAccuracy: 98,
        progress: 100,
        finishTime: 60000,
        placement: 1,
        isBot: false
      }],
      winner: {
        username: 'testplayer',
        isBot: false
      }
    });

    await testGame.save();
    console.log('✓ Game history created successfully');
    console.log('  Room Code:', testGame.roomCode);
    console.log('  Game Mode:', testGame.gameMode);

    // Clean up
    await GameHistory.deleteOne({ roomCode: '123456' });
    console.log('✓ Test game deleted');

    console.log('\n✅ All Database Tests Passed!\n');
    console.log('🎉 Your database is ready to use!');
    console.log('💡 You can now start the server with: npm start\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Database Test Failed!');
    console.error('Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Make sure MongoDB is installed and running');
    console.error('  2. Check your MONGODB_URI in .env file');
    console.error('  3. Try running: mongod (to start MongoDB server)');
    console.error('\n');
    process.exit(1);
  }
}

// Run the test
testDatabase();
