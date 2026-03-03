/**
 * Profile Page JavaScript
 * Displays user profile with stats and game history
 */

let currentUser = null;

// Auth header helper — uses JWT from localStorage (set by session-check.js)
function authH(extra = {}) {
  return { ...(window.authHeaders ? window.authHeaders() : {}), ...extra };
}

// Load profile on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  setupResetButton();
});

// Load user profile
async function loadProfile() {
  try {
    // Check if user is logged in
    const meResponse = await fetch('/api/auth/me', { headers: authH() });
    const meData = await meResponse.json();

    if (!meData.success) {
      // Not logged in, redirect to login
      window.location.href = '/login.html';
      return;
    }

    currentUser = meData.user;

    // Load game history
    const historyResponse = await fetch('/api/profile/games?limit=20', { headers: authH() });
    const historyData = await historyResponse.json();

    console.log('Game history response:', historyData);
    console.log('Current user:', currentUser);

    const games = historyData.games || [];
    displayProfile(currentUser, games);
    renderWpmChart(games, currentUser.username);

    // Show reset button
    document.getElementById('resetStatsContainer').classList.remove('hidden');

    // Load friends
    await loadFriends();

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
        <div class="profile-bio-container">
          <div id="bioDisplay" class="profile-bio">${escapeHtml(user.profile?.bio || 'No bio yet')}</div>
          <textarea id="bioEdit" class="profile-bio-edit hidden" maxlength="200" placeholder="Write something about yourself...">${escapeHtml(user.profile?.bio || '')}</textarea>
          <div class="bio-actions">
            <button id="editBioBtn" class="btn-small btn-secondary">Edit Bio</button>
            <div id="bioEditActions" class="hidden" style="display: flex; gap: 8px;">
              <button id="saveBioBtn" class="btn-small btn-primary">Save</button>
              <button id="cancelBioBtn" class="btn-small btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Friends Section -->
    <div id="friendsSection" style="margin-top: 40px;">
      <div class="section-header" style="margin-bottom: 24px;">
        <h2 style="font-size: 32px; font-weight: 700; color: #e2e8f0;">Friends</h2>
      </div>

      <!-- Add Friend -->
      <div class="add-friend-container" style="background: var(--glass-bg); backdrop-filter: blur(var(--blur-amount)); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
        <h3 style="font-size: 18px; margin-bottom: 16px; color: #e2e8f0;">Add Friend</h3>
        <div style="display: flex; gap: 12px; position: relative;">
          <div style="flex: 1; position: relative;">
            <input type="text" id="friendUsernameInput" placeholder="Enter username..." autocomplete="off" style="width: 100%; padding: 12px 20px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); border-radius: 12px; color: #e2e8f0; font-size: 16px;" />
            <div id="usernameAutocomplete" class="autocomplete-dropdown hidden"></div>
          </div>
          <button id="sendFriendRequestBtn" class="btn btn-primary">Send Request</button>
        </div>
        <div id="friendRequestMessage" style="margin-top: 12px; font-size: 14px;"></div>
      </div>

      <!-- Friend Requests -->
      <div id="friendRequestsContainer" class="hidden" style="background: var(--glass-bg); backdrop-filter: blur(var(--blur-amount)); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; margin-bottom: 24px;">
        <h3 style="font-size: 18px; margin-bottom: 16px; color: #e2e8f0;">Pending Requests</h3>
        <div id="pendingRequestsList"></div>
      </div>

      <!-- Friends List -->
      <div class="friends-list-container" style="background: var(--glass-bg); backdrop-filter: blur(var(--blur-amount)); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px;">
        <h3 style="font-size: 18px; margin-bottom: 16px; color: #e2e8f0;">My Friends</h3>
        <div id="friendsList">
          <div class="loading">Loading friends...</div>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <h2 class="section-title" style="margin-top: 40px;">Game Statistics</h2>
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

    <!-- WPM Progression Chart -->
    ${gameHistory.length >= 2 ? `
    <h2 class="section-title" style="margin-top: 40px;">WPM Progression</h2>
    <div style="background: var(--glass-bg); backdrop-filter: blur(var(--blur-amount)); border: 1px solid var(--glass-border); border-radius: 20px; padding: 28px; margin-bottom: 32px;">
      <canvas id="wpmChart" style="max-height: 260px; width: 100%;"></canvas>
    </div>
    ` : ''}

    <!-- Game History -->
    <h2 class="section-title">Recent Games</h2>
    <div style="color:rgba(226,232,240,0.5);font-size:13px;margin-bottom:16px;">
      ${user.stats.gamesPlayed} games played &nbsp;•&nbsp; ${user.stats.averageAccuracy}% avg accuracy &nbsp;•&nbsp; Best ${user.stats.bestWPM} WPM
    </div>
    <div class="history-grid" id="historyGrid">
      ${gameHistory.length > 0 ? '' : '<div class="no-history"><div class="no-history-icon">🎮</div><div>No games played yet. Start playing to build your history!</div></div>'}
    </div>
  `;

  // Setup bio editing
  setupBioEditing();

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

  // Get other players (exclude current user and bots)
  const otherPlayers = game.players.filter(p =>
    p.username.toLowerCase() !== username.toLowerCase() && !p.isBot
  );

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
      ${otherPlayers.length > 0 ? `
        <div style="margin-top: 8px;">
          <button class="btn-small btn-secondary" onclick="showGamePlayers('${game._id}')">
            👥 Players (${otherPlayers.length})
          </button>
        </div>
      ` : ''}
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

  // Store game data for later use
  div.dataset.gameId = game._id;
  div.dataset.players = JSON.stringify(otherPlayers);

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
        headers: authH({ 'Content-Type': 'application/json' })
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

// Setup bio editing
function setupBioEditing() {
  const editBtn = document.getElementById('editBioBtn');
  const saveBtn = document.getElementById('saveBioBtn');
  const cancelBtn = document.getElementById('cancelBioBtn');
  const bioDisplay = document.getElementById('bioDisplay');
  const bioEdit = document.getElementById('bioEdit');
  const bioEditActions = document.getElementById('bioEditActions');

  editBtn.addEventListener('click', () => {
    bioDisplay.classList.add('hidden');
    bioEdit.classList.remove('hidden');
    editBtn.classList.add('hidden');
    bioEditActions.classList.remove('hidden');
    bioEdit.focus();
  });

  cancelBtn.addEventListener('click', () => {
    bioEdit.value = currentUser.profile?.bio || '';
    bioEdit.classList.add('hidden');
    bioDisplay.classList.remove('hidden');
    bioEditActions.classList.add('hidden');
    editBtn.classList.remove('hidden');
  });

  saveBtn.addEventListener('click', async () => {
    const newBio = bioEdit.value.trim();

    try {
      const response = await fetch('/api/profile/update-bio', {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ bio: newBio })
      });

      const data = await response.json();

      if (response.ok) {
        currentUser.profile.bio = newBio;
        bioDisplay.textContent = newBio || 'No bio yet';
        bioEdit.classList.add('hidden');
        bioDisplay.classList.remove('hidden');
        bioEditActions.classList.add('hidden');
        editBtn.classList.remove('hidden');
      } else {
        alert('Failed to update bio: ' + data.message);
      }
    } catch (error) {
      console.error('Error updating bio:', error);
      alert('Error updating bio. Please try again.');
    }
  });
}

// Friends functionality
async function loadFriends() {
  try {
    // Load friends list
    const friendsResponse = await fetch('/api/friends/list', { headers: authH() });
    const friendsData = await friendsResponse.json();

    // Load pending requests
    const requestsResponse = await fetch('/api/friends/pending', { headers: authH() });
    const requestsData = await requestsResponse.json();

    displayFriends(friendsData.friends || []);
    displayPendingRequests(requestsData.received || [], requestsData.sent || []);
  } catch (error) {
    console.error('Error loading friends:', error);
  }
}

function displayFriends(friends) {
  const friendsList = document.getElementById('friendsList');

  if (friends.length === 0) {
    friendsList.innerHTML = '<div style="color: rgba(226, 232, 240, 0.6); text-align: center; padding: 20px;">No friends yet. Add some friends to get started!</div>';
    return;
  }

  friendsList.innerHTML = friends.map(friend => {
    const initial = friend.username.charAt(0).toUpperCase();
    const isOnline = friend.isOnline;

    return `
      <div class="friend-item" data-friend-id="${friend.id}">
        <div class="friend-info">
          <div class="friend-avatar">${initial}</div>
          <div class="friend-details">
            <div class="friend-username">${friend.username}</div>
            <div class="friend-status" style="color: ${isOnline ? 'var(--color-success)' : 'rgba(226, 232, 240, 0.5)'};">
              <span class="status-indicator ${isOnline ? 'status-online' : 'status-offline'}"></span>
              ${isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
        <div class="friend-actions">
          <button class="btn-icon btn-remove" onclick="removeFriend('${friend.id}', '${friend.username}')">Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

function displayPendingRequests(received, sent) {
  const requestsContainer = document.getElementById('friendRequestsContainer');
  const requestsList = document.getElementById('pendingRequestsList');

  if (received.length === 0 && sent.length === 0) {
    requestsContainer.classList.add('hidden');
    return;
  }

  requestsContainer.classList.remove('hidden');

  let html = '';

  if (received.length > 0) {
    html += '<h4 style="font-size: 14px; color: rgba(226, 232, 240, 0.7); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Received</h4>';
    html += received.map(request => {
      const initial = request.from.username.charAt(0).toUpperCase();
      return `
        <div class="friend-request-item">
          <div class="friend-info">
            <div class="friend-avatar">${initial}</div>
            <div class="friend-details">
              <div class="friend-username">${request.from.username}</div>
              <div class="friend-status" style="color: rgba(226, 232, 240, 0.5);">
                Sent you a friend request
              </div>
            </div>
          </div>
          <div class="friend-actions">
            <button class="btn-icon btn-accept" onclick="acceptFriendRequest('${request.id}')">Accept</button>
            <button class="btn-icon btn-reject" onclick="rejectFriendRequest('${request.id}')">Reject</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (sent.length > 0) {
    if (received.length > 0) {
      html += '<h4 style="font-size: 14px; color: rgba(226, 232, 240, 0.7); margin: 20px 0 12px 0; text-transform: uppercase; letter-spacing: 1px;">Sent</h4>';
    }
    html += sent.map(request => {
      const initial = request.to.username.charAt(0).toUpperCase();
      return `
        <div class="friend-request-item">
          <div class="friend-info">
            <div class="friend-avatar">${initial}</div>
            <div class="friend-details">
              <div class="friend-username">${request.to.username}</div>
              <div class="friend-status" style="color: rgba(226, 232, 240, 0.5);">
                Request pending...
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  requestsList.innerHTML = html;
}

// Autocomplete functionality
let autocompleteTimeout = null;
const usernameInput = document.getElementById('friendUsernameInput');
const autocompleteDropdown = document.getElementById('usernameAutocomplete');

usernameInput.addEventListener('input', async (e) => {
  const query = e.target.value.trim();

  // Clear previous timeout
  if (autocompleteTimeout) {
    clearTimeout(autocompleteTimeout);
  }

  // Hide dropdown if less than 3 characters
  if (query.length < 3) {
    autocompleteDropdown.classList.add('hidden');
    return;
  }

  // Debounce the search
  autocompleteTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`/api/friends/search?query=${encodeURIComponent(query)}`, { headers: authH() });
      const data = await response.json();

      if (response.ok && data.users && data.users.length > 0) {
        displayAutocomplete(data.users);
      } else {
        autocompleteDropdown.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error searching users:', error);
      autocompleteDropdown.classList.add('hidden');
    }
  }, 300);
});

// Close autocomplete when clicking outside
document.addEventListener('click', (e) => {
  if (!usernameInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
    autocompleteDropdown.classList.add('hidden');
  }
});

function displayAutocomplete(users) {
  autocompleteDropdown.innerHTML = users.map(user => `
    <div class="autocomplete-item" data-username="${user.username}">
      <div class="autocomplete-avatar">${user.username.charAt(0).toUpperCase()}</div>
      <div class="autocomplete-info">
        <div class="autocomplete-username">${user.username}</div>
        <div class="autocomplete-displayname">${user.displayName}</div>
      </div>
    </div>
  `).join('');

  // Add click handlers to autocomplete items
  autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      const username = item.dataset.username;
      usernameInput.value = username;
      autocompleteDropdown.classList.add('hidden');
    });
  });

  autocompleteDropdown.classList.remove('hidden');
}

