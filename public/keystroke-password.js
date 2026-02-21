/**
 * keystroke-password.js
 * Password Keystroke Mode — client-side logic
 *
 * Manages 3 views:
 *   view-set   → user sets their keystroke password phrase
 *   view-train → 15-sample training (5 rounds × slow/normal/fast)
 *   view-test  → type and verify, see % similarity + verdict
 */

'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────

let currentUser = null;
let passwordLength = 0;     // set after /set-password succeeds
let trainingCount = 0;      // samples collected so far

// Keystroke capture state (shared between training and testing)
let keyDownTimes = {};      // { char_position: performance.now() }
let capturedDwells = [];    // hold durations per character
let capturedFlights = [];   // inter-character gaps per character
let lastKeyUpTime = null;
let typingStarted = false;

// Speed sequence: rounds of (slow, normal, fast)
const SPEED_SEQUENCE = ['slow', 'normal', 'fast'];
const TOTAL_SAMPLES = 15;

const SPEED_CONFIG = {
  slow:   { label: 'SLOW',   cls: 'speed-slow',   instruction: 'Type slowly and deliberately', hint: 'Take your time. Spell each character carefully.' },
  normal: { label: 'NORMAL', cls: 'speed-normal',  instruction: 'Type at your natural pace',   hint: 'Type as you normally would — relaxed and comfortable.' },
  fast:   { label: 'FAST',   cls: 'speed-fast',    instruction: 'Type as fast as you can',      hint: 'Push your speed! Go as quickly as possible.' }
};

// ─── VIEW MANAGEMENT ─────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.kp-view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
}

// ─── KEYSTROKE CAPTURE HELPERS ───────────────────────────────────────────────

function resetCapture() {
  keyDownTimes = {};
  capturedDwells = [];
  capturedFlights = [];
  lastKeyUpTime = null;
  typingStarted = false;
}

function attachCaptureListeners(inputEl) {
  // Remove any existing listeners by cloning
  const fresh = inputEl.cloneNode(true);
  inputEl.parentNode.replaceChild(fresh, inputEl);

  fresh.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key === 'Enter') return;
    const pos = fresh.value.length; // position before char is added
    if (!keyDownTimes[pos]) {
      keyDownTimes[pos] = performance.now();
    }
    typingStarted = true;
  });

  fresh.addEventListener('keyup', (e) => {
    if (e.key === 'Tab' || e.key === 'Enter') return;
    const pos = fresh.value.length - 1; // position of just-typed char
    if (pos < 0) return;

    const downTime = keyDownTimes[pos];
    if (downTime !== undefined) {
      const now = performance.now();
      const dwell = now - downTime;
      capturedDwells[pos] = Math.round(dwell);

      if (lastKeyUpTime !== null) {
        capturedFlights[pos] = Math.round(downTime - lastKeyUpTime);
      } else {
        capturedFlights[pos] = 0;
      }

      lastKeyUpTime = now;
      delete keyDownTimes[pos];
    }
  });

  return fresh;
}

// ─── VIEW 1: SET PASSWORD ────────────────────────────────────────────────────

