/**
 * Social / Friends Page
 * Handles friends list, requests, player search, and challenging friends to games.
 */

let currentUserId = null;
let currentUsername = null;
let socket = null;
let challengeFriendId = null;
let challengeFriendUsername = null;

// ── Auth guard ────────────────────────────────────────────────────────────────
function ah(extra = {}) {
  return { ...(window.authHeaders ? window.authHeaders() : {}), ...extra };
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Ensure user is logged in
  try {
    const res = await fetch('/api/auth/me', { headers: ah() });
    const data = await res.json();
    if (!data.success) {
      window.location.href = '/login.html';
      return;
    }
    currentUserId = data.user._id;
    currentUsername = data.user.username;
  } catch {
    window.location.href = '/login.html';
    return;
  }

  setupTabs();
  setupSearch();
  setupChallengeModal();
  connectSocket();
  await loadAll();

  // Create particles
  createParticles();
});

function createParticles() {
  const container = document.getElementById('particlesContainer');
  if (!container) return;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    const size = 2 + Math.random() * 2;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.setProperty('--particle-opacity', 0.1 + Math.random() * 0.2);
    p.style.animationDuration = (10 + Math.random() * 15) + 's';
    p.style.animationDelay = (Math.random() * 5) + 's';
    container.appendChild(p);
  }
}

// ── Socket ────────────────────────────────────────────────────────────────────
function connectSocket() {
  socket = io({ transports: ['websocket', 'polling'], reconnection: true });

  socket.on('connect', () => {
    if (currentUserId) socket.emit('userOnline', { userId: currentUserId });
  });

  socket.on('friendOnline', ({ userId }) => {
    const dot = document.getElementById(`dot-${userId}`);
    const text = document.getElementById(`status-text-${userId}`);
    const challengeBtn = document.getElementById(`challenge-${userId}`);
    if (dot) { dot.className = 'status-dot online'; }
    if (text) { text.textContent = 'Online'; text.className = 'online-text'; }
    if (challengeBtn) challengeBtn.style.display = 'inline-flex';
  });

  socket.on('friendOffline', ({ userId }) => {
    const dot = document.getElementById(`dot-${userId}`);
    const text = document.getElementById(`status-text-${userId}`);
    const challengeBtn = document.getElementById(`challenge-${userId}`);
    if (dot) { dot.className = 'status-dot offline'; }
    if (text) { text.textContent = 'Offline'; text.className = 'offline-text'; }
    if (challengeBtn) challengeBtn.style.display = 'none';
  });

  // roomCreated is handled by game.js (we navigate there for challenges)
}

// ── Load all data ─────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadFriends(), loadRequests()]);
}

