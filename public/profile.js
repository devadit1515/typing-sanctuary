/**
 * Profile Page JavaScript
 * Displays user profile with stats and game history
 */

let currentUser = null;

// Load profile on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  setupResetButton();
});

// Load user profile
async function loadProfile() {
  try {
    // Check if user is logged in
    const meResponse = await fetch('/api/auth/me');
    const meData = await meResponse.json();

    if (!meData.success) {
      // Not logged in, redirect to login
      window.location.href = '/login.html';
      return;
    }

    currentUser = meData.user;

    // Load game history
    const historyResponse = await fetch('/api/profile/games?limit=20');
    const historyData = await historyResponse.json();

    console.log('Game history response:', historyData);
    console.log('Current user:', currentUser);

    displayProfile(currentUser, historyData.games || []);

    // Show reset button
    document.getElementById('resetStatsContainer').classList.remove('hidden');

  } catch (error) {
    console.error('Error loading profile:', error);
    document.getElementById('profileContent').innerHTML = `
      <div class="loading">
        Error loading profile. Please make sure you're logged in.
        <br><br>
        <a href="/login.html" class="back-button">Go to Login</a>
      </div>
    `;
  }
}

// Display profile
function displayProfile(user, gameHistory) {
  const content = document.getElementById('profileContent');

  // Get first letter of username for avatar
  const avatarLetter = user.username.charAt(0).toUpperCase();

  // Calculate additional stats
  const recentGames = gameHistory.slice(0, 5);
  const recentAvgWPM = recentGames.length > 0
    ? Math.round(recentGames.reduce((sum, game) => {
        const playerData = game.players.find(p => p.username === user.username);
        return sum + (playerData?.finalWPM || 0);
      }, 0) / recentGames.length)
    : 0;

  content.innerHTML = `
    <!-- Profile Header -->
    <div class="profile-header">
      <div class="profile-avatar">${avatarLetter}</div>
      <div class="profile-details">
        <div class="profile-username">${escapeHtml(user.profile?.displayName || user.username)}</div>
        <div class="profile-bio">${escapeHtml(user.profile?.bio || 'No bio yet')}</div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${user.stats.gamesPlayed}</div>
        <div class="stat-label">Games Played</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${user.stats.gamesWon}</div>
        <div class="stat-label">Games Won</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${user.stats.averageWPM}</div>
        <div class="stat-label">Average WPM</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${user.stats.bestWPM}</div>
        <div class="stat-label">Best WPM</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${user.stats.averageAccuracy}%</div>
        <div class="stat-label">Avg Accuracy</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${user.stats.winRate}%</div>
        <div class="stat-label">Win Rate</div>
      </div>
    </div>

    <!-- Game History -->
    <h2 class="section-title">Recent Games</h2>
    <div class="history-grid" id="historyGrid">
      ${gameHistory.length > 0 ? '' : '<div class="no-history"><div class="no-history-icon">🎮</div><div>No games played yet. Start playing to build your history!</div></div>'}
    </div>
  `;

  // Display game history
  if (gameHistory.length > 0) {
    const historyGrid = document.getElementById('historyGrid');
    gameHistory.forEach(game => {
      const item = createHistoryItem(game, user.username);
      historyGrid.appendChild(item);
    });
  }
}

// Create history item
function createHistoryItem(game, username) {
  const div = document.createElement('div');
  div.className = 'history-item';

  // Find player data (case-insensitive match)
  const playerData = game.players.find(p =>
    p.username && p.username.toLowerCase() === username.toLowerCase()
  );

  if (!playerData) {
    console.log('Player not found in game:', game, 'looking for:', username);
    return div;
  }

  // Determine if won
  const won = game.winner && game.winner.username === username;

  // Get mode icon
  const modeIcon = game.gameMode === 'solo' ? '🤖' : '👥';

  // Format date
  const date = new Date(game.createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Get difficulty display
  const difficultyMap = {
    level1: 'Easy',
    level2: 'Normal',
    level3: 'Medium',
    level4: 'Hard',
    level5: 'Expert'
  };
  const difficulty = difficultyMap[game.difficulty] || game.difficulty;

  div.innerHTML = `
    <div class="history-icon">${modeIcon}</div>
    <div class="history-info">
      <div class="history-mode">${game.gameMode === 'solo' ? 'Solo' : 'Multiplayer'} ${won ? '🏆' : ''}</div>
      <div class="history-details">
        <span>${difficulty}</span>
        <span>•</span>
        <span>${game.passageLength}</span>
        <span>•</span>
        <span>${formattedDate} at ${formattedTime}</span>
      </div>
    </div>
    <div class="history-stats">
      <div class="history-stat">
        <div class="history-stat-value">${playerData.finalWPM}</div>
        <div class="history-stat-label">WPM</div>
      </div>
      <div class="history-stat">
        <div class="history-stat-value">${playerData.finalAccuracy}%</div>
        <div class="history-stat-label">Accuracy</div>
      </div>
      <div class="history-stat">
        <div class="history-stat-value">#${playerData.placement}</div>
        <div class="history-stat-label">Place</div>
      </div>
    </div>
    <div class="history-result ${won ? 'result-win' : 'result-loss'}">
      ${won ? '✓ WIN' : '✗ LOSS'}
    </div>
  `;

  return div;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup reset button
function setupResetButton() {
  const resetBtn = document.getElementById('resetStatsBtn');
  const confirmModal = document.getElementById('confirmModal');
  const confirmResetBtn = document.getElementById('confirmResetBtn');
  const cancelResetBtn = document.getElementById('cancelResetBtn');

  // Show modal when reset button is clicked
  resetBtn.addEventListener('click', () => {
    confirmModal.classList.remove('hidden');
  });

  // Cancel reset
  cancelResetBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
  });

  // Confirm reset
  confirmResetBtn.addEventListener('click', async () => {
    confirmResetBtn.disabled = true;
    confirmResetBtn.textContent = 'Resetting...';

    try {
      const response = await fetch('/api/profile/reset-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Hide modal
        confirmModal.classList.add('hidden');

        // Show success message and reload
        alert('Statistics reset successfully!');
        window.location.reload();
      } else {
        alert('Failed to reset statistics: ' + data.message);
        confirmResetBtn.disabled = false;
        confirmResetBtn.textContent = 'Yes, Reset Everything';
      }
    } catch (error) {
      console.error('Reset stats error:', error);
      alert('Error resetting statistics. Please try again.');
      confirmResetBtn.disabled = false;
      confirmResetBtn.textContent = 'Yes, Reset Everything';
    }
  });

  // Close modal when clicking outside
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      confirmModal.classList.add('hidden');
    }
  });
}
