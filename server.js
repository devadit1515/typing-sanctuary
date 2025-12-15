// Load environment variables first
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});
const path = require('path');

// Import database connection
const connectDB = require('./config/database');

// Import models
const User = require('./models/User');
const Friend = require('./models/Friend');

// Import routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const gameRoutes = require('./routes/gameRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');
const friendsRoutes = require('./routes/friendsRoutes');

// Connect to database
connectDB();

// CORS Middleware - Must be before other middleware
const cors = require('cors');
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Session configuration with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    crypto: {
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-this'
    }
  }),
  cookie: {
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax'
  }
}));

// Health check endpoint (important for Netlify/deployment monitoring)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/friends', friendsRoutes);

// Serve static files from public directory
app.use(express.static('public'));

// Fallback route for SPA
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  // Serve index.html for client-side routing
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game rooms storage
const rooms = new Map();

// Typing passages categorized by length
const passages = {
  short: [
    "The quick brown fox jumps over the lazy dog while the sun sets behind the mountains.",
    "Coffee in the morning wakes up your mind and prepares you for a productive day ahead.",
    "Practice makes perfect when you dedicate time each day to improve your typing speed.",
    "Music brings joy and connects people from different cultures around the entire world.",
    "Reading books opens your mind to new ideas and takes you on amazing adventures."
  ],
  medium: [
    "The morning sun cast golden rays through the kitchen window as Sarah prepared breakfast for her family. The smell of fresh coffee and warm toast filled the air, creating a cozy atmosphere that made everyone feel at home.",
    "Mountain trails offer breathtaking views and peaceful solitude for hikers seeking adventure. The crisp air, towering pines, and distant peaks create an unforgettable experience that refreshes both body and mind in ways that city life cannot.",
    "Digital photography has revolutionized how we capture and share memories with friends and family. Modern cameras and smartphones make it easy to take stunning photos, edit them instantly, and post them online for the world to see.",
    "Libraries remain essential community spaces where people discover new books, attend educational programs, and access free resources. These quiet sanctuaries of knowledge continue to inspire curiosity and lifelong learning in readers of all ages.",
    "Home gardening provides fresh vegetables, beautiful flowers, and a rewarding hobby that connects people with nature. Whether growing tomatoes, herbs, or roses, gardeners enjoy the satisfaction of nurturing plants from seeds to harvest.",
    "Learning a new language opens doors to different cultures and creates opportunities for meaningful connections. Through practice and dedication, students gain confidence in speaking, reading, and understanding another way of communicating with the world.",
    "Ocean waves crash against sandy beaches while seabirds soar overhead searching for fish. The rhythmic sound of the tide and salty breeze create a calming environment that draws millions of visitors to coastal destinations every year.",
    "Cooking traditional family recipes preserves cultural heritage and brings generations together around the dinner table. Each dish tells a story and carries memories of loved ones who shared their culinary wisdom through the ages.",
    "Stargazing on clear nights reveals the vastness of our universe and inspires wonder about our place among the stars. Constellations, planets, and meteor showers remind us of the beauty and mystery that exists beyond our planet.",
    "Playing musical instruments develops discipline, creativity, and emotional expression in students of all ages. Whether learning piano, guitar, or violin, musicians discover the joy of creating melodies that touch hearts and lift spirits.",
    "Morning jogs through neighborhood streets provide exercise, fresh air, and time for reflection before the day begins. Runners enjoy the peaceful quiet, friendly waves from neighbors, and the energizing boost that carries them through their daily routines.",
    "Baking homemade bread fills the house with wonderful aromas and provides a sense of accomplishment. Kneading dough, watching it rise, and pulling golden loaves from the oven connects bakers to an ancient tradition of creating nourishment.",
    "Wildlife documentaries transport viewers to remote locations where they witness incredible animal behaviors and stunning landscapes. These films educate audiences about conservation efforts and the importance of protecting endangered species and their habitats.",
    "Autumn leaves transform forests into colorful wonderlands of red, orange, and yellow before winter arrives. People gather fallen leaves, enjoy hayrides, and celebrate the harvest season with festivals that honor the changing of nature.",
    "Volunteering at local shelters and food banks makes a real difference in the lives of people facing hardship. Community members who donate their time and energy help create a more compassionate society where everyone supports their neighbors."
  ],
  long: [
    "The magnificent sunset painted the western sky in brilliant shades of crimson, amber, gold, and violet that blended together in perfect harmony. Countless birds soared gracefully through the colorful atmosphere, creating beautiful patterns as they journeyed homeward to nests hidden among ancient trees. The peaceful transition from day to night created an atmosphere of profound tranquility, inviting everyone to pause and appreciate the beauty that surrounds us every day.",
    "Charming coffee shops throughout cities have become beloved havens where creative individuals, students, artists, entrepreneurs, and writers gather to pursue their passions in a welcoming atmosphere. The rich aroma of premium coffee beans fills these cozy establishments, creating an environment that stimulates both the senses and the mind. Comfortable chairs and wooden tables provide perfect workspaces where people craft stories, create designs, write code, and develop business plans.",
    "Learning programming skills opens up limitless possibilities and professional advancement in our digital world where technology shapes almost every aspect of daily life. With knowledge of coding languages, you can build sophisticated websites, design powerful mobile applications, create immersive video games, build intelligent automation systems, analyze complex data to uncover patterns, contribute to open-source projects, and develop artificial intelligence systems that push technological boundaries.",
    "Music stands as one of humanity's most powerful forms of expression, possessing the ability to transcend linguistic barriers and cultural differences to touch hearts in profound ways. Whether moved by classical symphonies in grand concert halls, energized by rock concerts, relaxed by jazz performances, inspired by hip-hop artists, or transported by electronic music, each genre offers unique stories and emotions that resonate within our hearts and connect us to our shared humanity.",
    "Genuine friendship represents one of life's most precious treasures, enriching our existence in meaningful ways that extend beyond simple companionship. True friends demonstrate unwavering loyalty by standing beside us during difficult times, celebrating our victories with authentic joy, offering honest advice, sharing moments of laughter, providing comfort during sorrow, accepting us with all our imperfections, and reminding us that we are never truly alone on this journey called life."
  ]
};

