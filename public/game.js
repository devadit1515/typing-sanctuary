const socket = io();

// Game state
let gameState = {
    playerName: '',
    roomCode: '',
    isHost: false,
    passage: '',
    currentIndex: 0,
    startTime: null,
    errors: 0,
    typedChars: 0,
    gameMode: 'multiplayer',
    difficulty: 'level3',
    passageLength: 'medium'
};

// DOM elements
const screens = {
    welcome: document.getElementById('welcomeScreen'),
    soloSetup: document.getElementById('soloSetupScreen'),
    multiplayerSetup: document.getElementById('multiplayerSetupScreen'),
    lobby: document.getElementById('lobbyScreen'),
    countdown: document.getElementById('countdownScreen'),
    game: document.getElementById('gameScreen'),
    results: document.getElementById('resultsScreen')
};

const elements = {
    playerNameInput: document.getElementById('playerName'),
    multiplayerModeBtn: document.getElementById('multiplayerModeBtn'),
    soloModeBtn: document.getElementById('soloModeBtn'),
    backFromSoloBtn: document.getElementById('backFromSoloBtn'),
    backFromMultiplayerBtn: document.getElementById('backFromMultiplayerBtn'),
    backFromLobbyBtn: document.getElementById('backFromLobbyBtn'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    createRoomOptions: document.getElementById('createRoomOptions'),
    joinRoomInput: document.getElementById('joinRoomInput'),
    soloPassageLengthSelect: document.getElementById('soloPassageLengthSelect'),
    difficultySelect: document.getElementById('difficultySelect'),
    createSoloRoomBtn: document.getElementById('createSoloRoomBtn'),
    multiplayerPassageLengthSelect: document.getElementById('multiplayerPassageLengthSelect'),
    createMultiplayerRoomBtn: document.getElementById('createMultiplayerRoomBtn'),
    roomCodeInput: document.getElementById('roomCodeInput'),
    confirmJoinBtn: document.getElementById('confirmJoinBtn'),
    roomCodeContainer: document.getElementById('roomCodeContainer'),
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    playersList: document.getElementById('playersList'),
    hostControls: document.getElementById('hostControls'),
    waitingText: document.getElementById('waitingText'),
    startGameBtn: document.getElementById('startGameBtn'),
    countdownNumber: document.getElementById('countdownNumber'),
    timer: document.getElementById('timer'),
    competitorIndicator: document.getElementById('competitorIndicator'),
    passageDisplay: document.getElementById('passageDisplay'),
    typingInput: document.getElementById('typingInput'),
    playersProgress: document.getElementById('playersProgress'),
    resultsContainer: document.getElementById('resultsContainer'),
    hostRematchControls: document.getElementById('hostRematchControls'),
    rematchBtn: document.getElementById('rematchBtn'),
    backToMenuBtn: document.getElementById('backToMenuBtn')
};

// Utility functions
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showError(message) {
    // Create premium toast notification instead of alert
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: linear-gradient(135deg, rgba(255, 50, 100, 0.95), rgba(204, 40, 80, 0.95));
        color: white;
        padding: 16px 24px;
        border-radius: 16px;
        font-size: 16px;
        font-weight: 600;
        box-shadow: 0 8px 32px rgba(255, 50, 100, 0.4);
        z-index: 10000;
        animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Add confetti animation for winner
function createConfetti() {
    const colors = ['#b74dff', '#00d4ff', '#00ff88', '#ff3264', '#fbbf24'];
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = (5 + Math.random() * 10) + 'px';
            confetti.style.height = (5 + Math.random() * 10) + 'px';
            confetti.style.top = '-20px';
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }, i * 30);
    }
}