// ── Friends list ──────────────────────────────────────────────────────────────
async function loadFriends() {
  const container = document.getElementById('friendsList');
  try {
    const res = await fetch('/api/friends/list', { headers: ah() });
    const data = await res.json();
    const friends = data.friends || [];

    if (friends.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">👥</span>No friends yet. Search for players to add!</div>`;
      return;
    }

    // Sort: online first
    friends.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

    container.innerHTML = friends.map(f => {
      const initial = (f.displayName || f.username).charAt(0).toUpperCase();
      const name = escHtml(f.displayName || f.username);
      const uname = escHtml(f.username);
      const online = f.isOnline;

      return `
        <div class="friend-item" id="friend-item-${f.id}">
          <div class="friend-left">
            <div class="friend-avatar">${initial}</div>
            <div class="friend-info">
              <div class="friend-username">${name} <span style="color:rgba(226,232,240,0.4);font-size:13px;font-weight:400;">@${uname}</span></div>
              <div class="friend-status">
                <span class="status-dot ${online ? 'online' : 'offline'}" id="dot-${f.id}"></span>
                <span id="status-text-${f.id}" class="${online ? 'online-text' : 'offline-text'}">${online ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <div class="friend-actions">
            <button class="btn-sm btn-challenge" id="challenge-${f.id}"
              style="display:${online ? 'inline-flex' : 'none'}"
              onclick="openChallengeModal('${f.id}', '${uname}')">⚡ Challenge</button>
            <button class="btn-sm btn-remove" onclick="removeFriend('${f.id}', '${uname}')">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-state">Failed to load friends.</div>`;
  }
}

// ── Friend requests ───────────────────────────────────────────────────────────
async function loadRequests() {
  const receivedEl = document.getElementById('receivedRequests');
  const sentEl = document.getElementById('sentRequests');
  const badge = document.getElementById('requestsBadge');

  try {
    const res = await fetch('/api/friends/pending', { headers: ah() });
    const data = await res.json();
    const received = data.received || [];
    const sent = data.sent || [];

    // Update badge
    if (received.length > 0) {
      badge.textContent = received.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Received
    if (received.length === 0) {
      receivedEl.innerHTML = `<div class="empty-state" style="padding:24px 0"><span class="empty-icon" style="font-size:32px">📭</span>No pending requests</div>`;
    } else {
      receivedEl.innerHTML = received.map(r => {
        const name = escHtml(r.from.displayName || r.from.username);
        const uname = escHtml(r.from.username);
        const initial = (r.from.displayName || r.from.username).charAt(0).toUpperCase();
        return `
          <div class="friend-item" id="req-${r.id}">
            <div class="friend-left">
              <div class="friend-avatar">${initial}</div>
              <div class="friend-info">
                <div class="friend-username">${name} <span style="color:rgba(226,232,240,0.4);font-size:13px;font-weight:400;">@${uname}</span></div>
                <div class="friend-status" style="color:rgba(226,232,240,0.4)">Wants to be friends</div>
              </div>
            </div>
            <div class="friend-actions">
              <button class="btn-sm btn-accept" onclick="acceptRequest('${r.id}')">Accept</button>
              <button class="btn-sm btn-decline" onclick="declineRequest('${r.id}')">Decline</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Sent
    if (sent.length === 0) {
      sentEl.innerHTML = `<div class="empty-state" style="padding:24px 0"><span class="empty-icon" style="font-size:32px">📤</span>No sent requests</div>`;
    } else {
      sentEl.innerHTML = sent.map(r => {
        const name = escHtml(r.to.displayName || r.to.username);
        const uname = escHtml(r.to.username);
        const initial = (r.to.displayName || r.to.username).charAt(0).toUpperCase();
        return `
          <div class="friend-item" id="sent-${r.id}">
            <div class="friend-left">
              <div class="friend-avatar">${initial}</div>
              <div class="friend-info">
                <div class="friend-username">${name} <span style="color:rgba(226,232,240,0.4);font-size:13px;font-weight:400;">@${uname}</span></div>
                <div class="friend-status" style="color:rgba(226,232,240,0.4)">Request pending...</div>
              </div>
            </div>
            <div class="friend-actions">
              <button class="btn-sm btn-decline" onclick="cancelRequest('${r.id}')">Cancel</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// ── Accept / Decline / Cancel ────────────────────────────────────────────────
async function acceptRequest(requestId) {
  try {
    const res = await fetch(`/api/friends/accept/${requestId}`, { method: 'POST', headers: ah() });
    if (res.ok) {
      document.getElementById(`req-${requestId}`)?.remove();
      await loadFriends();
      await loadRequests();
    }
  } catch (err) { console.error(err); }
}

async function declineRequest(requestId) {
  try {
    const res = await fetch(`/api/friends/reject/${requestId}`, { method: 'POST', headers: ah() });
    if (res.ok) {
      document.getElementById(`req-${requestId}`)?.remove();
      await loadRequests();
    }
  } catch (err) { console.error(err); }
}

async function cancelRequest(requestId) {
  try {
    const res = await fetch(`/api/friends/reject/${requestId}`, { method: 'POST', headers: ah() });
    if (res.ok) {
      document.getElementById(`sent-${requestId}`)?.remove();
    }
  } catch (err) { console.error(err); }
}

// ── Remove friend ─────────────────────────────────────────────────────────────
async function removeFriend(friendId, username) {
  if (!confirm(`Remove ${username} from your friends list?`)) return;
  try {
    const res = await fetch(`/api/friends/remove/${friendId}`, { method: 'DELETE', headers: ah() });
    if (res.ok) {
      document.getElementById(`friend-item-${friendId}`)?.remove();
      const list = document.getElementById('friendsList');
      if (list && !list.querySelector('.friend-item')) {
        list.innerHTML = `<div class="empty-state"><span class="empty-icon">👥</span>No friends yet.</div>`;
      }
    }
  } catch (err) { console.error(err); }
}

// ── Search ────────────────────────────────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById('searchInput');
  let timeout = null;

  input.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = input.value.trim();
    const resultsEl = document.getElementById('searchResults');

    if (q.length < 3) {
      resultsEl.innerHTML = '';
      return;
    }

    timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends/search?query=${encodeURIComponent(q)}`, { headers: ah() });
        const data = await res.json();
        const users = data.users || [];

        if (users.length === 0) {
          resultsEl.innerHTML = `<div style="color:rgba(226,232,240,0.4);padding:16px 0;text-align:center">No players found</div>`;
          return;
        }

        // Need to know friend statuses
        const [friendsRes, pendingRes] = await Promise.all([
          fetch('/api/friends/list', { headers: ah() }),
          fetch('/api/friends/pending', { headers: ah() })
        ]);
        const friendsData = await friendsRes.json();
        const pendingData = await pendingRes.json();
        const friendIds = new Set((friendsData.friends || []).map(f => f.id.toString()));
        const sentIds = new Set((pendingData.sent || []).map(r => r.to.id.toString()));
        const receivedMap = {};
        (pendingData.received || []).forEach(r => { receivedMap[r.from.id.toString()] = r.id; });

        resultsEl.innerHTML = users.map(u => {
          const uid = u.id.toString();
          const name = escHtml(u.displayName || u.username);
          const uname = escHtml(u.username);
          const initial = (u.displayName || u.username).charAt(0).toUpperCase();

          let action = '';
          if (friendIds.has(uid)) {
            action = `<span style="color:var(--color-success,#4ade80);font-size:13px">✓ Friends</span>`;
          } else if (sentIds.has(uid)) {
            action = `<span style="color:rgba(226,232,240,0.5);font-size:13px">Request Sent</span>`;
          } else if (receivedMap[uid]) {
            action = `<button class="btn-sm btn-accept" onclick="acceptRequest('${receivedMap[uid]}')">Accept</button>`;
          } else {
            action = `<button class="btn-sm btn-add" onclick="sendRequest('${uname}', this)">Add Friend</button>`;
          }

          return `
            <div class="search-result-item">
              <div class="friend-left">
                <div class="friend-avatar" style="width:38px;height:38px;font-size:15px">${initial}</div>
                <div class="friend-info">
                  <div class="friend-username">${name}</div>
                  <div style="font-size:12px;color:rgba(226,232,240,0.4)">@${uname}</div>
                </div>
              </div>
              <div>${action}</div>
            </div>
          `;
        }).join('');
      } catch (err) {
        console.error(err);
      }
    }, 350);
  });
}

async function sendRequest(username, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = 'Sending...';
  try {
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: ah({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (res.ok) {
      btnEl.textContent = 'Sent ✓';
      btnEl.style.color = 'var(--color-success,#4ade80)';
      // Notify recipient via socket
      if (socket && data.recipientId) {
        socket.emit('friendRequestSent', { recipientId: data.recipientId, requestId: data.request?.id });
      }
      await loadRequests();
    } else {
      btnEl.disabled = false;
      btnEl.textContent = 'Add Friend';
      alert(data.message || 'Failed to send request');
    }
  } catch (err) {
    btnEl.disabled = false;
    btnEl.textContent = 'Add Friend';
    console.error(err);
  }
}

// ── Challenge modal ───────────────────────────────────────────────────────────
function setupChallengeModal() {
  document.getElementById('cancelChallenge').addEventListener('click', () => {
    document.getElementById('challengeModal').classList.add('hidden');
    challengeFriendId = null;
    challengeFriendUsername = null;
  });

  document.getElementById('confirmChallenge').addEventListener('click', async () => {
    if (!challengeFriendId || !socket) return;
    const btn = document.getElementById('confirmChallenge');
    btn.innerHTML = '<span class="spinner"></span>Creating room...';
    btn.disabled = true;

    const passageLength = document.getElementById('challengePassageLength').value;
    const difficulty = document.getElementById('challengeDifficulty').value;

    // Navigate to game.html — it will create the room and send the invite on load
    window.location.href = `/game.html?challenge=${encodeURIComponent(challengeFriendId)}&difficulty=${encodeURIComponent(difficulty)}&passageLength=${encodeURIComponent(passageLength)}`;
  });

  // Close modal on overlay click
  document.getElementById('challengeModal').addEventListener('click', (e) => {
    if (e.target.id === 'challengeModal') {
      document.getElementById('challengeModal').classList.add('hidden');
    }
  });
}

function openChallengeModal(friendId, friendUsername) {
  challengeFriendId = friendId;
  challengeFriendUsername = friendUsername;
  document.getElementById('challengeTarget').textContent = '@' + friendUsername;
  const btn = document.getElementById('confirmChallenge');
  btn.innerHTML = 'Send Challenge';
  btn.disabled = false;
  document.getElementById('challengeModal').classList.remove('hidden');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
