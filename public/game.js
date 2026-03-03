// ── Training Mode ──────────────────────────────────────────────────────────────
const IS_TRAINING_MODE = new URLSearchParams(window.location.search).get('training') === 'true';
let biometricKeyDownTimes = {};
let biometricKeystrokes = [];
let biometricLastKeyUp = null;
let biometricPassageText = '';
let biometricListenersAttached = false;

async function initTrainingMode() {
    if (!IS_TRAINING_MODE) return;
    const banner = document.getElementById('trainingBanner');
    if (!banner) return;
    banner.classList.remove('hidden');
    document.body.classList.add('training-active');
    try {
        const res = await fetch('/api/auth/me', { headers: window.authHeaders ? window.authHeaders() : {} });
        const data = await res.json();
        if (data.success && data.user) {
            const el = document.getElementById('trainingUsername');
            if (el) el.textContent = data.user.username;
        }
    } catch (_) {}
}

function attachBiometricListeners(inputEl) {
    if (!IS_TRAINING_MODE || biometricListenersAttached) return;
    biometricListenersAttached = true;

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Backspace') return;
        if (e.key.length !== 1) return;
        const pos = inputEl.value.length;
        if (biometricKeyDownTimes[pos] === undefined) {
            biometricKeyDownTimes[pos] = performance.now();
        }
    });

    inputEl.addEventListener('keyup', (e) => {
        if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Backspace') return;
        if (e.key.length !== 1) return;
        const pos = inputEl.value.length - 1;
        if (pos < 0) return;
        const down = biometricKeyDownTimes[pos];
        if (down === undefined) return;
        const now = performance.now();
        const dwell = Math.round(now - down);
        const flight = biometricLastKeyUp !== null ? Math.round(down - biometricLastKeyUp) : 0;
        const typed = inputEl.value[pos] || '';
        const expected = biometricPassageText[pos] || '';
        biometricKeystrokes.push({
            char: typed,
            keyCode: e.code,
            dwellTime: dwell,
            flightTime: flight,
            position: pos,
            isCorrect: typed === expected,
            timestamp: now
        });
        biometricLastKeyUp = now;
        delete biometricKeyDownTimes[pos];
    });
}

function resetBiometricCapture() {
    biometricKeyDownTimes = {};
    biometricKeystrokes = [];
    biometricLastKeyUp = null;
}

async function submitBiometricSample(passageText) {
    if (!IS_TRAINING_MODE || biometricKeystrokes.length < 20) return;
    const wordCount = passageText.trim().split(/\s+/).length;
    const passageLength = wordCount <= 10 ? 'short' : 'medium';
    try {
        const res = await fetch('/api/keystroke-auth/submit-sample', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                passage: passageText,
                passageLength,
                keystrokes: biometricKeystrokes,
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screenResolution: `${screen.width}x${screen.height}`,
                    language: navigator.language,
                    hardwareConcurrency: navigator.hardwareConcurrency || 0,
                    deviceMemory: navigator.deviceMemory || 0,
                    colorDepth: screen.colorDepth || 0
                },
                source: 'game-training'
            })
        });
        const data = await res.json();
        if (data.success) {
            const toast = document.createElement('div');
            toast.className = 'biometric-toast';
            toast.textContent = `🧠 Training sample saved! (${data.enrollmentProgress?.current || '?'} total)`;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.transition = 'opacity 0.4s';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 400);
            }, 3000);
        }
    } catch (_) {}
    resetBiometricCapture();
}
// ── End Training Mode ──────────────────────────────────────────────────────────

// Socket.IO connection with error handling
const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    timeout: 20000
});

// ── URL param handling: ?join=CODE or ?challenge=FRIEND_ID ────────────────────
const _urlParams = new URLSearchParams(window.location.search);
const _autoJoinCode = _urlParams.get('join');
const _autoChallengeFriendId = _urlParams.get('challenge');
const _autoChallengePassageLength = _urlParams.get('passageLength') || 'medium';
const _autoChallengeDifficulty = _urlParams.get('difficulty') || 'level3';