// Add ripple effect to buttons
function addRippleEffect(button, event) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: rippleEffect 0.6s ease-out;
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
    `;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// Event listeners - Main Mode Selection
elements.soloModeBtn.addEventListener('click', () => {
    const name = elements.playerNameInput.value.trim();
    if (!name) {
        showError('Please enter your username');
        return;
    }
    gameState.playerName = name;
    showScreen('soloSetup');
});

elements.multiplayerModeBtn.addEventListener('click', () => {
    const name = elements.playerNameInput.value.trim();
    if (!name) {
        showError('Please enter your username');
        return;
    }
    gameState.playerName = name;
    showScreen('multiplayerSetup');
});

// Back buttons
elements.backFromSoloBtn.addEventListener('click', () => {
    showScreen('welcome');
});

elements.backFromMultiplayerBtn.addEventListener('click', () => {
    showScreen('welcome');
});

elements.backFromLobbyBtn.addEventListener('click', () => {
    // Disconnect from the room and go back to the appropriate setup screen
    socket.disconnect();
    socket.connect();

    if (gameState.gameMode === 'solo') {
        showScreen('soloSetup');
    } else {
        showScreen('multiplayerSetup');
    }
});

// Multiplayer sub-options
elements.createRoomBtn.addEventListener('click', () => {
    elements.createRoomOptions.classList.remove('hidden');
    elements.joinRoomInput.classList.add('hidden');
});

elements.joinRoomBtn.addEventListener('click', () => {
    elements.joinRoomInput.classList.remove('hidden');
    elements.createRoomOptions.classList.add('hidden');
    elements.roomCodeInput.focus();
});

// Create Solo Room
elements.createSoloRoomBtn.addEventListener('click', () => {
    gameState.gameMode = 'solo';
    gameState.passageLength = elements.soloPassageLengthSelect.value;
    gameState.difficulty = elements.difficultySelect.value;

    socket.emit('createRoom', {
        playerName: gameState.playerName,
        gameMode: 'solo',
        difficulty: gameState.difficulty,
        passageLength: gameState.passageLength
    });
});

// Create Multiplayer Room
elements.createMultiplayerRoomBtn.addEventListener('click', () => {
    gameState.gameMode = 'multiplayer';
    gameState.passageLength = elements.multiplayerPassageLengthSelect.value;

    socket.emit('createRoom', {
        playerName: gameState.playerName,
        gameMode: 'multiplayer',
        passageLength: gameState.passageLength
    });
});

// Confirm Join
elements.confirmJoinBtn.addEventListener('click', () => {
    const roomCode = elements.roomCodeInput.value.trim();

    if (!roomCode || roomCode.length !== 6) {
        showError('Please enter a valid 6-digit room code');
        return;
    }

    socket.emit('joinRoom', {
        roomCode,
        playerName: gameState.playerName
    });
});

// Copy room code
elements.copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(gameState.roomCode);
    elements.copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => {
        elements.copyCodeBtn.textContent = 'Copy';
    }, 2000);
});

// Start game (move directly to countdown and game)
elements.startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

// Rematch
elements.rematchBtn.addEventListener('click', () => {
    socket.emit('rematch');
});

// Back to menu
elements.backToMenuBtn.addEventListener('click', () => {
    location.reload();
});

// Keep input focused when clicking on game screen
screens.game.addEventListener('click', () => {
    if (!elements.typingInput.disabled) {
        elements.typingInput.focus();
    }
});

// Socket event handlers
socket.on('roomCreated', ({ roomCode, isHost, players, gameMode }) => {
    gameState.roomCode = roomCode;
    gameState.isHost = isHost;
    gameState.gameMode = gameMode;

    // Hide room code for solo mode
    if (gameMode === 'solo') {
        elements.roomCodeContainer.classList.add('hidden');
    } else {
        elements.roomCodeContainer.classList.remove('hidden');
        elements.roomCodeDisplay.textContent = roomCode;
    }

    updatePlayersList(players);
    showHostControls(isHost);

    showScreen('lobby');
});

socket.on('roomJoined', ({ roomCode, isHost, players, gameMode }) => {
    gameState.roomCode = roomCode;
    gameState.isHost = isHost;
    gameState.gameMode = gameMode;

    // Hide room code for solo mode
    if (gameMode === 'solo') {
        elements.roomCodeContainer.classList.add('hidden');
    } else {
        elements.roomCodeContainer.classList.remove('hidden');
        elements.roomCodeDisplay.textContent = roomCode;
    }

    updatePlayersList(players);
    showHostControls(isHost);

    showScreen('lobby');
});

socket.on('playerJoined', ({ players }) => {
    updatePlayersList(players);
});

socket.on('playerLeft', ({ players }) => {
    updatePlayersList(players);
});

socket.on('newHost', ({ hostId }) => {
    gameState.isHost = hostId === socket.id;
    showHostControls(gameState.isHost);
});

socket.on('gameCountdown', () => {
    showScreen('countdown');
});

socket.on('countdownTick', (number) => {
    elements.countdownNumber.textContent = number;
});

socket.on('gameStart', ({ passage, startTime }) => {
    gameState.passage = passage;
    gameState.startTime = startTime;
    gameState.currentIndex = 0;
    gameState.errors = 0;
    gameState.typedChars = 0;

    displayPassage();
    elements.typingInput.value = '';
    elements.typingInput.disabled = false;

    showScreen('game');

    // Focus input after screen transition
    setTimeout(() => {
        elements.typingInput.focus();
    }, 100);

    startTimer();
});

socket.on('progressUpdate', ({ players }) => {
    updatePlayersProgress(players);
});

socket.on('playerFinished', ({ playerId, playerName, finishTime, wpm, accuracy }) => {
    console.log(`${playerName} finished! Time: ${(finishTime / 1000).toFixed(2)}s, WPM: ${wpm}, Accuracy: ${accuracy}%`);
});

socket.on('gameFinished', ({ results }) => {
    displayResults(results);
    showScreen('results');
});

socket.on('rematchStarted', ({ players }) => {
    updatePlayersList(players);
    showScreen('lobby');
});

socket.on('error', (message) => {
    showError(message);
});

// Helper functions
function showHostControls(isHost) {
    if (isHost) {
        elements.hostControls.classList.remove('hidden');
        elements.waitingText.classList.add('hidden');
    } else {
        elements.hostControls.classList.add('hidden');
        elements.waitingText.classList.remove('hidden');
    }
}

function updatePlayersList(players) {
    elements.playersList.innerHTML = '';
    players.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'player-item';
        if (player.id === socket.id) {
            div.style.fontWeight = 'bold';
        }
        if (index === 0) {
            div.classList.add('host');
        }

        let displayName = player.name;
        if (player.isBot) {
            displayName = `🤖 ${player.name}`;
        } else if (player.id === socket.id) {
            displayName = player.name + ' (You)';
        }

        div.textContent = displayName;
        elements.playersList.appendChild(div);
    });
}

function updatePlayersProgress(players) {
    elements.playersProgress.innerHTML = '<h3>Players</h3>';

    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-progress';
        if (player.finished) {
            div.classList.add('finished');
        }

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.isBot ? `🤖 ${player.name}` : player.name;

        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.width = `${player.progress}%`;
        bar.appendChild(fill);

        const stats = document.createElement('div');
        stats.className = 'player-stats';
        stats.textContent = `${player.wpm} WPM • ${player.accuracy}% accuracy`;

        div.appendChild(name);
        div.appendChild(bar);
        div.appendChild(stats);

        elements.playersProgress.appendChild(div);
    });
}

function displayPassage() {
    const passage = gameState.passage;
    let html = '';

    for (let i = 0; i < passage.length; i++) {
        const char = passage[i];
        if (i < gameState.currentIndex) {
            const typedChar = elements.typingInput.value[i];
            if (typedChar === char) {
                html += `<span class="correct">${char}</span>`;
            } else {
                html += `<span class="incorrect">${char}</span>`;
            }
        } else if (i === gameState.currentIndex) {
            html += `<span class="current">${char}</span>`;
        } else {
            html += char;
        }
    }

    elements.passageDisplay.innerHTML = html;
}

function startTimer() {
    const timerInterval = setInterval(() => {
        if (gameState.startTime) {
            const elapsed = (Date.now() - gameState.startTime) / 1000;
            elements.timer.textContent = elapsed.toFixed(1);
        } else {
            clearInterval(timerInterval);
        }
    }, 100);
}

// Typing input handler
elements.typingInput.addEventListener('input', () => {
    const typed = elements.typingInput.value;
    gameState.currentIndex = typed.length;
    gameState.typedChars = typed.length;

    // Count errors
    gameState.errors = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== gameState.passage[i]) {
            gameState.errors++;
        }
    }

    displayPassage();

    // Calculate stats
    const progress = (typed.length / gameState.passage.length) * 100;
    const elapsed = (Date.now() - gameState.startTime) / 1000 / 60; // minutes
    const wordsTyped = typed.length / 5;
    const wpm = Math.round(wordsTyped / elapsed) || 0;
    const accuracy = Math.round(((typed.length - gameState.errors) / typed.length) * 100) || 100;

    // Send progress update
    socket.emit('updateProgress', {
        progress,
        wpm,
        accuracy
    });

    // Check if finished
    if (typed.length >= gameState.passage.length) {
        elements.typingInput.disabled = true;
    }
});

function displayResults(results) {
    elements.resultsContainer.innerHTML = '';

    // Check if current player won
    const winner = results[0];
    const currentPlayer = results.find(p => p.id === socket.id);
    const isWinner = currentPlayer && currentPlayer.id === winner.id;

    // Trigger confetti if player won
    if (isWinner && !winner.isBot) {
        createConfetti();
    }

    results.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'result-item';
        if (index === 0) div.classList.add('winner');

        // Add slide-in animation with stagger
        div.style.animationDelay = `${index * 0.1}s`;

        const rank = document.createElement('div');
        rank.className = 'rank';
        const medals = ['🥇', '🥈', '🥉'];
        rank.textContent = medals[index] || `#${index + 1}`;

        const info = document.createElement('div');
        info.className = 'player-info';

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.isBot ? `🤖 ${player.name}` : player.name;

        // Highlight current player
        if (player.id === socket.id) {
            name.textContent += ' (You)';
            name.style.color = '#00d4ff';
        }

        const stats = document.createElement('div');
        stats.className = 'player-stats';
        const time = player.finishTime ? (player.finishTime / 1000).toFixed(2) : 'DNF';
        stats.innerHTML = `
            <span>${time}s</span> •
            <span>${player.wpm} WPM</span> •
            <span>${player.accuracy}% accuracy</span>
        `;

        info.appendChild(name);
        info.appendChild(stats);

        div.appendChild(rank);
        div.appendChild(info);

        elements.resultsContainer.appendChild(div);
    });

    if (gameState.isHost) {
        elements.hostRematchControls.classList.remove('hidden');
    }
}