// AI Bot difficulty settings (WPM ranges)
const botDifficulties = {
  level1: { minWPM: 30, maxWPM: 30, errorRate: 0.05 },
  level2: { minWPM: 40, maxWPM: 40, errorRate: 0.04 },
  level3: { minWPM: 50, maxWPM: 50, errorRate: 0.03 },
  level4: { minWPM: 60, maxWPM: 60, errorRate: 0.02 },
  level5: { minWPM: 70, maxWPM: 70, errorRate: 0.01 }
};

function generateRoomCode() {
  // Generate 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getRandomPassage(length = 'medium') {
  const passageArray = passages[length] || passages.medium;
  return passageArray[Math.floor(Math.random() * passageArray.length)];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication and online status
  socket.on('userOnline', async ({ userId }) => {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.onlineStatus.isOnline = true;
        user.onlineStatus.socketId = socket.id;
        user.onlineStatus.lastSeen = Date.now();
        await user.save();

        // Store userId in socket for later use
        socket.userId = userId;

        // Notify friends that user is online
        const friends = await Friend.find({
          $or: [
            { requester: userId },
            { recipient: userId }
          ],
          status: 'accepted'
        }).populate('requester recipient', 'onlineStatus');

        // Emit to each online friend
        friends.forEach(friend => {
          const friendUser = friend.requester._id.toString() === userId ? friend.recipient : friend.requester;
          if (friendUser.onlineStatus.isOnline && friendUser.onlineStatus.socketId) {
            io.to(friendUser.onlineStatus.socketId).emit('friendOnline', {
              userId: user._id,
              username: user.username,
              displayName: user.profile.displayName
            });
          }
        });
      }
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  });

  // Handle friend game invite
  socket.on('inviteFriend', async ({ friendId, roomCode }) => {
    try {
      const friend = await User.findById(friendId);
      if (friend && friend.onlineStatus.isOnline && friend.onlineStatus.socketId) {
        const inviter = await User.findById(socket.userId);
        io.to(friend.onlineStatus.socketId).emit('gameInvite', {
          from: {
            id: inviter._id,
            username: inviter.username,
            displayName: inviter.profile.displayName
          },
          roomCode
        });
      }
    } catch (error) {
      console.error('Error inviting friend:', error);
    }
  });

  // Notify user when they receive a friend request
  socket.on('friendRequestSent', async ({ recipientId, requestId }) => {
    try {
      const recipient = await User.findById(recipientId);
      if (recipient && recipient.onlineStatus.isOnline && recipient.onlineStatus.socketId) {
        const sender = await User.findById(socket.userId);
        io.to(recipient.onlineStatus.socketId).emit('friendRequestReceived', {
          requestId: requestId,
          from: {
            id: sender._id,
            username: sender.username,
            displayName: sender.profile.displayName
          }
        });
      }
    } catch (error) {
      console.error('Error notifying friend request:', error);
    }
  });

  // Create a new room
  socket.on('createRoom', ({ playerName, gameMode, difficulty, passageLength }) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      host: socket.id,
      players: new Map(),
      passage: getRandomPassage(passageLength || 'medium'),
      gameState: 'waiting', // waiting, countdown, playing, finished
      startTime: null,
      gameMode: gameMode || 'multiplayer', // 'multiplayer' or 'solo'
      difficulty: difficulty || 'medium',
      maxPlayers: 5,
      passageLength: passageLength || 'medium',
      botIntervals: new Map()
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      finished: false,
      finishTime: null,
      rawTime: null,
      errors: 0,
      hearts: 3,
      penaltyTime: 0,
      totalTime: null,
      isBot: false
    });

    // If solo mode, add AI bot
    if (gameMode === 'solo') {
      const botId = 'bot_' + Date.now();
      room.players.set(botId, {
        id: botId,
        name: `AI Bot (${difficulty})`,
        progress: 0,
        wpm: 0,
        accuracy: 100,
        finished: false,
        finishTime: null,
        rawTime: null,
        errors: 0,
        hearts: 3,
        penaltyTime: 0,
        totalTime: null,
        isBot: true
      });
    }

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomCreated', {
      roomCode,
      isHost: true,
      players: Array.from(room.players.values()),
      gameMode: room.gameMode
    });

    console.log(`Room ${roomCode} created by ${playerName} (${gameMode} mode)`);
  });

  // Join an existing room
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.gameState !== 'waiting') {
      socket.emit('error', 'Game already in progress');
      return;
    }

    if (room.gameMode === 'solo') {
      socket.emit('error', 'Cannot join solo game');
      return;
    }

    // Check player limit (excluding bots)
    const humanPlayers = Array.from(room.players.values()).filter(p => !p.isBot);
    if (humanPlayers.length >= room.maxPlayers) {
      socket.emit('error', 'Room is full (max 5 players)');
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      finished: false,
      finishTime: null,
      rawTime: null,
      errors: 0,
      hearts: 3,
      penaltyTime: 0,
      totalTime: null,
      isBot: false
    });

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomJoined', {
      roomCode,
      isHost: socket.id === room.host,
      players: Array.from(room.players.values()),
      gameMode: room.gameMode
    });

    // Notify other players
    socket.to(roomCode).emit('playerJoined', {
      players: Array.from(room.players.values())
    });

    console.log(`${playerName} joined room ${roomCode}`);
  });

  // Start game countdown (only host can start)
  socket.on('startGame', () => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);

    if (!room || room.host !== socket.id) {
      return;
    }

    room.gameState = 'countdown';
    io.to(roomCode).emit('gameCountdown');

    // Start countdown
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      io.to(roomCode).emit('countdownTick', countdown);
      countdown--;

      if (countdown < 0) {
        clearInterval(countdownInterval);
        room.gameState = 'playing';
        room.startTime = Date.now();
        io.to(roomCode).emit('gameStart', {
          passage: room.passage,
          startTime: room.startTime
        });

        // Start AI bot simulation if in solo mode
        if (room.gameMode === 'solo') {
          startBotSimulation(roomCode, room);
        }
      }
    }, 1000);
  });

  // AI Bot simulation
  function startBotSimulation(roomCode, room) {
    const bot = Array.from(room.players.values()).find(p => p.isBot);
    if (!bot) return;

    const difficulty = botDifficulties[room.difficulty] || botDifficulties.level3;
    const targetWPM = difficulty.minWPM + Math.random() * (difficulty.maxWPM - difficulty.minWPM);
    const passageLength = room.passage.length;
    const words = passageLength / 5;
    const targetTimeMs = (words / targetWPM) * 60 * 1000;
    const updateInterval = 100; // Update every 100ms

    const botInterval = setInterval(() => {
      if (room.gameState !== 'playing' || bot.finished) {
        clearInterval(botInterval);
        return;
      }

      const elapsed = Date.now() - room.startTime;
      const expectedProgress = Math.min((elapsed / targetTimeMs) * 100, 100);

      // Add some randomness to make it more realistic
      const randomVariation = (Math.random() - 0.5) * 2;
      bot.progress = Math.min(Math.max(expectedProgress + randomVariation, 0), 100);

      // Calculate bot stats
      const elapsedMinutes = elapsed / 1000 / 60;
      const currentWords = (bot.progress / 100) * words;
      bot.wpm = Math.round(currentWords / elapsedMinutes) || 0;
      bot.accuracy = Math.round(100 - (difficulty.errorRate * 100));

      // Check if bot finished
      if (bot.progress >= 100 && !bot.finished) {
        bot.finished = true;
        bot.finishTime = elapsed;
        bot.totalTime = elapsed; // Bots have no penalties, so totalTime = finishTime
        bot.rawTime = elapsed;
        bot.penaltyTime = 0;
        clearInterval(botInterval);

        io.to(roomCode).emit('playerFinished', {
          playerId: bot.id,
          playerName: bot.name,
          finishTime: bot.finishTime,
          totalTime: bot.totalTime,
          rawTime: bot.rawTime,
          wpm: bot.wpm,
          accuracy: bot.accuracy
        });

        // Check if game should end
        const allPlayers = Array.from(room.players.values());
        const finishedCount = allPlayers.filter(p => p.finished).length;
        const totalPlayers = allPlayers.length;

        // SPECIAL CASE: 5+ players - End game when first 3 finish
        const shouldEndGame5Plus = totalPlayers >= 5 && finishedCount >= 3;

        // Normal case: All players finished
        const allFinished = allPlayers.every(p => p.finished);

        if (allFinished || shouldEndGame5Plus) {
          room.gameState = 'finished';

          if (shouldEndGame5Plus && !allFinished) {
            console.log(`🏁 5+ PLAYER MODE: Game ending early (${finishedCount}/${totalPlayers} finished)`);
          }

          // Debug: Log all players before sorting
          console.log('=== BOT FINISH: BEFORE SORTING ===');
          allPlayers.forEach(p => {
            console.log(`${p.name}: finished=${p.finished}, totalTime=${p.totalTime}ms, progress=${p.progress}%, accuracy=${p.accuracy}%`);
          });

          const results = allPlayers
            .sort((a, b) => {
              // Finished players ranked by time
              if (a.finished && b.finished) {
                return a.totalTime - b.totalTime; // Lower time wins
              }

              // Finished players always rank above unfinished
              if (a.finished && !b.finished) return -1;
              if (!a.finished && b.finished) return 1;

              // Unfinished players ranked by composite score
              // Score = (progress * 0.7) + (accuracy * 0.3)
              const scoreA = (a.progress * 0.7) + (a.accuracy * 0.3);
              const scoreB = (b.progress * 0.7) + (b.accuracy * 0.3);

              console.log(`Unfinished: ${a.name} score=${scoreA.toFixed(2)} vs ${b.name} score=${scoreB.toFixed(2)}`);
              return scoreB - scoreA; // Higher score wins
            });

          // Debug: Log results after sorting
          console.log('=== BOT FINISH: AFTER SORTING ===');
          results.forEach((p, i) => {
            const status = p.finished ? `${p.totalTime}ms` : `${p.progress.toFixed(1)}% progress, ${p.accuracy}% acc`;
            console.log(`#${i + 1}: ${p.name} - ${status}`);
          });

          io.to(roomCode).emit('gameFinished', { results, earlyEnd: shouldEndGame5Plus && !allFinished });
        }
      }

      // Broadcast bot progress
      io.to(roomCode).emit('progressUpdate', {
        players: Array.from(room.players.values())
      });
    }, updateInterval);

    room.botIntervals.set(bot.id, botInterval);
  }

  // Update player progress
  socket.on('updateProgress', ({ progress, wpm, accuracy, errors, hearts, penaltyErrors }) => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);

    if (!room || room.gameState !== 'playing') {
      return;
    }

    const player = room.players.get(socket.id);
    if (player) {
      player.progress = progress;
      player.wpm = wpm;
      player.accuracy = accuracy;
      player.errors = errors || 0;
      player.hearts = hearts !== undefined ? hearts : 3;
      player.penaltyErrors = penaltyErrors || 0;

      // Check if player finished
      if (progress >= 100 && !player.finished) {
        player.finished = true;
        player.rawTime = Date.now() - room.startTime;

        // Calculate penalty time: 0.5 seconds per penalty error (errors made while at 0 hearts)
        // Use penaltyErrors from client which accurately tracks errors made at 0 hearts
        player.penaltyTime = player.penaltyErrors * 500; // 500ms = 0.5 seconds
        player.totalTime = player.rawTime + player.penaltyTime;
        player.finishTime = player.totalTime; // For backward compatibility

        io.to(roomCode).emit('playerFinished', {
          playerId: socket.id,
          playerName: player.name,
          rawTime: player.rawTime,
          penaltyTime: player.penaltyTime,
          totalTime: player.totalTime,
          finishTime: player.totalTime,
          errors: player.errors,
          wpm: player.wpm,
          accuracy: player.accuracy
        });

        // Check if game should end
        const allPlayers = Array.from(room.players.values());
        const finishedCount = allPlayers.filter(p => p.finished).length;
        const totalPlayers = allPlayers.length;

        // SPECIAL CASE: 5+ players - End game when first 3 finish
        const shouldEndGame5Plus = totalPlayers >= 5 && finishedCount >= 3;

        // Normal case: All players finished
        const allFinished = allPlayers.every(p => p.finished);

        if (allFinished || shouldEndGame5Plus) {
          room.gameState = 'finished';

          if (shouldEndGame5Plus && !allFinished) {
            console.log(`🏁 5+ PLAYER MODE: Game ending early (${finishedCount}/${totalPlayers} finished)`);
          }

          // Debug: Log all players before sorting
          console.log('=== PLAYER FINISH: BEFORE SORTING ===');
          allPlayers.forEach(p => {
            console.log(`${p.name}: finished=${p.finished}, totalTime=${p.totalTime}ms, progress=${p.progress}%, accuracy=${p.accuracy}%`);
          });

          const results = allPlayers
            .sort((a, b) => {
              // Finished players ranked by time
              if (a.finished && b.finished) {
                return a.totalTime - b.totalTime; // Lower time wins
              }

              // Finished players always rank above unfinished
              if (a.finished && !b.finished) return -1;
              if (!a.finished && b.finished) return 1;

              // Unfinished players ranked by composite score
              // Score = (progress * 0.7) + (accuracy * 0.3)
              const scoreA = (a.progress * 0.7) + (a.accuracy * 0.3);
              const scoreB = (b.progress * 0.7) + (b.accuracy * 0.3);

              console.log(`Unfinished: ${a.name} score=${scoreA.toFixed(2)} vs ${b.name} score=${scoreB.toFixed(2)}`);
              return scoreB - scoreA; // Higher score wins
            });

          // Debug: Log results after sorting
          console.log('=== PLAYER FINISH: AFTER SORTING ===');
          results.forEach((p, i) => {
            const status = p.finished ? `${p.totalTime}ms` : `${p.progress.toFixed(1)}% progress, ${p.accuracy}% acc`;
            console.log(`#${i + 1}: ${p.name} - ${status}`);
          });

          io.to(roomCode).emit('gameFinished', { results, earlyEnd: shouldEndGame5Plus && !allFinished });
        }
      }

      // Broadcast progress to all players in room
      io.to(roomCode).emit('progressUpdate', {
        players: Array.from(room.players.values())
      });
    }
  });

  // Rematch
  socket.on('rematch', () => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);

    if (!room || room.host !== socket.id) {
      return;
    }

    // Clear any bot intervals
    room.botIntervals.forEach(interval => clearInterval(interval));
    room.botIntervals.clear();

    // Reset room state (preserve difficulty and passageLength)
    room.passage = getRandomPassage(room.passageLength);
    room.gameState = 'waiting';
    room.startTime = null;

    // Reset all players
    room.players.forEach(player => {
      player.progress = 0;
      player.wpm = 0;
      player.accuracy = 100;
      player.finished = false;
      player.finishTime = null;
      player.rawTime = null;
      player.errors = 0;
      player.hearts = 3;
      player.penaltyTime = 0;
      player.totalTime = null;
    });

    io.to(roomCode).emit('rematchStarted', {
      players: Array.from(room.players.values())
    });
  });

  // Handle player leaving during game
  socket.on('leaveGame', ({ roomCode, playerName, finished, progress }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      return;
    }

    console.log(`🚪 ${playerName} is leaving game in room ${roomCode}`);

    // Get the leaving player
    const leavingPlayer = room.players.get(socket.id);

    if (!leavingPlayer) {
      return;
    }

    // Mark player as left
    leavingPlayer.left = true;

    // If they didn't finish, mark them as DNF
    if (!finished) {
      leavingPlayer.finished = false;
      leavingPlayer.finishTime = null;
      leavingPlayer.dnf = true; // Did Not Finish
      leavingPlayer.progress = progress || 0;
    }

    // Remove player from room
    room.players.delete(socket.id);
    socket.leave(roomCode);

    const remainingPlayers = Array.from(room.players.values()).filter(p => !p.isBot);
    const totalPlayers = remainingPlayers.length;

    console.log(`Players remaining in room ${roomCode}: ${totalPlayers}`);

    // CASE 1: No human players left - clean up room
    if (totalPlayers === 0) {
      console.log(`Room ${roomCode} is empty, cleaning up...`);
      // Clear bot intervals
      if (room.botIntervals) {
        room.botIntervals.forEach(interval => clearInterval(interval));
        room.botIntervals.clear();
      }
      rooms.delete(roomCode);
      return;
    }

    // CASE 2: 1v1 (one human vs one bot or two humans, one left) - End game immediately
    if (room.gameState === 'playing' && room.players.size === 1) {
      console.log(`1v1 match - declaring remaining player as winner`);

      // Clear bot intervals
      if (room.botIntervals) {
        room.botIntervals.forEach(interval => clearInterval(interval));
        room.botIntervals.clear();
      }

      room.gameState = 'finished';

      // Create results with leaving player ranked last
      const results = [];

      // Add remaining players (they win)
      Array.from(room.players.values()).forEach(p => {
        results.push({
          name: p.name,
          finishTime: p.finishTime || null,
          totalTime: p.totalTime || p.finishTime || null,
          wpm: p.wpm || 0,
          accuracy: p.accuracy || 100,
          errors: p.errors || 0,
          hearts: p.hearts || 3,
          isBot: p.isBot || false,
          finished: p.finished || false,
          winner: true // They win by default
        });
      });

      // Add leaving player ranked last
      results.push({
        name: leavingPlayer.name,
        finishTime: leavingPlayer.finishTime,
        totalTime: leavingPlayer.totalTime || leavingPlayer.finishTime,
        wpm: leavingPlayer.wpm || 0,
        accuracy: leavingPlayer.accuracy || 100,
        errors: leavingPlayer.errors || 0,
        hearts: leavingPlayer.hearts || 3,
        isBot: false,
        finished: leavingPlayer.finished || false,
        left: true,
        dnf: leavingPlayer.dnf || false
      });

      // Notify remaining players
      io.to(roomCode).emit('playerLeft', {
        playerName,
        totalPlayers,
        results
      });

      io.to(roomCode).emit('gameFinished', { results });
      return;
    }

    // CASE 3: 3+ players - Continue game, leaving player ranked last at end
    if (room.gameState === 'playing') {
      console.log(`Multiplayer match - ${playerName} will be ranked last in results`);

      // Notify remaining players
      io.to(roomCode).emit('playerLeft', {
        playerName,
        totalPlayers,
        results: null // Game continues
      });

      // Update progress for remaining players
      io.to(roomCode).emit('progressUpdate', {
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          progress: p.progress,
          wpm: p.wpm,
          accuracy: p.accuracy,
          errors: p.errors,
          hearts: p.hearts,
          finished: p.finished,
          isBot: p.isBot
        }))
      });

      // Check if all remaining players finished
      const allFinished = Array.from(room.players.values()).every(p => p.finished);

      if (allFinished) {
        room.gameState = 'finished';

        // Clear bot intervals
        if (room.botIntervals) {
          room.botIntervals.forEach(interval => clearInterval(interval));
          room.botIntervals.clear();
        }

        // Create final results
        const finishedResults = Array.from(room.players.values())
          .sort((a, b) => {
            const timeA = a.finishTime;
            const timeB = b.finishTime;

            if (!timeA && !timeB) return 0;
            if (!timeA) return 1;
            if (!timeB) return -1;

            return timeA - timeB; // Lower time wins
          });

        // Add leaving player at the end if they didn't finish
        if (leavingPlayer.dnf) {
          finishedResults.push({
            name: leavingPlayer.name,
            finishTime: leavingPlayer.finishTime,
            totalTime: leavingPlayer.totalTime || leavingPlayer.finishTime,
            wpm: leavingPlayer.wpm || 0,
            accuracy: leavingPlayer.accuracy || 100,
            errors: leavingPlayer.errors || 0,
            hearts: leavingPlayer.hearts || 3,
            isBot: false,
            finished: false,
            left: true,
            dnf: true
          });
        } else {
          // They finished before leaving - include in proper ranking
          finishedResults.push({
            name: leavingPlayer.name,
            finishTime: leavingPlayer.finishTime,
            totalTime: leavingPlayer.totalTime || leavingPlayer.finishTime,
            wpm: leavingPlayer.wpm || 0,
            accuracy: leavingPlayer.accuracy || 100,
            errors: leavingPlayer.errors || 0,
            hearts: leavingPlayer.hearts || 3,
            isBot: false,
            finished: true,
            left: true
          });

          // Re-sort to place them in correct position based on time
          finishedResults.sort((a, b) => {
            const timeA = a.finishTime;
            const timeB = b.finishTime;

            if (!timeA && !timeB) return 0;
            if (!timeA) return 1;
            if (!timeB) return -1;

            return timeA - timeB;
          });
        }

        io.to(roomCode).emit('gameFinished', { results: finishedResults });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);

    // Set user offline
    if (socket.userId) {
      try {
        const user = await User.findById(socket.userId);
        if (user) {
          user.onlineStatus.isOnline = false;
          user.onlineStatus.lastSeen = Date.now();
          user.onlineStatus.socketId = null;
          await user.save();

          // Notify friends that user is offline
          const friends = await Friend.find({
            $or: [
              { requester: socket.userId },
              { recipient: socket.userId }
            ],
            status: 'accepted'
          }).populate('requester recipient', 'onlineStatus');

          friends.forEach(friend => {
            const friendUser = friend.requester._id.toString() === socket.userId ? friend.recipient : friend.requester;
            if (friendUser.onlineStatus.isOnline && friendUser.onlineStatus.socketId) {
              io.to(friendUser.onlineStatus.socketId).emit('friendOffline', {
                userId: user._id,
                username: user.username
              });
            }
          });
        }
      } catch (error) {
        console.error('Error setting user offline:', error);
      }
    }

    const roomCode = socket.roomCode;
    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        room.players.delete(socket.id);

        // If room is empty, delete it
        if (room.players.size === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        } else {
          // If host left, assign new host
          if (room.host === socket.id) {
            room.host = room.players.keys().next().value;
            io.to(roomCode).emit('newHost', { hostId: room.host });
          }

          // Notify remaining players
          io.to(roomCode).emit('playerLeft', {
            players: Array.from(room.players.values()),
            leftPlayerId: socket.id
          });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