// Clear challenge/join params from URL without reloading
if (_autoJoinCode || _autoChallengeFriendId) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}

function _handleUrlAction() {
    const playerName = (elements.playerNameInput && elements.playerNameInput.value.trim()) || 'Player';

    if (_autoJoinCode) {
        // Auto-join a specific room (e.g. from social.js challenge accept)
        gameState.playerName = playerName;
        gameState.gameMode = 'multiplayer';
        socket.emit('joinRoom', { roomCode: _autoJoinCode, playerName });
        return;
    }

    if (_autoChallengeFriendId) {
        // Create a multiplayer room then invite the friend
        gameState.playerName = playerName;
        gameState.gameMode = 'multiplayer';
        gameState.passageLength = _autoChallengePassageLength;
        gameState.difficulty = _autoChallengeDifficulty;
        gameState.pendingChallengeFriendId = _autoChallengeFriendId;
        socket.emit('createRoom', {
            playerName,
            gameMode: 'multiplayer',
            difficulty: _autoChallengeDifficulty,
            passageLength: _autoChallengePassageLength
        });
    }
}

function _waitAndHandleUrl(attempts) {
    if (!_autoJoinCode && !_autoChallengeFriendId) return;
    if (attempts > 20) return; // give up after 4 seconds
    const name = elements.playerNameInput && elements.playerNameInput.value.trim();
    if (name) {
        _handleUrlAction();
    } else {
        setTimeout(() => _waitAndHandleUrl(attempts + 1), 200);
    }
}

// Connection event handlers
socket.on('connect', () => {
    console.log('✅ Connected to server');
    // Trigger auto-join / challenge after player name is available
    _waitAndHandleUrl(0);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
    showError('Connection error. Please check your internet connection and try again.');
});

socket.on('disconnect', (reason) => {
    console.warn('⚠️ Disconnected:', reason);
    if (reason === 'io server disconnect') {
        // Server forcefully disconnected - try to reconnect
        socket.connect();
    }
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_failed', () => {
    showError('Unable to connect to server. Please refresh the page.');
});

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
    hearts: 3,
    totalErrors: 0,
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
    backToMenuBtn: document.getElementById('backToMenuBtn'),
    heart1: document.getElementById('heart1'),
    heart2: document.getElementById('heart2'),
    heart3: document.getElementById('heart3')
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

