const mongoose = require('mongoose');

/**
 * Connect to MongoDB Database
 * Uses connection string from .env file
 */
const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variables
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/typing-game';

    // Determine if this is a MongoDB Atlas connection
    const isAtlas = mongoURI.includes('mongodb+srv://');

    // Configure connection options
    const options = {
      serverSelectionTimeoutMS: 30000, // Increase timeout
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    };

    // Only add TLS options for Atlas connections
    if (isAtlas) {
      options.tls = true;
      options.tlsAllowInvalidCertificates = true; // Allow invalid certs for Atlas
    } else {
      options.family = 4; // Use IPv4 for local connections
    }

    // Connect to MongoDB
    await mongoose.connect(mongoURI, options);

    console.log('✅ MongoDB Connected Successfully!');
    console.log(`📦 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);

    // Warm up NeonDB immediately — free tier goes cold after 5 min of inactivity.
    // FerretDB wakes NeonDB during startup, but this confirms the path is live.
    try {
      await mongoose.connection.db.command({ ping: 1 });
      console.log('🔥 NeonDB warm and ready');
    } catch (e) {
      console.warn('⚠️  NeonDB warm-up ping failed:', e.message);
    }

    // Keep NeonDB awake: ping every 4 minutes so logins never hit a cold database
    setInterval(async () => {
      try {
        await mongoose.connection.db.command({ ping: 1 });
      } catch (err) {
        console.error('❌ Keep-alive ping failed:', err.message);
      }
    }, 4 * 60 * 1000);

  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.error('⚠️  Server will continue running without database connection');
    console.error('💡 Some features (auth, leaderboards, stats) will not work');
    console.error('💡 You can still play games as a guest!');
    // Don't exit - let server run for guest play
  }
};

// Handle connection events BEFORE attempting to connect
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB Disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Error:', err.message);
  // Don't crash the server on MongoDB errors
});

// Handle uncaught MongoDB errors
process.on('unhandledRejection', (reason) => {
  if (reason && reason.toString().includes('Mongo')) {
    console.error('❌ Unhandled MongoDB Error:', reason);
    // Don't crash - continue running
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 MongoDB connection closed due to app termination');
  process.exit(0);
});

module.exports = connectDB;
