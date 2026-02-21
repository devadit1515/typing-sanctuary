/**
 * Keystroke Testing Interface - JavaScript
 *
 * Handles self-testing and impostor challenge modes
 */

let currentMode = 'self-test';
let currentPassage = '';
let keystrokeCapture = [];
let lastKeyUp = null;
let currentChallengeCode = null;

document.addEventListener('DOMContentLoaded', () => {
    loadTestPassage();
    setupEventListeners();
});

function switchMode(mode) {
    currentMode = mode;

    // Update button states
    document.getElementById('selfTestBtn').classList.toggle('active', mode === 'self-test');
    document.getElementById('impostorBtn').classList.toggle('active', mode === 'impostor');

    // Show/hide sections
    document.getElementById('selfTestSection').classList.toggle('active', mode === 'self-test');
    document.getElementById('impostorSection').classList.toggle('active', mode === 'impostor');
}

async function loadTestPassage() {
    // Generate random test passage
    const passages = [
        "the quick brown fox jumps over the lazy dog",
        "Technology advances at an incredible pace transforming our world",
        "The year 2025 marks 100 years since the discovery in 1925",
        "Hello, World! The year is 2025. We have 100 users growing fast.",
        "P@ssw0rd! Use secure passwords with numbers 123 and symbols!"
    ];

    currentPassage = passages[Math.floor(Math.random() * passages.length)];
    document.getElementById('testPassage').textContent = currentPassage;

    // Reset
    document.getElementById('testInput').value = '';
    keystrokeCapture = [];
    lastKeyUp = null;
    document.getElementById('resultCard').classList.remove('show');
}

function setupEventListeners() {
    const testInput = document.getElementById('testInput');

    // Capture keydown
    testInput.addEventListener('keydown', (event) => {
        if (event.key.length === 1) {
            const timestamp = performance.now();

            keystrokeCapture.push({
                char: event.key,
                keyCode: event.code,
                timestamp: timestamp,
                keydownTime: timestamp,
                position: testInput.value.length,
                type: 'keydown'
            });
        }
    });

    // Capture keyup
    testInput.addEventListener('keyup', (event) => {
        if (event.key.length === 1) {
            const timestamp = performance.now();

            const lastKeydown = keystrokeCapture[keystrokeCapture.length - 1];
            if (lastKeydown && lastKeydown.type === 'keydown') {
                lastKeydown.keyupTime = timestamp;
                lastKeydown.dwellTime = timestamp - lastKeydown.keydownTime;

                if (lastKeyUp !== null) {
                    lastKeydown.flightTime = lastKeydown.keydownTime - lastKeyUp;
                } else {
                    lastKeydown.flightTime = 0;
                }

                lastKeyUp = timestamp;
                lastKeydown.type = 'complete';

                // Mark correctness
                if (lastKeydown.position < currentPassage.length) {
                    lastKeydown.isCorrect = lastKeydown.char === currentPassage[lastKeydown.position];
                }
            }
        }
    });

    // Verify button
    document.getElementById('verifyBtn').addEventListener('click', verifyIdentity);

    // New passage button
    document.getElementById('newTestPassageBtn').addEventListener('click', loadTestPassage);

    // Impostor challenge buttons
    document.getElementById('createChallengeBtn').addEventListener('click', createChallenge);
    document.getElementById('copyChallengeBtn').addEventListener('click', copyChallenge);
}

async function verifyIdentity() {
    try {
        const verifyBtn = document.getElementById('verifyBtn');
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        const completeKeystrokes = keystrokeCapture.filter(k => k.type === 'complete');

        if (completeKeystrokes.length < 20) {
            alert('Please type at least 20 characters for accurate verification');
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Identity';
            return;
        }

        const response = await fetch('/api/keystroke-auth/verify-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                passage: currentPassage,
                keystrokes: completeKeystrokes.map(k => ({
                    char: k.char,
                    keyCode: k.keyCode,
                    dwellTime: k.dwellTime,
                    flightTime: k.flightTime,
                    position: k.position,
                    isCorrect: k.isCorrect,
                    timestamp: k.timestamp
                })),
                mode: 'self-test'
            })
        });

        const data = await response.json();

        if (data.success) {
            displayResult(data);
        } else {
            alert('Error: ' + data.message);
        }

        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Identity';

    } catch (error) {
        console.error('Error verifying identity:', error);
        alert('Verification failed. Please try again.');

        const verifyBtn = document.getElementById('verifyBtn');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Identity';
    }
}

