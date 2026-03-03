/**
 * Session Check and User Profile Management
 * Uses JWT stored in localStorage — no cookie/session dependency.
 */

let currentUser = null;

/**
 * Return auth headers for every fetch call that needs authentication.
 * Usage: fetch('/api/...', { headers: authHeaders() })
 */
function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// If Google OAuth passed a token back in the URL (?token=...), save it now
// and remove it from the address bar so it never lingers.
(function pickUpOAuthToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('authToken', token);
    params.delete('token');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
    window.history.replaceState({}, document.title, newUrl);
  }
})();

// Check authentication status on page load
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me', { headers: authHeaders() });
    const data = await response.json();

    if (data.success && data.user) {
      currentUser = data.user;
      handleLoggedInUser(data.user);
    } else {
      currentUser = null;
      handleGuestUser();
    }
  } catch (error) {
    currentUser = null;
    handleGuestUser();
  }
}

// Handle logged-in user
function handleLoggedInUser(user) {
  const userProfile = document.getElementById('userProfile');
  const profileUsername = document.getElementById('profileUsername');

  if (userProfile && profileUsername) {
    const displayName = user.profile?.displayName || user.username;
    const firstName = displayName.split(' ')[0];
    profileUsername.textContent = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    userProfile.classList.remove('hidden');

    const profileInfo = userProfile.querySelector('.profile-info');
    if (profileInfo) {
      profileInfo.style.cursor = 'pointer';
      profileInfo.addEventListener('click', () => {
        window.location.href = '/profile.html';
      });
    }
  }

  const loggedInUsername = document.getElementById('loggedInUsername');
  const welcomeUsername = document.getElementById('welcomeUsername');
  if (loggedInUsername && welcomeUsername) {
    welcomeUsername.textContent = user.username;
    loggedInUsername.classList.remove('hidden');
  }

  const usernameInputGroup = document.getElementById('usernameInputGroup');
  const authButtons = document.getElementById('authButtons');
  if (usernameInputGroup) usernameInputGroup.classList.add('hidden');
  if (authButtons) authButtons.classList.add('hidden');

  const playerNameInput = document.getElementById('playerName');
  if (playerNameInput) playerNameInput.value = user.username;
}

// Handle guest user (not logged in)
function handleGuestUser() {
  const userProfile = document.getElementById('userProfile');
  if (userProfile) userProfile.classList.add('hidden');

  const loggedInUsername = document.getElementById('loggedInUsername');
  if (loggedInUsername) loggedInUsername.classList.add('hidden');

  const usernameInputGroup = document.getElementById('usernameInputGroup');
  const authButtons = document.getElementById('authButtons');
  if (usernameInputGroup) usernameInputGroup.classList.remove('hidden');
  if (authButtons) authButtons.classList.remove('hidden');
}

// Logout — remove JWT, call server, reload
async function handleLogout() {
  localStorage.removeItem('authToken');
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
  } catch (_) {}
  window.location.reload();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
});

// Export for use in game.js and other scripts
window.getCurrentUser = () => currentUser;
window.authHeaders = authHeaders;
