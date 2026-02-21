/**
 * Keystroke Training Interface - JavaScript
 *
 * Captures keystroke timing data during manual training
 */

let currentPassage = '';
let keystrokeCapture = [];
let lastKeyUp = null;
let startTime = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadProgress();
    await loadNewPassage();
    setupEventListeners();
});

async function loadProgress() {
    try {
        const response = await fetch('/api/keystroke-auth/enrollment-status');
        const data = await response.json();

        if (data.success) {
            const { samplesCollected, enrollmentTier, tierName, nextTierAt } = data;

            const progressTitle = document.getElementById('progressTitle');
            const progressDesc = document.getElementById('progressDesc');

            if (nextTierAt) {
                progressTitle.textContent = `${samplesCollected} / ${nextTierAt} samples collected`;
                progressDesc.textContent = `Current Tier: ${tierName} - Complete ${nextTierAt - samplesCollected} more to reach next tier`;
            } else {
                progressTitle.textContent = `${samplesCollected} samples collected`;
                progressDesc.textContent = `Maximum tier reached! Keep training to improve accuracy further.`;
            }
        }
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Tiered passage pool: ultra-short (1-3 words), short (4-8 words), medium (10-20 words)
const TRAINING_PASSAGES = {
    ultraShort: [
        'hello world', 'type fast', 'quick brown', 'speed key',
        'data flow', 'fox jumps', 'pack box', 'black cat',
        'the sun', 'cold rain', 'blue sky', 'night owl',
        'red flag', 'gold ring', 'main road', 'test run',
        'log in', 'sign up', 'key press', 'time flies',
    ],
    short: [
        'the quick brown fox jumps high',
        'pack my box with five dozen jugs',
        'how quickly daft jumping zebras vex',
        'sphinx of black quartz judge my vow',
        'the five boxing wizards jump quickly',
        'bright stars fill the dark night sky',
        'she sells seashells by the seashore',
        'a stitch in time saves nine lives',
        'look before you leap every single time',
        'actions speak louder than any words do',
        'keep calm and carry on typing now',
        'every keystroke tells a unique story',
        'your fingers know the rhythm by heart',
        'practice makes perfect every single day',
        'type with confidence and steady rhythm',
    ],
    medium: [
        'The early bird catches the worm but the second mouse gets the cheese.',
        'Practice makes perfect when you dedicate time each day to improve your skills.',
        'Coffee in the morning wakes up your mind and prepares you for a full day.',
        'Music brings joy and connects people from many different cultures around the world.',
        'Reading books opens your mind to new ideas and broadens your perspective greatly.',
        'The mountain trail offers breathtaking views and peaceful solitude for hikers.',
        'A good night of sleep is the foundation of a productive and healthy day ahead.',
        'Learning to type quickly is a skill that pays dividends throughout your entire career.',
        'Small consistent improvements compound into remarkable results over a long period of time.',
        'Focus on the process and the results will follow naturally with enough patience.',
    ]
};

function getRandomTrainingPassage() {
    // Weights: 25% ultra-short, 45% short, 30% medium
    const roll = Math.random();
    let pool;
    if (roll < 0.25) pool = TRAINING_PASSAGES.ultraShort;
    else if (roll < 0.70) pool = TRAINING_PASSAGES.short;
    else pool = TRAINING_PASSAGES.medium;
    return pool[Math.floor(Math.random() * pool.length)];
}

async function loadNewPassage() {
    try {
        currentPassage = getRandomTrainingPassage();
        document.getElementById('passageDisplay').textContent = currentPassage;

        // Reset input and stats
        document.getElementById('typingInput').value = '';
        document.getElementById('submitBtn').disabled = true;
        keystrokeCapture = [];
        lastKeyUp = null;
        startTime = null;
        updateStats();

    } catch (error) {
        console.error('Error loading passage:', error);
    }
}

function setupEventListeners() {
    const typingInput = document.getElementById('typingInput');

    // Capture keydown
    typingInput.addEventListener('keydown', (event) => {
        if (event.key.length === 1) { // Printable character
            if (startTime === null) {
                startTime = performance.now();
            }

            const timestamp = performance.now();

            keystrokeCapture.push({
                char: event.key,
                keyCode: event.code,
                timestamp: timestamp,
                keydownTime: timestamp,
                position: typingInput.value.length,
                type: 'keydown'
            });
        }
    });

    // Capture keyup
    typingInput.addEventListener('keyup', (event) => {
        if (event.key.length === 1) {
            const timestamp = performance.now();

            // Find matching keydown
            const lastKeydown = keystrokeCapture[keystrokeCapture.length - 1];
            if (lastKeydown && lastKeydown.type === 'keydown') {
                lastKeydown.keyupTime = timestamp;
                lastKeydown.dwellTime = timestamp - lastKeydown.keydownTime;

                // Calculate flight time
                if (lastKeyUp !== null) {
                    lastKeydown.flightTime = lastKeydown.keydownTime - lastKeyUp;
                } else {
                    lastKeydown.flightTime = 0;
                }

                lastKeyUp = timestamp;
                lastKeydown.type = 'complete';
            }
        }
    });

    // Update stats on input
    typingInput.addEventListener('input', () => {
        updateStats();
    });

    // Submit button
    document.getElementById('submitBtn').addEventListener('click', submitSample);

    // New passage button
    document.getElementById('newPassageBtn').addEventListener('click', loadNewPassage);

    // Train via games button
    document.getElementById('trainViaGamesBtn').addEventListener('click', () => {
        window.location.href = '/game.html?training=true';
    });
}

function updateStats() {
    const typed = document.getElementById('typingInput').value;

    // Mark keystrokes as correct/incorrect
    keystrokeCapture.forEach((keystroke, index) => {
        if (keystroke.position < currentPassage.length) {
            keystroke.isCorrect = keystroke.char === currentPassage[keystroke.position];
        }
    });

    // Calculate progress
    const progress = Math.min(100, (typed.length / currentPassage.length) * 100);
    document.getElementById('progressValue').textContent = Math.round(progress) + '%';

    // Calculate WPM
    if (startTime) {
        const elapsedMinutes = (performance.now() - startTime) / 1000 / 60;
        const words = typed.length / 5; // Standard: 5 characters = 1 word
        const wpm = elapsedMinutes > 0 ? Math.round(words / elapsedMinutes) : 0;
        document.getElementById('wpmValue').textContent = wpm;
    }

    // Calculate accuracy
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] === currentPassage[i]) correct++;
    }
    const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
    document.getElementById('accuracyValue').textContent = accuracy + '%';

    // Enable submit button if passage is complete
    // Ultra-short passages may have fewer than 20 keystrokes; use length-based minimum
    const minKeystrokes = Math.max(5, Math.min(20, currentPassage.length));
    const isComplete = typed.length >= currentPassage.length && progress >= 100;
    document.getElementById('submitBtn').disabled = !isComplete || keystrokeCapture.length < minKeystrokes;
}