function displayResult(data) {
    const { confidence, riskLevel, authenticated } = data;

    // Show result card
    const resultCard = document.getElementById('resultCard');
    resultCard.classList.add('show');

    // Animate confidence bar
    const confidenceBar = document.getElementById('confidenceBar');
    confidenceBar.style.width = confidence + '%';

    // Set color based on risk
    confidenceBar.className = 'confidence-bar';
    if (riskLevel === 'LOW') {
        confidenceBar.classList.add('risk-low');
    } else if (riskLevel === 'MEDIUM') {
        confidenceBar.classList.add('risk-medium');
    } else {
        confidenceBar.classList.add('risk-high');
    }

    // Update text
    document.getElementById('confidenceText').textContent = confidence + '% confident this is you';

    // Risk level badge
    const riskElement = document.getElementById('riskLevel');
    riskElement.className = 'risk-level risk-' + riskLevel.toLowerCase();
    riskElement.innerHTML = 'Risk Level: ' + riskLevel + ' ' +
        (riskLevel === 'LOW' ? '✅' : (riskLevel === 'MEDIUM' ? '⚠️' : '🚫'));

    // Result message
    const resultMessage = document.getElementById('resultMessage');
    if (authenticated) {
        resultMessage.textContent = '✓ Identity verified! Your typing pattern matches your profile.';
    } else if (riskLevel === 'MEDIUM') {
        resultMessage.textContent = '⚠ Suspicious - your typing pattern is somewhat different than usual.';
    } else {
        resultMessage.textContent = '✗ Identity not verified - typing pattern does not match your profile.';
    }

    // Scroll to result
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function createChallenge() {
    try {
        const btn = document.getElementById('createChallengeBtn');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        const response = await fetch('/api/keystroke-auth/create-impostor-challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            currentChallengeCode = data.challengeCode;
            document.getElementById('challengeCode').textContent = data.challengeCode;
            document.getElementById('copyChallengeBtn').disabled = false;

            // Start polling for attempts
            startLeaderboardPolling(data.challengeCode);

            alert('Challenge created! Share the code with your friends.');
        } else {
            alert('Error: ' + data.message);
        }

        btn.disabled = false;
        btn.textContent = 'Create New Challenge';

    } catch (error) {
        console.error('Error creating challenge:', error);
        alert('Failed to create challenge');

        const btn = document.getElementById('createChallengeBtn');
        btn.disabled = false;
        btn.textContent = 'Create New Challenge';
    }
}

function copyChallenge() {
    if (currentChallengeCode) {
        navigator.clipboard.writeText(currentChallengeCode).then(() => {
            alert('Challenge code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy code');
        });
    }
}

let leaderboardPollInterval = null;

async function startLeaderboardPolling(challengeCode) {
    // Clear existing interval
    if (leaderboardPollInterval) {
        clearInterval(leaderboardPollInterval);
    }

    // Show leaderboard
    document.getElementById('leaderboardCard').style.display = 'block';

    // Poll every 5 seconds
    leaderboardPollInterval = setInterval(() => {
        updateLeaderboard(challengeCode);
    }, 5000);

    // Initial update
    updateLeaderboard(challengeCode);
}

async function updateLeaderboard(challengeCode) {
    try {
        const response = await fetch(`/api/keystroke-auth/impostor-leaderboard/${challengeCode}`);
        const data = await response.json();

        if (data.success && data.leaderboard) {
            const tbody = document.getElementById('leaderboardBody');

            if (data.leaderboard.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; padding: 20px;">
                            No attempts yet - share the code with friends!
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = data.leaderboard.map((attempt, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${attempt.playerName || 'Anonymous'}</td>
                        <td>${attempt.confidence}%</td>
                        <td>
                            <span class="fooled-badge fooled-${attempt.fooledSystem ? 'yes' : 'no'}">
                                ${attempt.fooledSystem ? 'Fooled System! 🎉' : 'Detected ✓'}
                            </span>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error updating leaderboard:', error);
    }
}

// Particle animation
function createParticles() {
    const container = document.getElementById('particlesContainer');
    if (!container) return;

    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 20 + 10) + 's';
        container.appendChild(particle);
    }
}

createParticles();