async function initSetView() {
  const input   = document.getElementById('set-password-input');
  const btn     = document.getElementById('set-password-btn');
  const errEl   = document.getElementById('set-error');
  const eyeBtn  = document.getElementById('set-toggle-eye');
  const existing= document.getElementById('existing-status');

  // Toggle visibility
  eyeBtn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Check if user already has a password profile
  try {
    const res = await fetch('/api/keystroke-auth/password-status');
    const data = await res.json();
    if (data.hasPassword) {
      existing.style.display = 'block';
      if (data.trainingComplete) {
        // Offer to skip directly to test
        const skipLink = document.createElement('button');
        skipLink.className = 'kp-btn kp-btn-secondary';
        skipLink.style.marginTop = '12px';
        skipLink.textContent = 'Use existing trained model → Test';
        skipLink.addEventListener('click', () => showView('test'));
        btn.parentNode.insertBefore(skipLink, btn.nextSibling);
      }
      trainingCount = data.trainingCount || 0;
      passwordLength = data.passwordLength || 0;
    }
  } catch (_) {}

  btn.addEventListener('click', async () => {
    const password = input.value;
    errEl.classList.remove('visible');

    if (!password || password.length < 4) {
      errEl.textContent = 'Password must be at least 4 characters.';
      errEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Setting…';

    try {
      const res = await fetch('/api/keystroke-auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (data.success) {
        passwordLength = data.passwordLength;
        trainingCount = 0;
        input.value = '';
        initTrainView();
        showView('train');
      } else {
        errEl.textContent = data.message || 'Error setting password.';
        errEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Set Password & Begin Training →';
      }
    } catch (e) {
      errEl.textContent = 'Network error. Is the server running?';
      errEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Set Password & Begin Training →';
    }
  });
}

// ─── VIEW 2: TRAINING ────────────────────────────────────────────────────────

function currentSpeed() {
  return SPEED_SEQUENCE[trainingCount % 3];
}

function updateTrainUI() {
  const speed = currentSpeed();
  const cfg = SPEED_CONFIG[speed];
  const round = Math.floor(trainingCount / 3) + 1;
  const sampleNum = trainingCount + 1;

  // Progress bar
  const pct = (trainingCount / TOTAL_SAMPLES) * 100;
  document.getElementById('train-progress-fill').style.width = pct + '%';
  document.getElementById('train-count-label').textContent = `${trainingCount} / ${TOTAL_SAMPLES} samples`;

  // Round / sample labels
  document.getElementById('train-round').textContent = Math.min(round, 5);
  document.getElementById('train-sample-num').textContent = Math.min(sampleNum, 15);

  // Speed badge
  const badge = document.getElementById('speed-badge');
  badge.textContent = cfg.label;
  badge.className = 'speed-badge ' + cfg.cls;

  document.getElementById('speed-instruction').textContent = cfg.instruction;
  document.getElementById('speed-hint').textContent = cfg.hint;

  // Speed dots (15 dots, coloured by speed)
  const dotsContainer = document.getElementById('speed-dots-container');
  dotsContainer.innerHTML = '';
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const dot = document.createElement('div');
    dot.className = 'speed-dot';
    const s = SPEED_SEQUENCE[i % 3];
    if (i < trainingCount) {
      dot.classList.add(`done-${s}`);
    } else if (i === trainingCount) {
      dot.classList.add(`done-${s}`, 'current');
    }
    dotsContainer.appendChild(dot);
  }
}

function initTrainView() {
  let trainInput = document.getElementById('train-input');
  const submitBtn = document.getElementById('train-submit-btn');
  const errEl    = document.getElementById('train-error');
  const completeCard = document.getElementById('train-complete-card');
  const goTestBtn = document.getElementById('go-to-test-btn');

  updateTrainUI();
  resetCapture();

  // Attach capture listeners (returns new element after cloning)
  trainInput = attachCaptureListeners(trainInput);

  // Enable submit only when full password length is typed
  trainInput.addEventListener('input', () => {
    submitBtn.disabled = trainInput.value.length !== passwordLength;
    errEl.classList.remove('visible');
  });

  submitBtn.addEventListener('click', async () => {
    if (trainInput.value.length !== passwordLength) {
      errEl.textContent = `Type the full password (${passwordLength} characters).`;
      errEl.classList.add('visible');
      return;
    }

    // Pad arrays to passwordLength in case some positions were missed
    const dwells = [];
    const flights = [];
    for (let i = 0; i < passwordLength; i++) {
      dwells.push(capturedDwells[i] || 80);
      flights.push(capturedFlights[i] || 0);
    }

    const speed = currentSpeed();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const res = await fetch('/api/keystroke-auth/train-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dwellTimes: dwells, flightTimes: flights, speed })
      });
      const data = await res.json();

      if (data.success) {
        trainingCount = data.trainingCount;

        if (data.trainingComplete) {
          // Show celebration
          completeCard.style.display = 'block';
          document.querySelector('#view-train .kp-card').style.display = 'none';
        } else {
          // Next sample
          trainInput.value = '';
          resetCapture();
          updateTrainUI();
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submit Sample';
        }
      } else {
        errEl.textContent = data.message || 'Error saving sample.';
        errEl.classList.add('visible');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Sample';
      }
    } catch (e) {
      errEl.textContent = 'Network error.';
      errEl.classList.add('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Sample';
    }
  });

  goTestBtn.addEventListener('click', () => {
    initTestView();
    showView('test');
  });
}

// ─── VIEW 3: TESTING ─────────────────────────────────────────────────────────

