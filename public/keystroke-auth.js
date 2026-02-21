/**
 * Keystroke Authentication Hub - JavaScript
 *
 * Manages the main dashboard for keystroke biometric training and testing
 */

// Load enrollment status on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadEnrollmentStatus();
    setupEventListeners();
});

async function loadEnrollmentStatus() {
    try {
        const response = await fetch('/api/keystroke-auth/enrollment-status');
        const data = await response.json();

        if (data.success) {
            updateUI(data);
        } else {
            console.error('Failed to load enrollment status:', data.message);
        }
    } catch (error) {
        console.error('Error loading enrollment status:', error);
        // Show default state
        updateUI({
            samplesCollected: 0,
            enrollmentTier: 'none',
            tierName: 'Not Started',
            nextTierAt: 10,
            canTest: false,
            canEnableAuth: false,
            biometricAuthEnabled: false
        });
    }
}

function updateUI(data) {
    const {
        samplesCollected,
        enrollmentTier,
        tierName,
        nextTierAt,
        canTest,
        canEnableAuth,
        biometricAuthEnabled
    } = data;

    // Update progress bar
    const progress = nextTierAt ? (samplesCollected / nextTierAt) * 100 : 100;
    document.getElementById('progressFill').style.width = progress + '%';

    // Update progress text
    if (nextTierAt) {
        document.getElementById('progressText').textContent =
            `${samplesCollected} / ${nextTierAt} samples collected`;
    } else {
        document.getElementById('progressText').textContent =
            `${samplesCollected} samples collected - Maximum tier reached!`;
    }

    // Update tier badge
    const tierBadge = document.getElementById('tierBadge');
    tierBadge.textContent = tierName;
    tierBadge.className = 'tier-badge tier-' + enrollmentTier;

    // Update tier description
    const tierDescriptions = {
        'none': 'Complete 10 samples to unlock testing mode',
        'initial': 'Initial Model (70-80% accuracy) - Complete 25 samples for Good tier',
        'good': 'Good Model (85-90% accuracy) - Complete 50 samples for High tier',
        'high': 'High Accuracy (95%+ accuracy) - Maximum tier achieved!'
    };
    document.getElementById('tierText').textContent = tierDescriptions[enrollmentTier];

    // Enable/disable testing button
    const testingBtn = document.getElementById('startTestingBtn');
    if (canTest) {
        testingBtn.disabled = false;
        testingBtn.textContent = 'Test Model';
    } else {
        testingBtn.disabled = true;
        testingBtn.textContent = 'Test Model (Unlock at 10 samples)';
    }

    // Enable/disable biometric auth checkbox
    const biometricCheckbox = document.getElementById('enableBiometricAuth');
    biometricCheckbox.disabled = !canEnableAuth;
    biometricCheckbox.checked = biometricAuthEnabled;

    // Add change listener for biometric auth checkbox
    biometricCheckbox.addEventListener('change', handleBiometricAuthToggle);
}

function setupEventListeners() {
    // Training button
    document.getElementById('startTrainingBtn').addEventListener('click', () => {
        window.location.href = '/keystroke-training.html';
    });

    // Testing button
    document.getElementById('startTestingBtn').addEventListener('click', () => {
        window.location.href = '/keystroke-testing.html';
    });
}

async function handleBiometricAuthToggle(event) {
    const enabled = event.target.checked;

    try {
        const endpoint = enabled
            ? '/api/keystroke-auth/enable-biometric-auth'
            : '/api/keystroke-auth/disable-biometric-auth';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
        } else {
            alert('Error: ' + data.message);
            // Revert checkbox
            event.target.checked = !enabled;
        }
    } catch (error) {
        console.error('Error toggling biometric auth:', error);
        alert('Failed to update biometric authentication setting');
        // Revert checkbox
        event.target.checked = !enabled;
    }
}

// Particle animation (reuse from main page)
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
