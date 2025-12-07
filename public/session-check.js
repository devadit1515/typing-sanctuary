/**
 * Session Check and User Profile Management
 * Checks if user is logged in and displays their profile
 */

let currentUser = null;

// Check authentication status on page load
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();

    if (data.success && data.user) {
      // User is logged in
      currentUser = data.user;
      handleLoggedInUser(data.user);
    } else {
      // User is not logged in
      currentUser = null;
      handleGuestUser();
    }
  } catch (error) {
    // Not authenticated or error
    currentUser = null;
    handleGuestUser();
  }
}

// Handle logged-in user
function handleLoggedInUser(user) {
  // Show user profile in top corner
  const userProfile = document.getElementById('userProfile');
  const profileUsername = document.getElementById('profileUsername');

  if (userProfile && profileUsername) {
    profileUsername.textContent = user.username;
    userProfile.classList.remove('hidden');

    // Make profile info clickable to go to profile page
    const profileInfo = userProfile.querySelector('.profile-info');
    if (profileInfo) {
      profileInfo.style.cursor = 'pointer';
      profileInfo.addEventListener('click', () => {
        window.location.href = '/profile.html';
      });
    }
  }

  // Show welcome message
  const loggedInUsername = document.getElementById('loggedInUsername');
  const welcomeUsername = document.getElementById('welcomeUsername');
  if (loggedInUsername && welcomeUsername) {
    welcomeUsername.textContent = user.username;
    loggedInUsername.classList.remove('hidden');
  }

  // Hide username input and auth buttons
  const usernameInputGroup = document.getElementById('usernameInputGroup');
  const authButtons = document.getElementById('authButtons');
  if (usernameInputGroup) {
    usernameInputGroup.classList.add('hidden');
  }
  if (authButtons) {
    authButtons.classList.add('hidden');
  }

  // Pre-fill player name with username
  const playerNameInput = document.getElementById('playerName');
  if (playerNameInput) {
    playerNameInput.value = user.username;
  }
}

// Handle guest user (not logged in)
function handleGuestUser() {
  // Hide user profile
  const userProfile = document.getElementById('userProfile');
  if (userProfile) {
    userProfile.classList.add('hidden');
  }

  // Hide welcome message
  const loggedInUsername = document.getElementById('loggedInUsername');
  if (loggedInUsername) {
    loggedInUsername.classList.add('hidden');
  }

  // Show username input and auth buttons
  const usernameInputGroup = document.getElementById('usernameInputGroup');
  const authButtons = document.getElementById('authButtons');
  if (usernameInputGroup) {
    usernameInputGroup.classList.remove('hidden');
  }
  if (authButtons) {
    authButtons.classList.remove('hidden');
  }
}

// Logout handler
async function handleLogout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      // Logout successful, reload page
      window.location.reload();
    } else {
      alert('Logout failed. Please try again.');
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();

  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});

// Export currentUser for use in game.js
window.getCurrentUser = () => currentUser;
