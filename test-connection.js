// Simple connection test
require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB Atlas Connection...\n');
console.log('Connection String:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('\n✅ Successfully connected to MongoDB Atlas!');
  console.log('Database:', mongoose.connection.name);
  console.log('Host:', mongoose.connection.host);
  process.exit(0);
})
.catch((error) => {
  console.error('\n❌ Connection failed!');
  console.error('Error:', error.message);
  console.error('\n📝 Possible solutions:');
  console.error('1. Check if your IP is whitelisted in MongoDB Atlas');
  console.error('2. Make sure you chose "Allow access from anywhere" (0.0.0.0/0)');
  console.error('3. Check if your password is correct');
  console.error('4. Try flushing DNS: ipconfig /flushdns');
  process.exit(1);
});