function initTestView() {
  let testInput = document.getElementById('test-input');
  const verifyBtn  = document.getElementById('test-verify-btn');
  const errEl      = document.getElementById('test-error');
  const resultDiv  = document.getElementById('test-result');
  const eyeBtn     = document.getElementById('test-toggle-eye');
  const againBtn   = document.getElementById('test-again-btn');
  const retrainBtn = document.getElementById('retrain-btn');

  // Hide previous result
  resultDiv.style.display = 'none';
  errEl.classList.remove('visible');

  // Toggle visibility
  eyeBtn.addEventListener('click', () => {
    testInput.type = testInput.type === 'password' ? 'text' : 'password';
    testInput.classList.toggle('visible', testInput.type === 'text');
  });

  resetCapture();

  // Attach capture listeners
  testInput = attachCaptureListeners(testInput);

  testInput.addEventListener('input', () => {
    verifyBtn.disabled = testInput.value.length === 0;
    errEl.classList.remove('visible');
    resultDiv.style.display = 'none';
  });

  verifyBtn.addEventListener('click', async () => {
    const password = testInput.value;
    if (!password) return;

    // Pad arrays
    const dwells = [];
    const flights = [];
    for (let i = 0; i < password.length; i++) {
      dwells.push(capturedDwells[i] || 80);
      flights.push(capturedFlights[i] || 0);
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying…';
    errEl.classList.remove('visible');

    try {
      const res = await fetch('/api/keystroke-auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, dwellTimes: dwells, flightTimes: flights })
      });
      const data = await res.json();

      if (!data.success) {
        errEl.textContent = data.message || 'Verification error.';
        errEl.classList.add('visible');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Identity';
        return;
      }

      showResult(data);
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Identity';

    } catch (e) {
      errEl.textContent = 'Network error.';
      errEl.classList.add('visible');
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Identity';
    }
  });

  againBtn.addEventListener('click', () => {
    testInput.value = '';
    resetCapture();
    resultDiv.style.display = 'none';
    verifyBtn.disabled = true;
  });

  retrainBtn.addEventListener('click', () => {
    showView('set');
    initSetView();
  });
}

function showResult(data) {
  const resultDiv  = document.getElementById('test-result');
  const circle     = document.getElementById('gauge-circle');
  const pctEl      = document.getElementById('gauge-pct');
  const verdictEl  = document.getElementById('verdict-text');
  const subEl      = document.getElementById('verdict-sub');

  resultDiv.style.display = 'block';

  const { similarity, verdict, threshold } = data;

  // Clear classes
  circle.className = 'gauge-circle';
  verdictEl.className = 'verdict-text';

  if (verdict === 'welcome') {
    circle.classList.add('welcome');
    verdictEl.classList.add('welcome');
    pctEl.textContent = similarity.toFixed(1) + '%';
    verdictEl.textContent = `Welcome, ${currentUser ? currentUser.username : 'User'}!`;
    subEl.textContent = `Similarity: ${similarity.toFixed(1)}% (threshold: ${threshold}%) — Your typing pattern matches.`;
  } else if (verdict === 'rejected') {
    circle.classList.add('rejected');
    verdictEl.classList.add('rejected');
    pctEl.textContent = similarity.toFixed(1) + '%';
    verdictEl.textContent = 'Different user detected';
    subEl.textContent = `Similarity: ${similarity.toFixed(1)}% (threshold: ${threshold}%) — Typing pattern does not match.`;
  } else if (verdict === 'wrong_password') {
    circle.classList.add('wrong');
    verdictEl.classList.add('wrong');
    pctEl.textContent = '—';
    verdictEl.textContent = 'Wrong Password';
    subEl.textContent = 'The characters you typed do not match the stored password.';
  }

  resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Get current user
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
    }
  } catch (_) {}

  // Check if user already has a trained model → decide initial view
  try {
    const res = await fetch('/api/keystroke-auth/password-status');
    const data = await res.json();

    if (data.hasPassword && data.trainingComplete) {
      // Jump straight to test, but still init set view for retrain
      trainingCount = data.trainingCount;
      passwordLength = data.passwordLength;
      initTestView();
      showView('test');
      return;
    }

    if (data.hasPassword && !data.trainingComplete) {
      // Resume training
      trainingCount = data.trainingCount;
      passwordLength = data.passwordLength;
      initTrainView();
      showView('train');
      return;
    }
  } catch (_) {}

  // Default: show set view
  initSetView();
  showView('set');
});
