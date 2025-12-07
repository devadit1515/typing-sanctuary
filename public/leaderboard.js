/**
 * Leaderboard JavaScript
 * Handles leaderboard display and tab switching
 */

let currentTab = 'wpm';

// Load leaderboard on page load
document.addEventListener('DOMContentLoaded', () => {
  loadLeaderboard('wpm');

  // Setup tab switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      // Update active state
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Load leaderboard for selected tab
      currentTab = tab;
      loadLeaderboard(tab);
    });
  });
});

// Load leaderboard data
async function loadLeaderboard(type) {
  const content = document.getElementById('leaderboardContent');
  content.innerHTML = '<div class="loading">Loading leaderboard...</div>';

  try {
    const response = await fetch(`/api/leaderboard/${type}?limit=50`);
    const data = await response.json();

    if (data.success) {
      displayLeaderboard(data.leaderboard, type);
    } else {
      content.innerHTML = `<div class="error-message">Failed to load leaderboard: ${data.message}</div>`;
    }
  } catch (error) {
    content.innerHTML = '<div class="error-message">Network error. Please check your connection.</div>';
  }
}

// Display leaderboard
function displayLeaderboard(players, type) {
  const content = document.getElementById('leaderboardContent');

  if (!players || players.length === 0) {
    content.innerHTML = '<div class="loading">No players found. Be the first to play!</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'leaderboard-grid';

  players.forEach((player, index) => {
    const rank = index + 1;
    const item = document.createElement('div');
    item.className = 'leaderboard-item';

    // Determine rank class
    let rankClass = '';
    if (rank === 1) rankClass = 'gold';
    else if (rank === 2) rankClass = 'silver';
    else if (rank === 3) rankClass = 'bronze';

    // Get the stat value based on type
    let statValue = 0;
    let statLabel = '';

    switch (type) {
      case 'wpm':
        statValue = player.stats.averageWPMPerfect || 0;
        statLabel = 'Avg WPM';
        break;
      case 'best':
        statValue = player.stats.bestWPMPerfect || 0;
        statLabel = 'Best WPM';
        break;
      case 'wins':
        statValue = player.stats.gamesWon;
        statLabel = 'Wins';
        break;
    }

    item.innerHTML = `
      <div class="rank ${rankClass}">
        ${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
      </div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(player.profile?.displayName || player.username)}</div>
        <div class="player-stats">
          <span class="stat-badge">${player.stats.perfectAccuracyGames || 0} Perfect Games</span>
          <span class="stat-badge">100% Accuracy</span>
          ${type === 'wpm' ? `<span class="stat-badge">Best: ${player.stats.bestWPMPerfect || 0} WPM</span>` : ''}
          ${type === 'wins' ? `<span class="stat-badge">Avg: ${player.stats.averageWPMPerfect || 0} WPM</span>` : ''}
        </div>
      </div>
      <div class="stat-value">
        ${statValue}${type !== 'wins' ? '' : ''}
      </div>
    `;

    // Add click handler to view profile
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      window.location.href = `/profile.html?username=${player.username}`;
    });

    grid.appendChild(item);
  });

  content.innerHTML = '';
  content.appendChild(grid);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