// Send friend request
document.getElementById('sendFriendRequestBtn').addEventListener('click', async () => {
  const username = document.getElementById('friendUsernameInput').value.trim();
  const messageEl = document.getElementById('friendRequestMessage');

  if (!username) {
    messageEl.style.color = 'var(--color-error)';
    messageEl.textContent = 'Please enter a username';
    return;
  }

  try {
    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: authH({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.style.color = 'var(--color-success)';
      messageEl.textContent = data.message;
      document.getElementById('friendUsernameInput').value = '';
      autocompleteDropdown.classList.add('hidden');

      // Emit socket event to notify recipient (if socket available)
      if (window.socket && data.recipientId) {
        window.socket.emit('friendRequestSent', {
          recipientId: data.recipientId,
          requestId: data.request.id
        });
      }

      // Reload friends list
      await loadFriends();
    } else {
      messageEl.style.color = 'var(--color-error)';
      messageEl.textContent = data.message;
    }
  } catch (error) {
    console.error('Error sending friend request:', error);
    messageEl.style.color = 'var(--color-error)';
    messageEl.textContent = 'Failed to send friend request';
  }
});

// Accept friend request
async function acceptFriendRequest(requestId) {
  try {
    const response = await fetch(`/api/friends/accept/${requestId}`, {
      method: 'POST',
      headers: authH()
    });

    if (response.ok) {
      await loadFriends();
    }
  } catch (error) {
    console.error('Error accepting friend request:', error);
  }
}

// Reject friend request
async function rejectFriendRequest(requestId) {
  try {
    const response = await fetch(`/api/friends/reject/${requestId}`, {
      method: 'POST',
      headers: authH()
    });

    if (response.ok) {
      await loadFriends();
    }
  } catch (error) {
    console.error('Error rejecting friend request:', error);
  }
}

// Remove friend
async function removeFriend(friendId, username) {
  if (!confirm(`Remove ${username} from your friends list?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/friends/remove/${friendId}`, {
      method: 'DELETE',
      headers: authH()
    });

    if (response.ok) {
      await loadFriends();
    }
  } catch (error) {
    console.error('Error removing friend:', error);
  }
}

// Show game players modal
async function showGamePlayers(gameId) {
  const modal = document.getElementById('gamePlayersModal');
  const playersList = document.getElementById('gamePlayersList');

  // Find the game element
  const gameElement = document.querySelector(`[data-game-id="${gameId}"]`);
  if (!gameElement) return;

  const players = JSON.parse(gameElement.dataset.players);

  if (players.length === 0) {
    playersList.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(226, 232, 240, 0.6);">No other players in this game</div>';
  } else {
    playersList.innerHTML = `<div style="display: flex; flex-direction: column; gap: 12px;"></div>`;
    const container = playersList.querySelector('div');

    for (const player of players) {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'friend-item';
      playerDiv.id = `game-player-${player.username}`;

      const initial = player.username.charAt(0).toUpperCase();

      playerDiv.innerHTML = `
        <div class="friend-info">
          <div class="friend-avatar">${initial}</div>
          <div class="friend-details">
            <div class="friend-username">${player.username}</div>
            <div class="friend-status" style="color: rgba(226, 232, 240, 0.5);">
              ${player.finalWPM} WPM • ${player.finalAccuracy}% accuracy
            </div>
          </div>
        </div>
        <div class="friend-actions" id="player-actions-${player.username}">
          <div class="loading">Loading...</div>
        </div>
      `;

      container.appendChild(playerDiv);

      // Check friend status for this player
      checkPlayerFriendStatus(player.username);
    }
  }

  modal.classList.remove('hidden');
}

// Check friend status for a player
async function checkPlayerFriendStatus(username) {
  try {
    const friendsResponse = await fetch('/api/friends/list', { headers: authH() });
    const friendsData = await friendsResponse.json();
    const friends = friendsData.friends || [];

    const requestsResponse = await fetch('/api/friends/pending', { headers: authH() });
    const requestsData = await requestsResponse.json();
    const receivedRequests = requestsData.received || [];
    const sentRequests = requestsData.sent || [];

    const container = document.getElementById(`player-actions-${username}`);
    if (!container) return;

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
        <button class="btn-small btn-primary" onclick="acceptPlayerFriendRequest('${requestReceived.id}', '${username}')">Accept</button>
        <button class="btn-small btn-secondary" onclick="rejectPlayerFriendRequest('${requestReceived.id}', '${username}')">Reject</button>
      `;
      return;
    }

    // Show add friend button
    container.innerHTML = `<button class="btn-small btn-primary" onclick="sendPlayerFriendRequest('${username}')">Add Friend</button>`;
  } catch (error) {
    console.error('Error checking player friend status:', error);
  }
}

// Send friend request to a game player
async function sendPlayerFriendRequest(username) {
  try {
    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: authH({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username })
    });

    const data = await response.json();

    if (response.ok) {
      // Emit socket event to notify recipient (if socket available)
      if (window.socket && data.recipientId) {
        window.socket.emit('friendRequestSent', {
          recipientId: data.recipientId,
          requestId: data.request.id
        });
      }

      const container = document.getElementById(`player-actions-${username}`);
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

// Accept friend request from game player
async function acceptPlayerFriendRequest(requestId, username) {
  try {
    const response = await fetch(`/api/friends/accept/${requestId}`, {
      method: 'POST',
      headers: authH()
    });

    if (response.ok) {
      const container = document.getElementById(`player-actions-${username}`);
      if (container) {
        container.innerHTML = '<span style="color: var(--color-success); font-size: 14px;">✓ Friends</span>';
      }
      await loadFriends();
    }
  } catch (error) {
    console.error('Error accepting friend request:', error);
  }
}

// Reject friend request from game player
async function rejectPlayerFriendRequest(requestId, username) {
  try {
    const response = await fetch(`/api/friends/reject/${requestId}`, {
      method: 'POST',
      headers: authH()
    });

    if (response.ok) {
      const container = document.getElementById(`player-actions-${username}`);
      if (container) {
        container.innerHTML = `<button class="btn-small btn-primary" onclick="sendPlayerFriendRequest('${username}')">Add Friend</button>`;
      }
    }
  } catch (error) {
    console.error('Error rejecting friend request:', error);
  }
}

// Close game players modal
document.getElementById('closePlayersModal')?.addEventListener('click', () => {
  document.getElementById('gamePlayersModal').classList.add('hidden');
});

// Close modal when clicking outside
document.getElementById('gamePlayersModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'gamePlayersModal') {
    document.getElementById('gamePlayersModal').classList.add('hidden');
  }
});

// ── WPM Progression Chart ─────────────────────────────────────────────────────
let wpmChartInstance = null;

function renderWpmChart(games, username) {
  const canvas = document.getElementById('wpmChart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Collect data points: games sorted oldest → newest with current user's WPM
  const points = games
    .slice() // don't mutate
    .reverse() // games come newest-first from API, flip to oldest-first
    .map(game => {
      const player = game.players.find(p =>
        p.username && p.username.toLowerCase() === username.toLowerCase()
      );
      if (!player) return null;
      return {
        x: new Date(game.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        y: player.finalWPM || 0,
        mode: game.gameMode
      };
    })
    .filter(Boolean);

  if (points.length < 2) return; // not enough data for a meaningful chart

  const ctx = canvas.getContext('2d');

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(124, 58, 237, 0.35)');
  gradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');

  if (wpmChartInstance) wpmChartInstance.destroy();

  wpmChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(p => p.x),
      datasets: [{
        label: 'WPM',
        data: points.map(p => p.y),
        borderColor: '#a78bfa',
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointBackgroundColor: '#a78bfa',
        pointBorderColor: '#1e1b4b',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => points[items[0].dataIndex].x,
            label: (item) => {
              const pt = points[item.dataIndex];
              return `${pt.y} WPM  (${pt.mode === 'solo' ? 'Solo' : 'Multiplayer'})`;
            }
          },
          backgroundColor: 'rgba(15,12,41,0.9)',
          borderColor: 'rgba(124,58,237,0.4)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#a78bfa',
          padding: 10
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(226,232,240,0.5)', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          beginAtZero: false,
          ticks: { color: 'rgba(226,232,240,0.5)', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: { display: true, text: 'WPM', color: 'rgba(226,232,240,0.4)', font: { size: 12 } }
        }
      }
    }
  });
}