async function submitSample() {
    try {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // Filter out incomplete keystrokes
        const completeKeystrokes = keystrokeCapture.filter(k => k.type === 'complete');

        const minRequired = Math.max(5, Math.min(20, currentPassage.length));
        if (completeKeystrokes.length < minRequired) {
            alert('Not enough keystroke data. Please type the full passage.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Complete & Submit Sample';
            return;
        }

        const response = await fetch('/api/keystroke-auth/submit-sample', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                passage: currentPassage,
                passageLength: currentPassage.length < 100 ? 'short' : 'medium',
                keystrokes: completeKeystrokes.map(k => ({
                    char: k.char,
                    keyCode: k.keyCode,
                    dwellTime: k.dwellTime,
                    flightTime: k.flightTime,
                    position: k.position,
                    isCorrect: k.isCorrect,
                    timestamp: k.timestamp
                })),
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    language: navigator.language,
                    hardwareConcurrency: navigator.hardwareConcurrency || 0,
                    deviceMemory: navigator.deviceMemory || 0,
                    colorDepth: window.screen.colorDepth || 0
                },
                source: 'training'
            })
        });

        const data = await response.json();

        if (data.success) {
            // Show success message
            alert(`Sample submitted successfully! Progress: ${data.enrollmentProgress.current}/${data.enrollmentProgress.nextTierAt || '∞'}`);

            // Check if tier unlocked
            if (data.tierUnlocked) {
                showCelebration(data.enrollmentProgress.tierName);
            }

            // Reload progress
            await loadProgress();

            // Load new passage
            await loadNewPassage();

        } else {
            alert('Error: ' + data.message);
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete & Submit Sample';

    } catch (error) {
        console.error('Error submitting sample:', error);
        alert('Failed to submit sample. Please try again.');

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete & Submit Sample';
    }
}

function showCelebration(tierName) {
    const modal = document.getElementById('celebrationModal');
    const text = document.getElementById('celebrationText');

    const messages = {
        'initial': 'You\'ve unlocked the Initial tier! Testing mode is now available. Your model has 70-80% accuracy.',
        'good': 'Amazing! You\'ve reached the Good tier with 85-90% accuracy. You can now enable biometric login protection!',
        'high': 'Incredible! You\'ve achieved the High tier with 95%+ accuracy. This is research-grade performance!'
    };

    text.textContent = messages[tierName] || 'New tier unlocked!';
    modal.classList.add('show');

    setTimeout(() => {
        modal.classList.remove('show');
    }, 5000);
}

function closeCelebration() {
    document.getElementById('celebrationModal').classList.remove('show');
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
