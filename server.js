const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from public directory
app.use(express.static('public'));

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
        clearInterval(botInterval);

        io.to(roomCode).emit('playerFinished', {
          playerId: bot.id,
          playerName: bot.name,
          finishTime: bot.finishTime,
          wpm: bot.wpm,
          accuracy: bot.accuracy
        });

        // Check if all players finished
        const allFinished = Array.from(room.players.values()).every(p => p.finished);
        if (allFinished) {
          room.gameState = 'finished';
          const results = Array.from(room.players.values())
            .sort((a, b) => {
              // Players who didn't finish (finishTime === null) go to the bottom
              if (a.finishTime === null && b.finishTime === null) return 0;
              if (a.finishTime === null) return 1;
              if (b.finishTime === null) return -1;

              // Sort by finish time
              return a.finishTime - b.finishTime;
            });
          io.to(roomCode).emit('gameFinished', { results });
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
  socket.on('updateProgress', ({ progress, wpm, accuracy }) => {
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

      // Check if player finished
      if (progress >= 100 && !player.finished) {
        player.finished = true;
        player.finishTime = Date.now() - room.startTime;

        io.to(roomCode).emit('playerFinished', {
          playerId: socket.id,
          playerName: player.name,
          finishTime: player.finishTime,
          wpm: player.wpm,
          accuracy: player.accuracy
        });

        // Check if all players finished
        const allFinished = Array.from(room.players.values()).every(p => p.finished);
        if (allFinished) {
          room.gameState = 'finished';
          const results = Array.from(room.players.values())
            .sort((a, b) => {
              // Players who didn't finish (finishTime === null) go to the bottom
              if (a.finishTime === null && b.finishTime === null) return 0;
              if (a.finishTime === null) return 1;
              if (b.finishTime === null) return -1;

              // Sort by finish time
              return a.finishTime - b.finishTime;
            });

          io.to(roomCode).emit('gameFinished', { results });
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
    });

    io.to(roomCode).emit('rematchStarted', {
      players: Array.from(room.players.values())
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

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