// Leave game during match
document.getElementById('leaveGameBtn')?.addEventListener('click', () => {
    // Show confirmation dialog
    const confirmLeave = confirm('Are you sure you want to leave the game? This will end your current match.');

    if (confirmLeave) {
        console.log('🚪 Player leaving game');

        // Notify server that player is leaving
        socket.emit('leaveGame', {
            roomCode: gameState.roomCode,
            playerName: gameState.playerName,
            finished: elements.typingInput.disabled, // true if player completed typing
            progress: (gameState.currentIndex / gameState.passage.length) * 100
        });

        // Return to home screen
        setTimeout(() => {
            location.reload();
        }, 300);
    }
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

    // If this room was created from a challenge (social page), send invite now
    if (gameState.pendingChallengeFriendId) {
        socket.emit('inviteFriend', { friendId: gameState.pendingChallengeFriendId, roomCode });
        gameState.pendingChallengeFriendId = null;
    }

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
    gameState.hearts = 3;
    gameState.totalErrors = 0;

    // Reset heart tracking
    heartsLost = 0;

    // Reset hearts display
    updateHeartsDisplay();

    displayPassage();
    elements.typingInput.value = '';
    elements.typingInput.disabled = false;

    // Training mode: reset capture and attach listeners for this game
    if (IS_TRAINING_MODE) {
        biometricPassageText = passage;
        resetBiometricCapture();
        attachBiometricListeners(elements.typingInput);
    }

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

socket.on('gameFinished', ({ results, earlyEnd }) => {
    displayResults(results, earlyEnd);
    showScreen('results');

    // Save game result to database
    saveGameResult(results);
});

socket.on('playerLeft', ({ playerName, totalPlayers, results, earlyEnd }) => {
    console.log(`🚪 ${playerName} left the game. Players remaining: ${totalPlayers}`);

    // If results are provided (1v1 or game ended due to leave), show results screen
    if (results) {
        displayResults(results, earlyEnd);
        showScreen('results');
        saveGameResult(results);
    }
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

// Simple heart tracking
let heartsLost = 0; // How many hearts we've lost total

// Function to update hearts display
function updateHeartsDisplay() {
    const hearts = [elements.heart1, elements.heart2, elements.heart3];
    hearts.forEach((heart, index) => {
        if (index < gameState.hearts) {
            heart.classList.remove('lost');
        } else {
            heart.classList.add('lost');
        }
    });
}

// Prevent backspace on correctly typed characters, restore heart when backspacing
elements.typingInput.addEventListener('keydown', (e) => {
    const typed = elements.typingInput.value;

    // If backspace is pressed
    if (e.key === 'Backspace') {
        // Check if all characters up to current position are correct
        let allCorrect = true;
        for (let i = 0; i < typed.length; i++) {
            if (typed[i] !== gameState.passage[i]) {
                allCorrect = false;
                break;
            }
        }

        // If all typed characters are correct, prevent backspace
        if (allCorrect && typed.length > 0) {
            e.preventDefault();
            return false;
        }

        // NOTE: Hearts are NOT restored on backspace
        // Hearts restore only when you TYPE the correct character to fix an error
    }
});

// Typing input handler
elements.typingInput.addEventListener('input', () => {
    const typed = elements.typingInput.value;
    gameState.currentIndex = typed.length;
    gameState.typedChars = typed.length;

    // Count current red letters (errors) in typed text
    gameState.errors = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== gameState.passage[i]) {
            gameState.errors++;
        }
    }

    // Hearts ALWAYS equal 3 minus the number of red letters currently on screen
    // If 0 red letters → 3 hearts
    // If 1 red letter → 2 hearts
    // If 2 red letters → 1 heart
    // If 3+ red letters → 0 hearts
    gameState.hearts = Math.max(0, 3 - gameState.errors);
    heartsLost = Math.min(3, gameState.errors); // How many hearts we've lost
    updateHeartsDisplay();

    displayPassage();

    // Calculate stats
    const progress = (typed.length / gameState.passage.length) * 100;
    const elapsed = (Date.now() - gameState.startTime) / 1000 / 60; // minutes
    const wordsTyped = typed.length / 5;
    const wpm = Math.round(wordsTyped / elapsed) || 0;
    const accuracy = typed.length > 0 ? Math.round(((typed.length - gameState.errors) / typed.length) * 100) : 100;

    // Calculate penalty errors: Only errors AFTER losing all 3 hearts (first 3 errors are free)
    const penaltyErrors = Math.max(0, gameState.errors - (3 - heartsLost));

    // Send progress update
    socket.emit('updateProgress', {
        progress,
        wpm,
        accuracy,
        errors: gameState.errors, // Current red letters
        hearts: gameState.hearts,
        penaltyErrors: penaltyErrors // Only errors beyond the 3 hearts cause penalties
    });

    // Check if finished
    if (typed.length >= gameState.passage.length) {
        elements.typingInput.disabled = true;
        // Submit biometric sample if in training mode
        submitBiometricSample(biometricPassageText);
    }
});

function displayResults(results, earlyEnd = false) {
    elements.resultsContainer.innerHTML = '';

    // Show early end notice for 5+ player games
    if (earlyEnd) {
        const notice = document.createElement('div');
        notice.style.cssText = `
            background: linear-gradient(135deg, #fbbf2440, #ff326440);
            border: 2px solid #fbbf24;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: center;
            font-size: 16px;
            font-weight: 600;
            color: #fbbf24;
        `;
        notice.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 8px;">🏁</div>
            <div>Game ended - First 3 players finished!</div>
            <div style="font-size: 14px; margin-top: 8px; opacity: 0.8;">Remaining players ranked by progress & accuracy</div>
        `;
        elements.resultsContainer.appendChild(notice);
    }

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

        // Show if player left
        if (player.left) {
            name.textContent += ' (Left)';
            name.style.color = '#ff6b6b';
        }

        // Highlight current player
        if (player.id === socket.id) {
            name.textContent += ' (You)';
            name.style.color = '#00d4ff';
        }

        const stats = document.createElement('div');
        stats.className = 'player-stats';

        // Display time breakdown
        let timeDisplay = 'DNF';
        if (player.left && player.dnf) {
            timeDisplay = 'Left Game';
        } else if (player.finished && player.finishTime) {
            // Player finished - show time
            const rawTime = player.rawTime ? (player.rawTime / 1000).toFixed(2) : (player.finishTime / 1000).toFixed(2);
            const penaltyTime = player.penaltyTime ? (player.penaltyTime / 1000).toFixed(1) : '0.0';
            const totalTime = player.totalTime ? (player.totalTime / 1000).toFixed(2) : (player.finishTime / 1000).toFixed(2);
            const errors = player.errors || 0;

            // Show breakdown if there are penalties
            if (player.penaltyTime && player.penaltyTime > 0) {
                timeDisplay = `<span style="color: #00d4ff;">${rawTime}s</span> + <span style="color: #ff3264;">${penaltyTime}s</span> = <span style="color: #00ff88; font-weight: 700;">${totalTime}s</span>`;
            } else {
                timeDisplay = `<span style="color: #00ff88; font-weight: 700;">${totalTime}s</span>`;
            }

            stats.innerHTML = `
                ${timeDisplay} •
                <span>${player.wpm} WPM</span> •
                <span>${player.accuracy}% accuracy</span> •
                <span style="color: ${errors > 3 ? '#ff3264' : '#fbbf24'};">${errors} errors</span>
            `;
        } else if (!player.finished && player.progress !== undefined) {
            // Player didn't finish - show progress and accuracy
            stats.innerHTML = `
                <span style="color: #fbbf24; font-weight: 700;">${player.progress.toFixed(1)}% Complete</span> •
                <span>${player.wpm} WPM</span> •
                <span>${player.accuracy}% accuracy</span> •
                <span style="color: #ff3264;">${player.errors || 0} errors</span>
            `;
        } else {
            stats.innerHTML = `
                <span>${timeDisplay}</span> •
                <span>${player.wpm} WPM</span> •
                <span>${player.accuracy}% accuracy</span>
            `;
        }

        info.appendChild(name);
        info.appendChild(stats);

        div.appendChild(rank);
        div.appendChild(info);

        // Add friend request button for other players (not yourself, not bots)
        if (player.id !== socket.id && !player.isBot && currentUserId) {
            const friendActions = document.createElement('div');
            friendActions.className = 'friend-actions-results';
            friendActions.id = `friend-actions-${player.id}`;

            // Check if already friends or request pending
            checkFriendStatus(player.name, player.id, friendActions);

            div.appendChild(friendActions);
        }

        elements.resultsContainer.appendChild(div);
    });

    if (gameState.isHost) {
        elements.hostRematchControls.classList.remove('hidden');
    }
}

// Check friend status and display appropriate button
async function checkFriendStatus(username, playerId, container) {
    try {
        const _gh = window.authHeaders ? window.authHeaders() : {};
        // Get friends list
        const friendsResponse = await fetch('/api/friends/list', { headers: _gh });
        const friendsData = await friendsResponse.json();
        const friends = friendsData.friends || [];

        // Get pending requests
        const requestsResponse = await fetch('/api/friends/pending', { headers: _gh });
        const requestsData = await requestsResponse.json();
        const receivedRequests = requestsData.received || [];
        const sentRequests = requestsData.sent || [];

        // Check if already friends
        const isFriend = friends.some(f => f.username === username);
        if (isFriend) {
            container.innerHTML = '<span style="color: var(--color-success); font-size: 14px;">✓ Friends</span>';
            return;
        }

        // Check if request already sent
        const requestSent = sentRequests.some(r => r.to.username === username);
        if (requestSent) {
            container.innerHTML = '<span style="color: rgba(226, 232, 240, 0.6); font-size: 14px;">Request Sent</span>';
            return;
        }

        // Check if request received (show accept/reject)
        const requestReceived = receivedRequests.find(r => r.from.username === username);
        if (requestReceived) {
            container.innerHTML = `
                <button class="btn-small btn-primary" onclick="acceptFriendRequestInGame('${requestReceived.id}', '${playerId}')">Accept</button>
                <button class="btn-small btn-secondary" onclick="rejectFriendRequestInGame('${requestReceived.id}', '${playerId}')">Reject</button>
            `;
            return;
        }

        // Show add friend button
        container.innerHTML = `<button class="btn-small btn-primary" onclick="sendFriendRequestInGame('${username}', '${playerId}')">Add Friend</button>`;
    } catch (error) {
        console.error('Error checking friend status:', error);
    }
}

// Send friend request from game results
async function sendFriendRequestInGame(username, playerId) {
    try {
        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: { ...(window.authHeaders ? window.authHeaders() : {}), 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (response.ok) {
            // Emit socket event to notify recipient
            if (data.recipientId) {
                socket.emit('friendRequestSent', {
                    recipientId: data.recipientId,
                    requestId: data.request.id
                });
            }

            // Update button
            const container = document.getElementById(`friend-actions-${playerId}`);
            if (container) {
                container.innerHTML = '<span style="color: rgba(226, 232, 240, 0.6); font-size: 14px;">Request Sent</span>';
            }
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        alert('Failed to send friend request');
    }
}

// Accept friend request from game results
async function acceptFriendRequestInGame(requestId, playerId) {
    try {
        const response = await fetch(`/api/friends/accept/${requestId}`, {
            method: 'POST',
            headers: window.authHeaders ? window.authHeaders() : {}
        });

        if (response.ok) {
            const container = document.getElementById(`friend-actions-${playerId}`);
            if (container) {
                container.innerHTML = '<span style="color: var(--color-success); font-size: 14px;">✓ Friends</span>';
            }
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
    }
}

// Reject friend request from game results
async function rejectFriendRequestInGame(requestId, playerId) {
    try {
        const response = await fetch(`/api/friends/reject/${requestId}`, {
            method: 'POST',
            headers: window.authHeaders ? window.authHeaders() : {}
        });

        if (response.ok) {
            const container = document.getElementById(`friend-actions-${playerId}`);
            if (container) {
                container.innerHTML = `<button class="btn-small btn-primary" onclick="sendFriendRequestInGame('${playerId}')">Add Friend</button>`;
            }
        }
    } catch (error) {
        console.error('Error rejecting friend request:', error);
    }
}

// Save game result to database
async function saveGameResult(results) {
    try {
        // Prepare players data
        const players = results.map((player, index) => ({
            username: player.name,
            wpm: player.wpm || 0,
            accuracy: player.accuracy || 100,
            progress: player.progress || 100,
            finishTime: player.finishTime,
            placement: index + 1,
            isBot: player.isBot || false
        }));

        // Determine winner
        const winner = results[0];

        // Prepare game data
        const gameData = {
            roomCode: gameState.roomCode,
            gameMode: gameState.gameMode,
            difficulty: gameState.difficulty,
            passageLength: gameState.passageLength,
            passage: gameState.passage,
            startTime: gameState.startTime,
            endTime: Date.now(),
            duration: Date.now() - gameState.startTime,
            players: players,
            winner: {
                username: winner.name,
                isBot: winner.isBot || false
            }
        };

        // Send to API
        const response = await fetch('/api/game/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gameData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('Game result saved successfully');
        } else {
            console.error('Failed to save game result:', data.message);
        }
    } catch (error) {
        console.error('Error saving game result:', error);
        // Don't show error to user, just log it
    }
}

// ===== FRIENDS AND INVITE FUNCTIONALITY =====

let currentUserId = null;
let currentInviteRoomCode = null;

// Check if user is logged in and register online status
async function registerUserOnline() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (data.success && data.user) {
            currentUserId = data.user._id;

            // Notify server that user is online
            socket.emit('userOnline', { userId: currentUserId });

            // Show invite friends button in lobby
            const inviteContainer = document.getElementById('inviteFriendsContainer');
            if (inviteContainer) {
                inviteContainer.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error registering user online:', error);
    }
}

// Call this when socket connects
socket.on('connect', () => {
    registerUserOnline();
});

// Handle friend online/offline events
socket.on('friendOnline', ({ userId, username, displayName }) => {
    console.log(`Friend ${username} is now online`);
});

socket.on('friendOffline', ({ userId, username }) => {
    console.log(`Friend ${username} is now offline`);
});

// Handle incoming game invite
socket.on('gameInvite', ({ from, roomCode }) => {
    currentInviteRoomCode = roomCode;

    const notification = document.getElementById('gameInviteNotification');
    const inviteFromUser = document.getElementById('inviteFromUser');

    inviteFromUser.textContent = `${from.username} invited you to play!`;
    notification.classList.remove('hidden');

    // Auto-hide after 30 seconds
    setTimeout(() => {
        if (notification && !notification.classList.contains('hidden')) {
            notification.classList.add('hidden');
        }
    }, 30000);
});

// Accept game invite
document.getElementById('acceptInviteBtn')?.addEventListener('click', () => {
    if (currentInviteRoomCode) {
        const playerName = gameState.playerName || localStorage.getItem('username') || 'Guest';

        // Join the room
        socket.emit('joinRoom', { roomCode: currentInviteRoomCode, playerName });

        // Hide notification
        document.getElementById('gameInviteNotification').classList.add('hidden');
        currentInviteRoomCode = null;
    }
});

// Decline game invite
document.getElementById('declineInviteBtn')?.addEventListener('click', () => {
    document.getElementById('gameInviteNotification').classList.add('hidden');
    currentInviteRoomCode = null;
});

// Open friends invite modal
document.getElementById('inviteFriendsBtn')?.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/friends/online', { headers: window.authHeaders ? window.authHeaders() : {} });
        const data = await response.json();

        const onlineFriends = data.onlineFriends || [];
        const modal = document.getElementById('friendsInviteModal');
        const friendsList = document.getElementById('onlineFriendsList');

        if (onlineFriends.length === 0) {
            friendsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(226, 232, 240, 0.6);">
                    <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                    <div style="font-size: 18px;">No friends online</div>
                    <div style="font-size: 14px; margin-top: 8px;">Invite your friends to add them!</div>
                </div>
            `;
        } else {
            friendsList.innerHTML = onlineFriends.map(friend => {
                const initial = friend.username.charAt(0).toUpperCase();
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 12px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: white;">
                                ${initial}
                            </div>
                            <div>
                                <div style="font-size: 16px; font-weight: 600; color: #e2e8f0;">${friend.username}</div>
                                <div style="font-size: 13px; color: var(--color-success); display: flex; align-items: center; gap: 6px;">
                                    <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 8px var(--color-success);"></span>
                                    Online
                                </div>
                            </div>
                        </div>
                        <button onclick="inviteFriendToGame('${friend.id}', '${friend.username}')" class="btn btn-primary btn-small">
                            Invite
                        </button>
                    </div>
                `;
            }).join('');
        }

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading online friends:', error);
    }
});

// Close friends modal
document.getElementById('closeFriendsModal')?.addEventListener('click', () => {
    document.getElementById('friendsInviteModal').classList.add('hidden');
});

// Close modal when clicking outside
document.getElementById('friendsInviteModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'friendsInviteModal') {
        document.getElementById('friendsInviteModal').classList.add('hidden');
    }
});

// Invite friend to game
function inviteFriendToGame(friendId, friendUsername) {
    const roomCode = gameState.roomCode;

    if (!roomCode) {
        alert('You need to create a room first!');
        return;
    }

    // Send invite via socket
    socket.emit('inviteFriend', { friendId, roomCode });

    // Show feedback
    alert(`Invite sent to ${friendUsername}!`);

    // Close modal
    document.getElementById('friendsInviteModal').classList.add('hidden');
}

// Initialize training mode on page load
initTrainingMode();
